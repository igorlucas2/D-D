import type { LoreIssue, LorePack } from './lore.types';
import { sanitizeWalls, wallKey } from '../vtt/vision';
import { canReach } from '../vtt/movement';

export function validateLoreReferences(p: LorePack): LoreIssue[] {
  const issues: LoreIssue[] = [];
  const fail = (path: string, message: string) =>
    issues.push({ code: 'INVALID_REFERENCE', path, message });
  const index = <T extends { id: string }>(rows: T[], path: string) => {
    const result = new Map<string, T>();
    for (const row of rows) {
      if (result.has(row.id)) fail(path, `ID duplicado: ${row.id}.`);
      result.set(row.id, row);
    }
    return result;
  };
  const ref = (
    set: ReadonlyMap<string, unknown>,
    key: string | null,
    path: string,
  ) => {
    if (key !== null && !set.has(key))
      fail(path, `Referência inexistente: ${key}.`);
  };
  const noCycles = (
    rows: { id: string; parentId: string | null }[],
    path: string,
  ) => {
    const lookup = new Map(rows.map((r) => [r.id, r.parentId]));
    for (const row of rows) {
      const seen = new Set<string>();
      let key: string | null | undefined = row.id;
      while (key) {
        if (seen.has(key)) {
          fail(path, `Ciclo a partir de ${row.id}.`);
          break;
        }
        seen.add(key);
        key = lookup.get(key);
      }
    }
  };
  const e = p.entities;
  const all = index(
    [...e.places, ...e.factions, ...e.npcs, ...e.objects],
    'entities',
  );
  const places = index(e.places, 'entities.places');
  const npcs = index(e.npcs, 'entities.npcs');
  const factions = index(e.factions, 'entities.factions');
  const objects = index(e.objects, 'entities.objects');
  for (const place of e.places)
    ref(places, place.parentId, `place.${place.id}.parentId`);
  noCycles(e.places, 'entities.places');
  for (const npc of e.npcs) {
    ref(places, npc.placeId, `npc.${npc.id}.placeId`);
    ref(factions, npc.factionId, `npc.${npc.id}.factionId`);
  }
  for (const obj of e.objects)
    ref(places, obj.placeId, `object.${obj.id}.placeId`);
  for (const relation of e.relations) {
    ref(npcs, relation.from, 'relation.from');
    ref(npcs, relation.to, 'relation.to');
    if (relation.from === relation.to)
      fail('relations', 'Relação de NPC consigo mesmo.');
  }
  const facts = index(p.facts.facts, 'facts');
  const claims = index(p.facts.claims, 'claims');
  index([...p.facts.facts, ...p.facts.claims], 'facts/claims');
  for (const f of facts.values())
    for (const subject of f.subjects) ref(all, subject, `fact.${f.id}`);
  for (const c of claims.values())
    for (const f of c.factIds) ref(facts, f, `claim.${c.id}`);
  const knowledgeKeys = new Set<string>();
  for (const k of p.facts.knowledge) {
    ref(npcs, k.npcId, 'knowledge.npcId');
    // KNOWN facts and believed/suspected claims have distinct namespaces.
    ref(
      k.stance === 'KNOWS' ? facts : claims,
      k.targetId,
      `knowledge.${k.npcId}`,
    );
    const key = `${k.npcId}:${k.targetId}`;
    if (knowledgeKeys.has(key))
      fail('knowledge', `Conhecimento repetido ou contraditório: ${key}.`);
    knowledgeKeys.add(key);
  }
  index(p.history, 'history');
  for (const h of p.history) {
    if ((h.precision === 'APPROXIMATE_YEARS') !== (h.relativeMinutes === null))
      fail(
        `history.${h.id}`,
        'Data aproximada não pode inventar minuto exato.',
      );
    if (h.precision === 'DAY' && h.relativeMinutes! % 1440 !== 0)
      fail(`history.${h.id}`, 'Precisão de dia incompatível com minutos.');
  }
  const threads = index(p.threads.threads, 'threads');
  index(p.threads.clues, 'clues');
  for (const clue of p.threads.clues) {
    for (const f of clue.factIds) ref(facts, f, `clue.${clue.id}`);
    for (const a of clue.alternatives)
      ref(all, a.holderId, `clue.${clue.id}.holderId`);
    if (new Set(clue.alternatives.map((a) => a.holderId)).size < 2)
      fail(`clue.${clue.id}`, 'Exige ao menos duas fontes independentes.');
  }
  const pressures = index(p.threads.pressures, 'pressures');
  for (const pressure of pressures.values()) {
    ref(pressures, pressure.afterEventId, `pressure.${pressure.id}`);
    for (const subject of pressure.subjects)
      ref(all, subject, `pressure.${pressure.id}.subjects`);
  }
  noCycles(
    p.threads.pressures.map((r) => ({ id: r.id, parentId: r.afterEventId })),
    'pressures',
  );
  index(p.threads.repairs, 'repairs');
  for (const repair of p.threads.repairs) {
    ref(places, repair.placeId, `repair.${repair.id}`);
    ref(objects, repair.objectId, `repair.${repair.id}`);
  }
  for (const reward of p.threads.rewards) {
    ref(threads, reward.threadId, 'rewards');
    if (
      reward.kind === 'MONEY' &&
      (reward.enabled ||
        reward.quantity !== null ||
        reward.unit !== 'UNDEFINED')
    )
      fail('rewards', 'Recompensa monetária ainda não suportada.');
    if (
      reward.kind === 'LODGING' &&
      (reward.quantity === null || reward.unit !== 'DAYS')
    )
      fail('rewards', 'Hospedagem exige quantidade de dias.');
  }
  const atlas = p.atlas;
  const maps = index(atlas.maps, 'maps');
  const geometryIds = new Set<string>();
  for (const geometry of atlas.geometry) {
    const map = maps.get(geometry.mapId);
    if (!map || geometryIds.has(geometry.mapId)) {
      fail('geometry', 'Mapa inexistente ou geometria duplicada.');
      continue;
    }
    geometryIds.add(geometry.mapId);
    const walls = sanitizeWalls(geometry.walls, map.width, map.height);
    if (
      walls.length !== geometry.walls.length ||
      new Set(geometry.walls.map(wallKey)).size !== walls.length
    )
      fail('geometry', 'Paredes inválidas ou duplicadas.');
    if (geometry.entry.x >= map.width || geometry.entry.y >= map.height)
      fail('geometry.entry', 'Entrada fora do mapa.');
    const opened = walls.map((w) =>
      w.door ? { ...w, door: 'open' as const } : w,
    );
    for (const room of atlas.rooms.filter((r) => r.mapId === map.id))
      if (
        !canReach(
          { ...geometry.entry, size: 1 },
          room.x,
          room.y,
          map.width,
          map.height,
          opened,
        )
      )
        fail(
          'geometry',
          `Sala ${room.id} inacessível mesmo com portas abertas.`,
        );
  }
  for (const m of maps.values()) ref(maps, m.parentId, `map.${m.id}.parentId`);
  noCycles(atlas.maps, 'maps');
  const roots = atlas.maps.filter((m) => m.parentId === null);
  if (roots.length !== 1 || roots[0].kind !== 'REGION')
    fail('maps', 'Exige um mapa regional raiz.');
  index([...atlas.places, ...atlas.rooms], 'atlas.locations');
  const targets = new Set<string>();
  for (const point of [...atlas.places, ...atlas.rooms]) {
    ref(places, point.id, `atlas.${point.id}`);
    ref(maps, point.mapId, `atlas.${point.id}.mapId`);
    const map = maps.get(point.mapId);
    const width = 'width' in point ? point.width : 1;
    const height = 'height' in point ? point.height : 1;
    if (map && (point.x + width > map.width || point.y + height > map.height))
      fail(`atlas.${point.id}`, 'Coordenadas fora do mapa.');
  }
  for (const point of atlas.places) {
    if (point.targetMapId === null) continue;
    ref(maps, point.targetMapId, `atlas.${point.id}.targetMapId`);
    if (targets.has(point.targetMapId))
      fail('atlas.places', 'Mapa de destino repetido em hotspots.');
    targets.add(point.targetMapId);
    if (maps.get(point.targetMapId)?.parentId !== point.mapId)
      fail(`atlas.${point.id}`, 'Hotspot não aponta para mapa filho.');
  }
  for (const map of atlas.maps)
    if (map.parentId && !targets.has(map.id))
      fail(`map.${map.id}`, 'Mapa filho sem hotspot de entrada.');
  const routeKeys = new Set<string>();
  for (const route of [...atlas.routes, ...atlas.localTravel]) {
    ref(places, route.from, 'route.from');
    ref(places, route.to, 'route.to');
    const key = [route.from, route.to].sort().join(':');
    if (routeKeys.has(key) || route.from === route.to)
      fail('routes', 'Rota repetida ou com destino igual à origem.');
    routeKeys.add(key);
  }
  const regional = atlas.places
    .filter((p) => maps.get(p.mapId)?.kind === 'REGION')
    .map((p) => p.id);
  for (const route of atlas.routes)
    if (!regional.includes(route.from) || !regional.includes(route.to))
      fail('routes', 'Rota regional deve conectar lugares regionais.');
  for (const route of atlas.localTravel)
    if (
      places.get(route.to)?.parentId !== route.from &&
      places.get(route.from)?.parentId !== route.to
    )
      fail('localTravel', 'Deslocamento local deve conectar lugar e seu pai.');
  const reachable = new Set(regional.slice(0, 1));
  let previous = -1;
  while (previous !== reachable.size) {
    previous = reachable.size;
    for (const r of atlas.routes)
      if (reachable.has(r.from) || reachable.has(r.to)) {
        reachable.add(r.from);
        reachable.add(r.to);
      }
  }
  if (regional.some((id) => !reachable.has(id)))
    fail('routes', 'Lugares regionais desconectados.');
  index(p.encounters, 'encounters');
  for (const encounter of p.encounters) {
    ref(places, encounter.placeId, `encounter.${encounter.id}`);
    if (
      (encounter.availability === 'LATER_ARC') !==
      (encounter.placeId === null)
    )
      fail(
        `encounter.${encounter.id}`,
        'Reserva futura não pode entrar nos encontros iniciais.',
      );
  }
  const party = p.public.party;
  if (party.minPlayers > party.maxPlayers || party.startLevel > party.endLevel)
    fail('public.party', 'Intervalo inválido.');
  if (
    p.manifest.status === 'PUBLISHED' &&
    p.manifest.rules.publicationBlockers.length
  )
    fail('manifest.status', 'Publicação ainda contém pendências.');
  return issues;
}
