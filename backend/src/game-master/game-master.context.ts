import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Proposal, TurnKind } from './proposal';
type Tx = Prisma.TransactionClient;
export interface Source {
  id: string;
  text: string;
  revisionId?: string;
  npcId?: string;
  stance?: string;
  classification?: string;
}
export interface CopilotContext {
  kind: TurnKind;
  prompt: string;
  revision: number;
  sceneRevision: number;
  epoch: number;
  scene: { id: string; name: string; phase: string; gameMinute: number };
  participants: { id: string; name: string }[];
  routes: { id: string; name: string; minutes: number }[];
  sources: Source[];
  npc?: { id: string; name: string; voice: string; objective: string };
  rules: string;
  retrieval?: { omittedMutableFacts: number; policy: string };
  conversation?: { player: string; reply: string }[];
  conversationOmitted?: boolean;
}
@Injectable()
export class GameMasterContext {
  async build(
    tx: Tx,
    campaignId: string,
    kind: TurnKind,
    prompt: string,
    focusId?: string,
  ): Promise<CopilotContext> {
    const lore = await tx.campaignLore.findUniqueOrThrow({
      where: { campaignId },
      include: { campaign: { include: { members: true } } },
    });
    const scene = await tx.sceneState.findUniqueOrThrow({
      where: { campaignId },
      include: { place: { include: { entity: true } } },
    });
    const calendar = await tx.campaignCalendar.findUniqueOrThrow({
      where: { campaignId },
    });
    const memberIds = [
      lore.campaign.masterId,
      ...lore.campaign.members.map((m) => m.userId),
    ];
    const participants = await tx.campaignCharacter.findMany({
      where: { campaignId, character: { userId: { in: memberIds } } },
      include: { character: true },
    });
    const routes = await tx.travelRoute.findMany({
      where: {
        campaignId,
        fromEntityId: scene.placeEntityId,
        blocked: false,
        to: { map: { map: { published: true } } },
      },
      include: { to: { include: { entity: true } } },
      orderBy: { id: 'asc' },
    });
    const context: CopilotContext = {
      kind,
      prompt,
      revision: lore.revision,
      sceneRevision: scene.revision,
      epoch: lore.aiEpoch,
      scene: {
        id: scene.placeEntityId,
        name: scene.place.entity.name,
        phase: scene.phase,
        gameMinute: calendar.totalMinutes,
      },
      participants: participants.map((p) => ({
        id: p.entityId,
        name: p.character.name,
      })),
      routes: routes.map((r) => ({
        id: r.id,
        name: r.to.entity.name,
        minutes: r.minutes,
      })),
      sources: [],
      rules:
        kind === 'PLAN'
          ? 'Somente propostas de TRAVEL, REST ou DISCOVER; ANSWER/ASK para consulta. Viagem soma minutos uma vez por grupo. Descanso SHORT=60min sem cura; LONG=480min com recuperação. Combate e PV zero impedem viagem/descanso.'
          : 'Somente ANSWER/ASK, sem efeitos mecânicos ou descoberta automática.',
    };
    if (focusId) {
      const npc = await tx.campaignNpc.findFirst({
        where: {
          campaignId,
          entityId: focusId,
          placeEntityId: scene.placeEntityId,
          activeJourneyId: null,
        },
        include: { entity: true },
      });
      if (!npc)
        throw new NotFoundException('NPC não está presente nesta cena.');
      context.npc = {
        id: npc.entityId,
        name: npc.entity.name,
        voice: npc.voice,
        objective: npc.objective,
      };
      const known = await tx.entityKnowledge.findMany({
        where: { campaignId, knowerEntityId: focusId },
        include: { revision: { include: { fact: true } }, event: true },
        orderBy: { event: { sequence: 'desc' } },
      });
      const seen = new Set<string>();
      for (const k of known) {
        if (seen.has(k.revision.factId)) continue;
        seen.add(k.revision.factId);
        context.sources.push({
          id: `K:${k.id}`,
          text: k.revision.text,
          revisionId: k.factRevisionId,
          npcId: focusId,
          stance: k.stance,
        });
      }
    } else if (kind === 'NPC')
      throw new ConflictException('Escolha o NPC presente para conversar.');
    if (kind === 'PUBLIC' && focusId)
      throw new ConflictException(
        'A narração pública não recebe contexto privado de NPC.',
      );
    if (kind !== 'NPC') {
      const facts = await tx.storyFact.findMany({
        where: { campaignId },
        include: {
          revisions: {
            orderBy: { version: 'desc' },
            take: 1,
            include: { audience: true },
          },
        },
        orderBy: { key: 'asc' },
      });
      const fold = (text: string) =>
        text
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
      const terms = [
        ...new Set(
          fold(prompt)
            .split(/[^a-z0-9]+/)
            .filter(
              (w) =>
                w.length >= 4 &&
                ![
                  'como',
                  'onde',
                  'para',
                  'pelo',
                  'pela',
                  'sobre',
                  'quero',
                  'proponha',
                  'grupo',
                  'contexto',
                ].includes(w),
            ),
        ),
      ];
      const score = (text: string) =>
        terms.reduce((sum, w) => sum + (fold(text).includes(w) ? 1 : 0), 0);
      const mutable = facts
        .filter((f) => f.classification !== 'FIXED')
        .sort(
          (a, b) =>
            score(b.revisions[0]?.text ?? '') -
            score(a.revisions[0]?.text ?? ''),
        );
      const selected = new Set(mutable.slice(0, 6).map((f) => f.id));
      context.retrieval = {
        omittedMutableFacts:
          kind === 'PLAN' ? Math.max(0, mutable.length - selected.size) : 0,
        policy:
          'Todos os fatos fixos autorizados; até seis estados mutáveis por correspondência de termos. Se faltar um estado, peça consulta mais específica, não invente.',
      };
      for (const f of facts) {
        const r = f.revisions[0];
        if (!r || (kind === 'PUBLIC' && r.audience.scope !== 'PUBLIC'))
          continue;
        if (
          kind === 'PLAN' &&
          f.classification !== 'FIXED' &&
          !selected.has(f.id)
        )
          continue;
        context.sources.push({
          id: `F:${f.key}:${r.version}`,
          text: r.text,
          classification: f.kind === 'CLAIM' ? 'RUMOR' : f.classification,
          stance: f.kind === 'CLAIM' ? 'BELIEVED' : undefined,
        });
      }
      if (kind === 'PLAN') {
        const threads = await tx.storyThread.findMany({
          where: { campaignId, status: 'OPEN' },
          orderBy: { key: 'asc' },
        });
        const promises = await tx.storyPromise.findMany({
          where: { campaignId, status: 'OPEN' },
          orderBy: { id: 'asc' },
        });
        for (const t of threads
          .sort((a, b) => score(b.objective) - score(a.objective))
          .slice(0, 2))
          context.sources.push({
            id: `T:${t.id}`,
            text: `Fio aberto: ${t.objective}. Condição: ${t.completion}`,
          });
        for (const p of promises
          .sort((a, b) => score(b.terms) - score(a.terms))
          .slice(0, 3))
          context.sources.push({
            id: `P:${p.id}`,
            text: `Promessa aberta: ${p.terms}`,
          });
      }
      const events = await tx.storyEvent.findMany({
        where: {
          campaignId,
          ...(kind === 'PUBLIC' ? { audience: { scope: 'PUBLIC' } } : {}),
        },
        orderBy: { sequence: 'desc' },
        take: 2,
      });
      for (const e of events)
        context.sources.push({
          id: `E:${e.id}`,
          text: `Acontecimento aos ${e.gameMinute}min: ${e.summary}`,
        });
    }
    // Never silently truncate canonical facts/knowledge to fit. Ask for a smaller context instead.
    while (
      Buffer.byteLength(JSON.stringify(context), 'utf8') > 10000 &&
      context.sources.some((s) => s.id.startsWith('E:'))
    ) {
      const index = context.sources.findLastIndex((s) => s.id.startsWith('E:'));
      context.sources.splice(index, 1);
    }
    if (Buffer.byteLength(JSON.stringify(context), 'utf8') > 10000)
      throw new ConflictException(
        'Contexto excede o limite local. Reduza o pedido ou use a consulta de um NPC específico.',
      );
    return context;
  }
  validate(context: CopilotContext, p: Proposal) {
    const fail = () => {
      throw new Error('UNSUPPORTED_PROPOSAL');
    };
    if (p.evidenceIds.some((id) => !context.sources.some((s) => s.id === id)))
      fail();
    if (p.kind === 'ANSWER' && p.evidenceIds.length === 0) fail();
    if (context.kind !== 'PLAN' && !['ANSWER', 'ASK'].includes(p.kind)) fail();
    if (p.kind !== 'TRAVEL' && p.routeId !== null) fail();
    if (p.kind !== 'REST' && p.restType !== null) fail();
    if (
      p.kind !== 'DISCOVER' &&
      (p.revisionId !== null || p.sourceNpcId !== null || p.knowerIds.length)
    )
      fail();
    if (p.kind === 'TRAVEL' && !context.routes.some((r) => r.id === p.routeId))
      fail();
    if (p.kind === 'REST' && !p.restType) fail();
    if (p.kind === 'DISCOVER') {
      const source = context.sources.find(
        (s) =>
          s.npcId === p.sourceNpcId &&
          s.revisionId === p.revisionId &&
          p.evidenceIds.includes(s.id),
      );
      if (
        !source ||
        !p.knowerIds.length ||
        p.knowerIds.some((id) => !context.participants.some((c) => c.id === id))
      )
        fail();
    }
  }
}
