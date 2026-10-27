import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { deriveFieldsFromTotalMinutes } from '../world/world.service';
import { enqueueStory } from '../story/story-outbox';
import { initializeDomain, syncObjectFacts } from './object-facts';
import { processConsequences } from '../consequences/consequence-engine';
import {
  canonical,
  humanActor,
  validateGameOperation,
  type ActorContext,
  type GameOperation,
  type GameRequest,
} from './game-action.types';
type Tx = Prisma.TransactionClient;

@Injectable()
export class GameActionsService {
  constructor(private readonly prisma: PrismaService) {}
  private async access(tx: Tx, campaignId: string, userId: string) {
    const campaign = await tx.campaign.findUnique({
      where: { id: campaignId },
      include: { members: true, lore: true },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    const master = campaign.masterId === userId;
    if (!master && !campaign.members.some((m) => m.userId === userId))
      throw new ForbiddenException('Sem acesso à campanha.');
    return { campaign, master };
  }
  private async write<T>(
    campaignId: string,
    fn: (tx: Tx) => Promise<T>,
    existingTx?: Tx,
  ): Promise<T> {
    if (existingTx) return fn(existingTx);
    for (let n = 0; ; n++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM Campaign WHERE id = ${campaignId} FOR UPDATE`;
            return fn(tx);
          },
          { isolationLevel: 'Serializable', timeout: 30000, maxWait: 10000 },
        );
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2002'].includes(e.code)
        ) {
          if (e.code === 'P2034' && n < 2) continue;
          throw new ConflictException(
            'Conflito de estado. Atualize a cena antes de tentar novamente.',
          );
        }
        throw e;
      }
    }
  }
  async initialize(campaignId: string, actor: ActorContext) {
    const userId = humanActor(actor);
    return this.write(campaignId, async (tx) => {
      const { master, campaign } = await this.access(tx, campaignId, userId);
      if (!master)
        throw new ForbiddenException('Somente o mestre prepara os comandos.');
      if (!campaign.lore)
        throw new ConflictException('Instale o cenário primeiro.');
      await initializeDomain(tx, campaignId);
      return { ready: true };
    });
  }
  private async group(tx: Tx, campaignId: string, memberIds: string[]) {
    return tx.campaignCharacter.findMany({
      where: { campaignId, character: { userId: { in: memberIds } } },
      include: { character: true, entity: true },
    });
  }
  async state(campaignId: string, userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const { campaign, master } = await this.access(tx, campaignId, userId);
        if (!campaign.lore) return { installed: false, ready: false, master };
        if (!campaign.lore.domainVersion)
          return { installed: true, ready: false, master };
        const scene = await tx.sceneState.findUniqueOrThrow({
          where: { campaignId },
          include: { place: { include: { entity: true } } },
        });
        const members = [
          ...new Set([
            campaign.masterId,
            ...campaign.members.map((m) => m.userId),
          ]),
        ];
        const group = await this.group(tx, campaignId, members);
        const routes = await tx.travelRoute.findMany({
          where: {
            campaignId,
            fromEntityId: scene.placeEntityId,
            ...(!master ? { to: { map: { map: { published: true } } } } : {}),
          },
          include: {
            to: { include: { entity: true, map: { include: { map: true } } } },
          },
          orderBy: { minutes: 'asc' },
        });
        const recentResolved = await tx.gameAction.findMany({
          where: {
            campaignId,
            status: { not: 'PENDING' },
            ...(master ? {} : { requestedById: userId }),
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true },
        });
        const actions = await tx.gameAction.findMany({
          where: {
            campaignId,
            ...(master ? {} : { requestedById: userId }),
            OR: [
              { status: 'PENDING' },
              { id: { in: recentResolved.map((a) => a.id) } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          include: { requestedBy: { select: { displayName: true } } },
        });
        const clock = await tx.campaignCalendar.findUniqueOrThrow({
          where: { campaignId },
        });
        const objects = master
          ? await tx.campaignPlotObject.findMany({
              where: { campaignId },
              include: { entity: true, place: { include: { entity: true } } },
            })
          : [];
        return {
          installed: true,
          ready: true,
          master,
          ...(master ? { revision: campaign.lore.revision } : {}),
          scene: {
            placeId: scene.placeEntityId,
            placeName: scene.place.entity.name,
            revision: scene.revision,
            phase: scene.phase,
          },
          clock: {
            day: clock.currentDay,
            month: clock.currentMonth,
            year: clock.currentYear,
            hour: clock.currentHour,
            minute: clock.currentMinute,
            totalMinutes: clock.totalMinutes,
          },
          participants: group.map((p) => ({
            id: p.entityId,
            name: p.character.name,
            own: p.character.userId === userId,
          })),
          routes: routes.map((r) => ({
            id: r.id,
            name: r.to.entity.name,
            minutes: r.minutes,
            blocked: r.blocked,
            published: r.to.map?.map.published ?? false,
          })),
          ...(master
            ? {
                objects: objects.map((o) => ({
                  id: o.entityId,
                  name: o.entity.name,
                  placeId: o.placeEntityId,
                  placeName: o.place.entity.name,
                  portable: o.portable,
                  carrierId: o.carrierEntityId,
                  containerId: o.containerEntityId,
                })),
              }
            : {}),
          actions: actions.map((a) => ({
            id: a.id,
            requestedBy: a.requestedBy.displayName,
            own: a.requestedById === userId,
            status: a.status,
            operation: JSON.parse(a.operation) as GameOperation,
            stale: a.expectedSceneRevision !== scene.revision,
            createdAt: a.createdAt,
            eventId: a.eventId,
            decisionReason: a.decisionReason,
          })),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async request(
    campaignId: string,
    actor: ActorContext,
    input: GameRequest,
    existingTx?: Tx,
  ) {
    const userId = humanActor(actor);
    validateGameOperation(input.operation);
    const hash = createHash('sha256').update(canonical(input)).digest('hex');
    return this.write(
      campaignId,
      async (tx) => {
        const { campaign, master } = await this.access(tx, campaignId, userId);
        if (!campaign.lore?.domainVersion)
          throw new ConflictException(
            'Prepare os comandos do cenário primeiro.',
          );
        const existing = await tx.gameAction.findUnique({
          where: {
            campaignId_requestedById_requestKey: {
              campaignId,
              requestedById: userId,
              requestKey: input.requestKey,
            },
          },
        });
        if (existing) {
          if (existing.requestHash !== hash)
            throw new ConflictException(
              'Chave de solicitação já usada com outros dados.',
            );
          return {
            id: existing.id,
            status: existing.status,
            alreadyRequested: true,
          };
        }
        if (!master && !['TRAVEL', 'REST'].includes(input.operation.kind))
          throw new ForbiddenException('Esta ação é reservada ao mestre.');
        if (!master && !input.characterEntityId)
          throw new ForbiddenException('Escolha seu personagem da cena.');
        if (input.characterEntityId) {
          const character = await tx.campaignCharacter.findFirst({
            where: { campaignId, entityId: input.characterEntityId },
            include: { character: true },
          });
          if (!character || character.character.userId !== userId)
            throw new ForbiddenException(
              'Escolha um personagem seu nesta campanha.',
            );
        }
        const scene = await tx.sceneState.findUniqueOrThrow({
          where: { campaignId },
        });
        if (scene.revision !== input.expectedSceneRevision)
          throw new ConflictException(
            'A cena mudou. Confira a posição atual do grupo.',
          );
        if (input.operation.kind === 'TRAVEL') {
          const route = await tx.travelRoute.findFirst({
            where: {
              id: input.operation.routeId,
              campaignId,
              fromEntityId: scene.placeEntityId,
              ...(!master ? { to: { map: { map: { published: true } } } } : {}),
            },
          });
          if (!route)
            throw new NotFoundException('Rota não disponível nesta cena.');
          if (route.blocked) throw new ConflictException('Rota bloqueada.');
        }
        if (
          (await tx.gameAction.count({
            where: { campaignId, requestedById: userId, status: 'PENDING' },
          })) >= 10
        )
          throw new ConflictException(
            'Resolva ou cancele as solicitações pendentes antes de criar outras.',
          );
        const action = await tx.gameAction.create({
          data: {
            campaignId,
            requestedById: userId,
            characterEntityId: input.characterEntityId,
            requestKey: input.requestKey,
            requestHash: hash,
            expectedSceneRevision: scene.revision,
            originPlaceId: scene.placeEntityId,
            operation: canonical(input.operation),
          },
        });
        return {
          id: action.id,
          status: action.status,
          alreadyRequested: false,
        };
      },
      existingTx,
    );
  }
  async resolve(
    campaignId: string,
    actionId: string,
    actor: ActorContext,
    decision: {
      decision: 'COMMIT' | 'CANCEL' | 'REJECT';
      expectedRevision?: number;
      reason?: string;
    },
    existingTx?: Tx,
  ) {
    const userId = humanActor(actor);
    return this.write(
      campaignId,
      async (tx) => {
        const { campaign, master } = await this.access(tx, campaignId, userId);
        const action = await tx.gameAction.findFirst({
          where: { id: actionId, campaignId },
        });
        if (!action || (!master && action.requestedById !== userId))
          throw new NotFoundException('Solicitação não encontrada.');
        if (decision.decision !== 'CANCEL' && !master)
          throw new ForbiddenException(
            'Somente o mestre confirma ou recusa os efeitos.',
          );
        if (action.status !== 'PENDING') {
          const desired = {
            COMMIT: 'COMMITTED',
            CANCEL: 'CANCELLED',
            REJECT: 'REJECTED',
          }[decision.decision];
          if (action.status === desired)
            return {
              id: action.id,
              status: action.status,
              eventId: action.eventId,
              alreadyApplied: true,
            };
          throw new ConflictException('Esta solicitação já foi resolvida.');
        }
        if (decision.decision !== 'COMMIT') {
          await tx.gameAction.update({
            where: { id: actionId },
            data: {
              status: decision.decision === 'CANCEL' ? 'CANCELLED' : 'REJECTED',
              decisionReason: decision.reason?.trim() || null,
              resolvedAt: new Date(),
            },
          });
          return {
            id: action.id,
            status: decision.decision === 'CANCEL' ? 'CANCELLED' : 'REJECTED',
            eventId: null,
            alreadyApplied: false,
          };
        }
        const lore = campaign.lore;
        if (!lore?.domainVersion || decision.expectedRevision !== lore.revision)
          throw new ConflictException(
            'O mundo mudou. Atualize e revise a ação antes de confirmar.',
          );
        const members = [
          ...new Set([
            campaign.masterId,
            ...campaign.members.map((m) => m.userId),
          ]),
        ];
        if (!members.includes(action.requestedById))
          throw new ConflictException(
            'O solicitante não pertence mais à campanha.',
          );
        const scene = await tx.sceneState.findUniqueOrThrow({
          where: { campaignId },
          include: { place: { include: { entity: true } } },
        });
        if (
          scene.revision !== action.expectedSceneRevision ||
          scene.placeEntityId !== action.originPlaceId
        )
          throw new ConflictException(
            'Esta solicitação pertence a uma cena anterior. Cancele e proponha novamente.',
          );
        if (
          scene.phase !== 'EXPLORATION' ||
          (await tx.combatEncounter.findUnique({ where: { campaignId } }))
        )
          throw new ConflictException(
            'Encerre o combate e retome a exploração antes desta ação.',
          );
        const group = await this.group(tx, campaignId, members);
        if (!group.length)
          throw new ConflictException(
            'Vincule personagens à cena antes de agir.',
          );
        if (
          action.characterEntityId &&
          !group.some(
            (p) =>
              p.entityId === action.characterEntityId &&
              p.character.userId === action.requestedById,
          )
        )
          throw new ConflictException(
            'O personagem solicitante não participa mais da cena.',
          );
        const op = JSON.parse(action.operation) as GameOperation;
        validateGameOperation(op);
        if (
          group.some((p) => p.character.currentHp <= 0) &&
          ['TRAVEL', 'REST'].includes(op.kind)
        )
          throw new ConflictException(
            'Há personagem sem condições de agir. Resolva a situação com o mestre primeiro.',
          );
        const clock = await tx.campaignCalendar.findUniqueOrThrow({
          where: { campaignId },
        });
        let minutes = 0;
        let summary = '';
        let kind:
          | 'GROUP_TRAVEL'
          | 'GROUP_REST'
          | 'OBJECT_TAKEN'
          | 'OBJECT_DROPPED'
          | 'CLOCK_ADVANCED';
        let destinationId = scene.placeEntityId;
        let before: unknown = null;
        let changedObjects: string[] = [];
        const related = group.map((p) => p.entityId);
        const allObjects = await tx.campaignPlotObject.findMany({
          where: { campaignId },
          include: { entity: true },
        });
        const tree = (rootId: string) => {
          const result = new Set([rootId]);
          for (let n = 0; n < allObjects.length; n++)
            for (const o of allObjects)
              if (o.containerEntityId && result.has(o.containerEntityId))
                result.add(o.entityId);
          return [...result];
        };
        if (op.kind === 'TRAVEL') {
          const route = await tx.travelRoute.findFirst({
            where: {
              campaignId,
              id: op.routeId,
              fromEntityId: scene.placeEntityId,
            },
            include: {
              to: {
                include: { entity: true, map: { include: { map: true } } },
              },
            },
          });
          if (
            !route ||
            route.blocked ||
            route.minutes < 1 ||
            route.minutes > 1440
          )
            throw new ConflictException(
              'Rota indisponível ou duração inválida.',
            );
          if (!route.to.map?.map.published)
            throw new ConflictException(
              'Publique o mapa de destino antes de levar o grupo.',
            );
          destinationId = route.toEntityId;
          minutes = route.minutes;
          kind = 'GROUP_TRAVEL';
          summary = `O grupo viajou de ${scene.place.entity.name} para ${route.to.entity.name} em ${minutes} minutos.`;
          before = {
            placeId: scene.placeEntityId,
            totalMinutes: clock.totalMinutes,
          };
          related.push(destinationId, scene.placeEntityId);
          for (const o of allObjects.filter(
            (o) =>
              o.carrierEntityId &&
              group.some((p) => p.entityId === o.carrierEntityId),
          )) {
            if (o.placeEntityId !== scene.placeEntityId)
              throw new ConflictException(
                'Objeto carregado fora da cena; reconcilie sua posição.',
              );
            changedObjects.push(...tree(o.entityId));
          }
          changedObjects = [...new Set(changedObjects)];
          related.push(...changedObjects);
          if (changedObjects.length)
            await tx.campaignPlotObject.updateMany({
              where: { campaignId, entityId: { in: changedObjects } },
              data: { placeEntityId: destinationId },
            });
        } else if (op.kind === 'REST') {
          kind = 'GROUP_REST';
          minutes = op.type === 'LONG' ? 480 : 60;
          summary = `O grupo concluiu um descanso ${op.type === 'LONG' ? 'longo' : 'curto'} de ${minutes} minutos em ${scene.place.entity.name}.`;
          before = group.map((p) => ({
            characterId: p.characterId,
            currentHp: p.character.currentHp,
            tempHp: p.character.tempHp,
          }));
          if (op.type === 'LONG')
            for (const p of group) {
              await tx.character.update({
                where: { id: p.characterId },
                data: { currentHp: p.character.maxHp, tempHp: 0 },
              });
              await tx.characterSpellSlot.updateMany({
                where: { characterId: p.characterId },
                data: { used: 0 },
              });
            }
        } else if (op.kind === 'ADVANCE_TIME') {
          kind = 'CLOCK_ADVANCED';
          minutes = op.minutes;
          summary = `${minutes} minutos se passaram. ${op.reason}`;
          before = { totalMinutes: clock.totalMinutes };
        } else {
          const object = allObjects.find((o) => o.entityId === op.objectId);
          if (
            !object ||
            !object.portable ||
            object.placeEntityId !== scene.placeEntityId
          )
            throw new ConflictException(
              'Objeto transportável indisponível nesta cena.',
            );
          if (object.containerEntityId)
            throw new ConflictException(
              'Este objeto está dentro de um recipiente. Transporte o recipiente inteiro nesta fase.',
            );
          before = {
            objectId: object.entityId,
            placeId: object.placeEntityId,
            carrierId: object.carrierEntityId,
          };
          changedObjects = tree(object.entityId);
          related.push(...changedObjects);
          if (op.kind === 'TAKE_OBJECT') {
            if (object.carrierEntityId)
              throw new ConflictException('Este objeto já tem portador.');
            const carrier = group.find((p) => p.entityId === op.carrierId);
            if (!carrier || carrier.character.currentHp <= 0)
              throw new ConflictException(
                'Escolha um portador ativo nesta cena.',
              );
            await tx.campaignPlotObject.update({
              where: { entityId: object.entityId },
              data: { carrierEntityId: carrier.entityId },
            });
            kind = 'OBJECT_TAKEN';
            summary = `${carrier.character.name} passou a carregar ${object.entity.name}.`;
          } else {
            if (!object.carrierEntityId)
              throw new ConflictException(
                'Este objeto já está no lugar, sem portador.',
              );
            await tx.campaignPlotObject.update({
              where: { entityId: object.entityId },
              data: { carrierEntityId: null },
            });
            kind = 'OBJECT_DROPPED';
            summary = `${object.entity.name} foi deixado em ${scene.place.entity.name}.`;
          }
        }
        const totalMinutes = clock.totalMinutes + minutes;
        if (!Number.isSafeInteger(totalMinutes) || totalMinutes > 2147483647)
          throw new ConflictException('Limite do calendário atingido.');
        if (minutes) {
          const { totalDaysElapsed: _days, ...date } =
            deriveFieldsFromTotalMinutes(
              totalMinutes,
              JSON.parse(clock.daysPerMonth) as number[],
            );
          void _days;
          await tx.campaignCalendar.update({
            where: { campaignId },
            data: { totalMinutes, ...date },
          });
          await processConsequences(
            tx,
            campaignId,
            clock.totalMinutes,
            totalMinutes,
            [scene.placeEntityId, destinationId],
          );
        }
        if (['TRAVEL', 'REST'].includes(op.kind))
          for (const p of group) {
            const old = await tx.characterExplorationState.findUnique({
              where: { characterId: p.characterId },
            });
            if (old && old.campaignId !== campaignId)
              throw new ConflictException(
                'Personagem com exploração em outra campanha.',
              );
            const place = await tx.campaignPlace.findUniqueOrThrow({
              where: { entityId: destinationId },
            });
            const rest =
              op.kind === 'REST'
                ? {
                    actionPoints: old?.maxActionPoints ?? 6,
                    fatigue:
                      op.type === 'LONG'
                        ? 0
                        : Math.max(0, (old?.fatigue ?? 0) - 1),
                    lastRestAtMinutes: totalMinutes,
                  }
                : {};
            await tx.characterExplorationState.upsert({
              where: { characterId: p.characterId },
              create: {
                campaignId,
                characterId: p.characterId,
                currentMapId: place.mapId,
                ...rest,
              },
              update: { currentMapId: place.mapId, ...rest },
            });
          }
        const visibility = 'visibility' in op ? op.visibility : 'PUBLIC';
        const audience = await tx.storyAudience.create({
          data: { campaignId, scope: visibility },
        });
        const actorRow = await tx.user.findUniqueOrThrow({
          where: { id: userId },
        });
        const event = await tx.storyEvent.create({
          data: {
            campaignId,
            sequence:
              (
                await tx.campaignLore.findUniqueOrThrow({
                  where: { campaignId },
                })
              ).storySequence + 1,
            kind,
            gameMinute: totalMinutes,
            actorKind: 'USER',
            actorUserId: userId,
            actorName: actorRow.displayName,
            audienceId: audience.id,
            summary,
            payload: JSON.stringify({
              schemaVersion: 1,
              actionId,
              requestedById: action.requestedById,
              operation: op,
              before,
              result: {
                placeId: destinationId,
                totalMinutes,
                objectIds: changedObjects,
              },
            }),
            entities: {
              create: [...new Set(related)].map((entityId) => ({ entityId })),
            },
          },
        });
        if (changedObjects.length)
          await syncObjectFacts(tx, campaignId, event.id, changedObjects);
        if (['TRAVEL', 'REST', 'ADVANCE_TIME'].includes(op.kind))
          await tx.sceneState.update({
            where: { campaignId },
            data: { placeEntityId: destinationId, revision: { increment: 1 } },
          });
        await tx.campaignLore.update({
          where: { campaignId },
          data: { revision: { increment: 1 }, storySequence: { increment: 1 } },
        });
        await tx.gameAction.update({
          where: { id: actionId },
          data: {
            status: 'COMMITTED',
            eventId: event.id,
            resolvedAt: new Date(),
          },
        });
        await enqueueStory(tx, campaignId, event.id);
        return {
          id: actionId,
          status: 'COMMITTED',
          eventId: event.id,
          alreadyApplied: false,
        };
      },
      existingTx,
    );
  }
}
