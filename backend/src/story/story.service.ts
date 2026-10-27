import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { seedStory } from './story.seed';
import { enqueueStory } from './story-outbox';
import {
  validateOperation,
  type AudienceInput,
  type StoryCommand,
} from './story.command';

type Tx = Prisma.TransactionClient;
const audienceInclude = { members: true } as const;
type Audience = { scope: string; members: { userId: string }[] };
const canRead = (a: Audience, userId: string, master: boolean) =>
  master ||
  a.scope === 'PUBLIC' ||
  (a.scope === 'RECIPIENTS' && a.members.some((m) => m.userId === userId));
const visibleWhere = (
  userId: string,
  master: boolean,
): Prisma.StoryAudienceWhereInput =>
  master
    ? {}
    : {
        OR: [
          { scope: 'PUBLIC' },
          { scope: 'RECIPIENTS', members: { some: { userId } } },
        ],
      };
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
      )
      .join(',')}}`;
  return JSON.stringify(value);
}

@Injectable()
export class StoryService {
  constructor(private readonly prisma: PrismaService) {}

  private async access(
    tx: Tx,
    campaignId: string,
    userId: string,
    ownerOnly = false,
  ) {
    const c = await tx.campaign.findUnique({
      where: { id: campaignId },
      select: {
        masterId: true,
        members: {
          select: { userId: true, user: { select: { displayName: true } } },
        },
      },
    });
    if (!c) throw new NotFoundException('Campanha não encontrada.');
    const master = c.masterId === userId;
    if (
      (!master && !c.members.some((m) => m.userId === userId)) ||
      (ownerOnly && !master)
    )
      throw new ForbiddenException('Sem acesso a esta operação da campanha.');
    return { ...c, master };
  }
  private async write<T>(
    campaignId: string,
    userId: string,
    fn: (tx: Tx) => Promise<T>,
    existingTx?: Tx,
  ) {
    if (existingTx) {
      await this.access(existingTx, campaignId, userId, true);
      return fn(existingTx);
    }
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM Campaign WHERE id = ${campaignId} FOR UPDATE`;
            await this.access(tx, campaignId, userId, true);
            return fn(tx);
          },
          { isolationLevel: 'Serializable', timeout: 30000, maxWait: 10000 },
        );
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2002'].includes(e.code)
        ) {
          if (e.code === 'P2034' && attempt < 2) continue;
          throw new ConflictException(
            'Registro já existente ou campanha alterada. Atualize a memória e confira os dados.',
          );
        }
        throw e;
      }
    }
  }
  async initialize(campaignId: string, userId: string) {
    return this.write(campaignId, userId, async (tx) => {
      const lore = await tx.campaignLore.findUnique({ where: { campaignId } });
      if (!lore)
        throw new ConflictException(
          'Instale um cenário antes de iniciar sua memória.',
        );
      await seedStory(tx, campaignId);
      return { initialized: true, alreadyInitialized: lore.storySequence > 0 };
    });
  }

  /**
   * Entrada de memória produzida pelo mestre IA. Não passa pela autorização de
   * mestre porque a ação do jogador já foi validada; o evento é sempre público
   * e o payload guarda a narração e a memória do turno.
   */
  async appendAiTurn(
    campaignId: string,
    input: {
      requestKey: string;
      summary: string;
      payload: Record<string, unknown>;
    },
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM Campaign WHERE id = ${campaignId} FOR UPDATE`;
        const lore = await tx.campaignLore.findUnique({
          where: { campaignId },
        });
        if (!lore || lore.storySequence < 1)
          throw new ConflictException(
            'Inicie a memória do cenário antes de jogar com o mestre IA.',
          );

        let audience = await tx.storyAudience.findFirst({
          where: { campaignId, scope: 'PUBLIC' },
          select: { id: true },
        });
        if (!audience) {
          audience = await tx.storyAudience.create({
            data: { campaignId, scope: 'PUBLIC' },
            select: { id: true },
          });
        }

        const calendar = await tx.campaignCalendar.findUniqueOrThrow({
          where: { campaignId },
        });
        const event = await tx.storyEvent.create({
          data: {
            campaignId,
            sequence: lore.storySequence + 1,
            kind: 'NOTE',
            gameMinute: calendar.totalMinutes,
            actorKind: 'AI',
            actorName: 'Mestre IA',
            requestKey: input.requestKey,
            audienceId: audience.id,
            summary: input.summary.slice(0, 2000),
            payload: JSON.stringify(input.payload),
          },
        });
        await tx.campaignLore.update({
          where: { campaignId },
          data: {
            storySequence: { increment: 1 },
            revision: { increment: 1 },
          },
        });
        await enqueueStory(tx, campaignId, event.id);

        return {
          eventId: event.id,
          sequence: event.sequence,
          gameMinute: event.gameMinute,
        };
      },
      { isolationLevel: 'Serializable', timeout: 30_000, maxWait: 10_000 },
    );
  }
  private async entities(tx: Tx, campaignId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    const rows = await tx.campaignEntity.findMany({
      where: { campaignId, id: { in: unique } },
      include: { character: { include: { character: true } } },
    });
    if (rows.length !== unique.length)
      throw new NotFoundException('Entidade não encontrada nesta campanha.');
    return rows;
  }
  private async audience(tx: Tx, campaignId: string, input: AudienceInput) {
    const ids = [...new Set(input.recipientIds)];
    if ((input.scope === 'RECIPIENTS') !== ids.length > 0)
      throw new BadRequestException(
        'Escolha destinatários somente para visibilidade restrita.',
      );
    const campaign = await tx.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: { members: true },
    });
    if (
      ids.some(
        (id) =>
          id !== campaign.masterId &&
          !campaign.members.some((m) => m.userId === id),
      )
    )
      throw new BadRequestException(
        'Destinatários devem ser membros atuais da campanha.',
      );
    return tx.storyAudience.create({
      data: {
        campaignId,
        scope: input.scope,
        members: { create: ids.map((userId) => ({ userId })) },
      },
    });
  }
  async command(
    campaignId: string,
    userId: string,
    input: StoryCommand,
    existingTx?: Tx,
  ) {
    validateOperation(input.operation);
    const requestHash = createHash('sha256')
      .update(canonical(input))
      .digest('hex');
    return this.write(
      campaignId,
      userId,
      async (tx) => {
        const lore = await tx.campaignLore.findUnique({
          where: { campaignId },
        });
        if (!lore?.storySequence)
          throw new ConflictException(
            'Inicie a memória do cenário antes de registrar acontecimentos.',
          );
        const replay = await tx.storyEvent.findUnique({
          where: {
            campaignId_requestKey: { campaignId, requestKey: input.requestKey },
          },
        });
        if (replay) {
          if (
            replay.actorUserId !== userId ||
            replay.requestHash !== requestHash
          )
            throw new ConflictException('Chave já utilizada com outros dados.');
          return {
            eventId: replay.id,
            revision: lore.revision,
            alreadyApplied: true,
          };
        }
        if (lore.revision !== input.expectedRevision)
          throw new ConflictException(
            'A memória mudou. Atualize e revise a operação antes de reenviar.',
          );
        const op = input.operation;
        const calendar = await tx.campaignCalendar.findUniqueOrThrow({
          where: { campaignId },
        });
        let audienceId: string;
        let summary = '';
        let related: string[] = [];
        let correctsEventId: string | null = null;
        let before: unknown = null;
        const audience =
          'audience' in op
            ? await this.audience(tx, campaignId, op.audience)
            : null;
        if (op.kind === 'DISCOVER') {
          const revision = await tx.storyFactRevision.findFirst({
            where: { id: op.revisionId, campaignId },
            include: { fact: true },
          });
          if (!revision)
            throw new NotFoundException(
              'Informação não encontrada nesta campanha.',
            );
          if (revision.fact.kind === 'CLAIM' && op.stance === 'KNOWN')
            throw new BadRequestException(
              'Rumores são crenças ou suspeitas, não fatos confirmados.',
            );
          const knowers = await this.entities(tx, campaignId, op.knowerIds);
          if (knowers.some((k) => !['NPC', 'CHARACTER'].includes(k.kind)))
            throw new BadRequestException(
              'Somente NPCs e personagens podem receber conhecimento.',
            );
          const recipientIds = [
            ...new Set(
              knowers.flatMap((k) =>
                k.character ? [k.character.character.userId] : [],
              ),
            ),
          ];
          audienceId = (
            await this.audience(tx, campaignId, {
              scope: recipientIds.length ? 'RECIPIENTS' : 'MASTER',
              recipientIds,
            })
          ).id;
          related = op.knowerIds;
          summary = 'Uma observação foi registrada para seus destinatários.';
        } else if (op.kind === 'PROMISE_RESOLVE') {
          const promise = await tx.storyPromise.findFirst({
            where: { id: op.promiseId, campaignId },
          });
          if (!promise) throw new NotFoundException('Promessa não encontrada.');
          if (promise.status !== 'OPEN')
            throw new ConflictException('Esta promessa já foi encerrada.');
          audienceId = promise.audienceId;
          before = promise;
          related = [promise.giverEntityId, promise.receiverEntityId];
          summary = `Promessa: ${op.reason}`;
        } else {
          audienceId = audience!.id;
          switch (op.kind) {
            case 'NOTE':
              summary = op.text;
              related = op.entityIds;
              break;
            case 'FACT_CREATE':
              summary = op.text;
              related = op.entityIds;
              break;
            case 'FACT_UPDATE':
            case 'CORRECTION': {
              const fact = await tx.storyFact.findFirst({
                where: { id: op.factId, campaignId },
                include: {
                  subjects: true,
                  revisions: { orderBy: { version: 'desc' }, take: 1 },
                },
              });
              if (!fact) throw new NotFoundException('Fato não encontrado.');
              if (fact.predicate !== 'ASSERTION')
                throw new ConflictException(
                  'Este fato acompanha o estado físico. Use os comandos da cena para alterá-lo.',
                );
              if (
                op.kind === 'FACT_UPDATE' &&
                (fact.classification === 'FIXED' || fact.kind === 'CLAIM')
              )
                throw new ConflictException(
                  'Fatos fixos e rumores exigem correção administrativa explícita.',
                );
              before = fact.revisions[0];
              correctsEventId =
                op.kind === 'CORRECTION'
                  ? fact.revisions[0].sourceEventId
                  : null;
              related = fact.subjects.map((s) => s.entityId);
              summary = `${op.text}\nMotivo: ${op.reason}`;
              break;
            }
            case 'RELATIONSHIP': {
              if (op.fromId === op.toId)
                throw new BadRequestException(
                  'Escolha duas entidades diferentes.',
                );
              related = [op.fromId, op.toId];
              summary = op.description;
              before = await tx.storyRelationship.findUnique({
                where: {
                  campaignId_fromEntityId_toEntityId: {
                    campaignId,
                    fromEntityId: op.fromId,
                    toEntityId: op.toId,
                  },
                },
              });
              break;
            }
            case 'PROMISE_CREATE': {
              if (op.giverId === op.receiverId)
                throw new BadRequestException(
                  'Escolha duas partes diferentes.',
                );
              related = [op.giverId, op.receiverId];
              summary = op.terms;
              break;
            }
            case 'THREAD_UPDATE': {
              const thread = await tx.storyThread.findFirst({
                where: { id: op.threadId, campaignId },
              });
              if (!thread)
                throw new NotFoundException('Fio narrativo não encontrado.');
              before = thread;
              summary = `${thread.objective}: ${op.reason}`;
              break;
            }
          }
        }
        await this.entities(tx, campaignId, related);
        const actor = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { displayName: true },
        });
        const event = await tx.storyEvent.create({
          data: {
            campaignId,
            sequence: lore.storySequence + 1,
            kind: op.kind,
            gameMinute: calendar.totalMinutes,
            actorKind: 'USER',
            actorUserId: userId,
            actorName: actor.displayName,
            requestKey: input.requestKey,
            requestHash,
            audienceId,
            summary,
            correctsEventId,
            payload: JSON.stringify({
              schemaVersion: 1,
              operation: op,
              before,
            }),
            entities: {
              create: [...new Set(related)].map((entityId) => ({
                entityId,
              })),
            },
          },
        });
        switch (op.kind) {
          case 'FACT_CREATE': {
            const f = await tx.storyFact.create({
              data: {
                campaignId,
                key: op.key,
                kind: op.factKind,
                classification: op.classification,
                subjects: {
                  create: op.entityIds.map((entityId) => ({
                    entityId,
                  })),
                },
              },
            });
            await tx.storyFactRevision.create({
              data: {
                campaignId,
                factId: f.id,
                version: 1,
                text: op.text,
                audienceId,
                sourceEventId: event.id,
              },
            });
            break;
          }
          case 'FACT_UPDATE':
          case 'CORRECTION': {
            const f = await tx.storyFact.update({
              where: { id: op.factId },
              data: { currentVersion: { increment: 1 } },
            });
            await tx.storyFactRevision.create({
              data: {
                campaignId,
                factId: f.id,
                version: f.currentVersion,
                text: op.text,
                audienceId,
                sourceEventId: event.id,
              },
            });
            break;
          }
          case 'DISCOVER':
            await tx.entityKnowledge.createMany({
              data: op.knowerIds.map((knowerEntityId) => ({
                campaignId,
                knowerEntityId,
                factRevisionId: op.revisionId,
                stance: op.stance,
                source: op.source,
                sourceEventId: event.id,
              })),
            });
            break;
          case 'RELATIONSHIP': {
            const data = {
              trust: op.trust,
              fear: op.fear,
              description: op.description,
              audienceId,
              sourceEventId: event.id,
            };
            await tx.storyRelationship.upsert({
              where: {
                campaignId_fromEntityId_toEntityId: {
                  campaignId,
                  fromEntityId: op.fromId,
                  toEntityId: op.toId,
                },
              },
              create: {
                campaignId,
                fromEntityId: op.fromId,
                toEntityId: op.toId,
                ...data,
              },
              update: data,
            });
            break;
          }
          case 'PROMISE_CREATE':
            await tx.storyPromise.create({
              data: {
                campaignId,
                giverEntityId: op.giverId,
                receiverEntityId: op.receiverId,
                terms: op.terms,
                audienceId,
                sourceEventId: event.id,
              },
            });
            break;
          case 'PROMISE_RESOLVE':
            await tx.storyPromise.update({
              where: { id: op.promiseId },
              data: {
                status: op.status,
                resolution: op.reason,
                sourceEventId: event.id,
              },
            });
            break;
          case 'THREAD_UPDATE':
            await tx.storyThread.update({
              where: { id: op.threadId },
              data: {
                status: op.status,
                resolution: op.reason,
                audienceId,
                sourceEventId: event.id,
              },
            });
            break;
        }
        const updated = await tx.campaignLore.update({
          where: { campaignId },
          data: { storySequence: { increment: 1 }, revision: { increment: 1 } },
        });
        await enqueueStory(tx, campaignId, event.id);
        return {
          eventId: event.id,
          revision: updated.revision,
          alreadyApplied: false,
        };
      },
      existingTx,
    );
  }

  correction(campaignId: string, userId: string, input: StoryCommand) {
    if (input.operation?.kind !== 'CORRECTION')
      throw new BadRequestException('Informe uma correção com motivo.');
    return this.command(campaignId, userId, input);
  }

  async state(
    campaignId: string,
    userId: string,
    query: { q?: string; entityId?: string } = {},
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const access = await this.access(tx, campaignId, userId);
        const lore = await tx.campaignLore.findUnique({
          where: { campaignId },
        });
        if (!lore) return { installed: false, initialized: false };
        if (!lore.storySequence)
          return { installed: true, initialized: false, master: access.master };
        const owned = await tx.campaignCharacter.findMany({
          where: { campaignId, character: { userId } },
        });
        if (
          !access.master &&
          query.entityId &&
          !owned.some((c) => c.entityId === query.entityId)
        )
          throw new ForbiddenException(
            'Conhecimento reservado ao personagem autorizado.',
          );
        const matches = (text: string) =>
          !query.q ||
          text
            .toLocaleLowerCase('pt-BR')
            .includes(query.q.toLocaleLowerCase('pt-BR'));
        const allFacts = await tx.storyFact.findMany({
          where: {
            campaignId,
            ...(query.entityId && access.master
              ? { subjects: { some: { entityId: query.entityId } } }
              : {}),
          },
          include: {
            subjects: { include: { entity: true } },
            revisions: {
              orderBy: { version: 'desc' },
              take: 1,
              include: { audience: { include: audienceInclude } },
            },
          },
          orderBy: { key: 'asc' },
        });
        const facts = allFacts.flatMap((f) => {
          const r = f.revisions[0];
          if (
            !r ||
            !canRead(r.audience, userId, access.master) ||
            !matches(r.text)
          )
            return [];
          return [
            {
              id: f.id,
              key: f.key,
              kind: f.kind,
              classification: f.classification,
              text: r.text,
              revisionId: r.id,
              ...(access.master
                ? {
                    version: r.version,
                    editable: f.predicate === 'ASSERTION',
                    evaluation: r.evaluation,
                    sourceEventId: r.sourceEventId,
                    audience: r.audience.scope,
                    subjects: f.subjects.map((s) => ({
                      id: s.entityId,
                      name: s.entity.name,
                    })),
                  }
                : {}),
            },
          ];
        });
        const observations = await tx.entityKnowledge.findMany({
          where: {
            campaignId,
            ...(access.master
              ? query.entityId
                ? { knowerEntityId: query.entityId }
                : {}
              : {
                  knowerEntityId: {
                    in: owned
                      .map((c) => c.entityId)
                      .filter((id) => !query.entityId || id === query.entityId),
                  },
                }),
          },
          include: {
            knower: true,
            revision: { include: { fact: true } },
            event: true,
          },
          orderBy: { event: { sequence: 'desc' } },
        });
        const seen = new Set<string>();
        const knowledge = observations.flatMap((k) => {
          const key = `${k.knowerEntityId}:${k.revision.factId}`;
          if (seen.has(key)) return [];
          seen.add(key);
          // Search only the last observation; older matches must not resurrect a superseded belief.
          if (!matches(k.revision.text)) return [];
          return [
            {
              id: k.id,
              knowerId: k.knowerEntityId,
              knowerName: k.knower.name,
              text: k.revision.text,
              kind: k.revision.fact.kind,
              stance: k.stance,
              source: k.source,
              ...(access.master
                ? {
                    factId: k.revision.factId,
                    revisionId: k.factRevisionId,
                    version: k.revision.version,
                    stale:
                      k.revision.version !== k.revision.fact.currentVersion,
                    sourceEventId: k.sourceEventId,
                  }
                : {}),
            },
          ];
        });
        const audience = visibleWhere(userId, access.master);
        const promises = await tx.storyPromise.findMany({
          where: { campaignId, audience },
          include: { giver: true, receiver: true },
          orderBy: { id: 'asc' },
        });
        const threads = await tx.storyThread.findMany({
          where: { campaignId, audience },
          orderBy: { key: 'asc' },
        });
        const relationships = await tx.storyRelationship.findMany({
          where: { campaignId, audience },
          include: { from: true, to: true },
        });
        return {
          installed: true,
          initialized: true,
          master: access.master,
          ...(access.master
            ? {
                revision: lore.revision,
                throughSequence: lore.storySequence,
                entities: await tx.campaignEntity.findMany({
                  where: { campaignId },
                  select: { id: true, name: true, kind: true, key: true },
                  orderBy: { name: 'asc' },
                }),
                members: access.members.map((m) => ({
                  id: m.userId,
                  name: m.user.displayName,
                })),
              }
            : {
                characters: await tx.campaignEntity.findMany({
                  where: { id: { in: owned.map((c) => c.entityId) } },
                  select: { id: true, name: true },
                }),
              }),
          facts,
          knowledge,
          promises: promises
            .filter((p) => matches(p.terms + (p.resolution || '')))
            .map((p) => ({
              id: p.id,
              giver: p.giver.name,
              receiver: p.receiver.name,
              terms: p.terms,
              status: p.status,
              resolution: p.resolution,
            })),
          threads: threads
            .filter((t) => matches(t.objective + (t.resolution || '')))
            .map((t) => ({
              id: t.id,
              objective: t.objective,
              status: t.status,
              resolution: t.resolution,
              ...(access.master
                ? { completion: t.completion, consequence: t.consequence }
                : {}),
            })),
          relationships: relationships
            .filter((r) => matches(r.description))
            .map((r) => ({
              id: r.id,
              from: r.from.name,
              to: r.to.name,
              description: r.description,
              ...(access.master ? { trust: r.trust, fear: r.fear } : {}),
            })),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 15000 },
    );
  }

  async events(
    campaignId: string,
    userId: string,
    query: { before?: string; q?: string; entityId?: string } = {},
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const { master } = await this.access(tx, campaignId, userId);
        const where: Prisma.StoryEventWhereInput = {
          campaignId,
          audience: visibleWhere(userId, master),
        };
        if (query.before) {
          const cursor = await tx.storyEvent.findFirst({
            where: { ...where, id: query.before },
          });
          if (!cursor) throw new NotFoundException('Registro não encontrado.');
          where.sequence = { lt: cursor.sequence };
        }
        if (query.entityId) {
          if (!master)
            throw new ForbiddenException(
              'Filtro de entidades reservado ao mestre.',
            );
          where.entities = { some: { entityId: query.entityId } };
        }
        if (query.q) where.summary = { contains: query.q };
        const rows = await tx.storyEvent.findMany({
          where,
          orderBy: { sequence: 'desc' },
          take: 51,
        });
        const page = rows.slice(0, 50);
        return {
          events: page.map((e) => ({
            id: e.id,
            kind: e.kind,
            summary: e.summary,
            gameMinute: e.gameMinute,
            recordedAt: e.recordedAt,
            ...(master
              ? {
                  sequence: e.sequence,
                  actorKind: e.actorKind,
                  actorName: e.actorName,
                  correctsEventId: e.correctsEventId,
                  payload: JSON.parse(e.payload) as unknown,
                }
              : {}),
          })),
          nextCursor: rows.length > 50 ? page.at(-1)!.id : null,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async factHistory(campaignId: string, userId: string, factId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.access(tx, campaignId, userId, true);
        const fact = await tx.storyFact.findFirst({
          where: { id: factId, campaignId },
          include: {
            revisions: {
              orderBy: { version: 'asc' },
              include: { event: true },
            },
          },
        });
        if (!fact) throw new NotFoundException('Fato não encontrado.');
        return fact;
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  // Context for an actor is intentionally narrower than the master's world view.
  // It never includes the current truth, truth labels, or a flag that reveals a
  // secret change after the actor's last observation.
  async actorKnowledge(campaignId: string, userId: string, entityId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const { master } = await this.access(tx, campaignId, userId);
        const entity = await tx.campaignEntity.findFirst({
          where: { id: entityId, campaignId },
          include: { character: { include: { character: true } } },
        });
        if (!master && entity?.character?.character.userId !== userId)
          throw new ForbiddenException(
            'Conhecimento reservado ao personagem autorizado.',
          );
        if (!entity || !['NPC', 'CHARACTER'].includes(entity.kind))
          throw new NotFoundException('Personagem não encontrado.');
        const rows = await tx.entityKnowledge.findMany({
          where: { campaignId, knowerEntityId: entityId },
          include: { revision: { include: { fact: true } }, event: true },
          orderBy: { event: { sequence: 'desc' } },
        });
        const seen = new Set<string>();
        return {
          entity: { id: entity.id, name: entity.name },
          knowledge: rows.flatMap((k) => {
            if (seen.has(k.revision.factId)) return [];
            seen.add(k.revision.factId);
            return [
              {
                text: k.revision.text,
                kind: k.revision.fact.kind,
                stance: k.stance,
                source: k.source,
                observationId: k.id,
              },
            ];
          }),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
