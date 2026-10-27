import {
  mkdtempSync,
  cpSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BUNDLED_PACKS } from './bundled-packs';
import {
  assertLoreSchema,
  CONTENT_ROOT,
  LorePackLoader,
  LorePackNotFoundError,
  LoreValidationError,
  sha256,
} from './lore.loader';
import { LoreService } from './lore.service';
import { validateLoreReferences } from './lore.validation';
import type { LorePack } from './lore.types';

const loader = new LorePackLoader();
const load = () => loader.load('eldoria-tres-sinos', '1.0.0').pack;
function cleanupFixture(temp: string) {
  if (
    dirname(temp) !== resolve(tmpdir()) ||
    !temp.includes('eldoria-lore-test-')
  )
    throw new Error('Unsafe fixture cleanup');
  rmSync(temp, { recursive: true, force: true });
}

describe('Bundled lore integrity and editorial continuity', () => {
  it('loads the complete draft with maps and exactly the expected catalog bindings', () => {
    const p = load();
    expect(p.manifest.status).toBe('DRAFT');
    expect(p.entities.npcs).toHaveLength(8);
    expect(p.encounters).toHaveLength(8);
    expect(p.atlas.maps).toHaveLength(3);
    expect(p.threads.threads).toHaveLength(4);
    expect(validateLoreReferences(p)).toEqual([]);
  });

  it('preserves every editorial canon fact, NPC profile and atlas coordinate', () => {
    const p = load();
    const editorial = readFileSync(
      resolve(CONTENT_ROOT, '../../docs/lore/01-pacto-dos-tres-sinos.md'),
      'utf8',
    );
    for (const [, id, text] of editorial.matchAll(
      /^\| (C\d+) \| (.+?) \| .+? \|$/gm,
    ))
      expect(p.facts.facts.find((f) => f.id === id)?.text).toBe(text);
    for (const npc of p.entities.npcs) {
      expect(editorial).toContain(npc.name);
      expect(editorial).toContain(npc.knowledgeBoundary);
      expect(editorial).toContain(npc.voice);
    }
    const atlas = JSON.parse(
      readFileSync(resolve(CONTENT_ROOT, '../../docs/lore/atlas.json'), 'utf8'),
    ) as LorePack['atlas'];
    expect(p.atlas.places).toEqual(atlas.places);
    expect(p.atlas.rooms).toEqual(atlas.rooms);
    expect(p.atlas.routes).toEqual(atlas.routes);
    for (const source of p.manifest.sources.filter((s) => s.sha256))
      expect(
        sha256(readFileSync(resolve(CONTENT_ROOT, '../..', source.reference))),
      ).toBe(source.sha256);
  });

  it('keeps observations narrower than the mastermind secret and distinguishes beliefs', () => {
    const p = load();
    expect(
      p.facts.knowledge
        .filter((k) => k.npcId === 'bento')
        .map((k) => k.targetId),
    ).toEqual(['F05', 'F08']);
    expect(
      p.facts.knowledge
        .filter((k) => k.npcId === 'dalia')
        .map((k) => k.targetId),
    ).not.toContain('C05');
    expect(p.facts.knowledge).toContainEqual(
      expect.objectContaining({
        npcId: 'iria',
        targetId: 'R01',
        stance: 'BELIEVES',
      }),
    );
    expect(p.facts.claims.find((c) => c.id === 'R01')?.truth).toBe('FALSE');
    expect(
      p.threads.clues.find((c) => c.id === 'pista-retirada')?.factIds,
    ).toEqual(['F09']);
  });

  it('keeps arrival relative to actual departure and monetary rewards disabled', () => {
    const p = load();
    expect(p.threads.pressures.find((r) => r.id === 'chegada')).toMatchObject({
      afterEventId: 'partida',
      afterMinutes: 90,
    });
    expect(p.threads.rewards.find((r) => r.kind === 'MONEY')).toMatchObject({
      enabled: false,
      quantity: null,
    });
    expect(p.threads.repairs.map((r) => r.minutes)).toEqual([30, 20, 20, 20]);
    expect(
      p.encounters
        .filter((e) => e.availability === 'LATER_ARC')
        .map((e) => e.id),
    ).toEqual(['specter', 'dire-wolf']);
  });

  it('rejects unknown versions and traversal without reading them', () => {
    expect(() => loader.load('../..', '1.0.0')).toThrow(LorePackNotFoundError);
    expect(() => loader.load('eldoria-tres-sinos', '2.0.0')).toThrow(
      LorePackNotFoundError,
    );
  });

  it('rejects undeclared fields, unsafe paths and invalid numeric values', () => {
    const p = load();
    expect(() =>
      assertLoreSchema('public', { ...p.public, secret: 'C05' }),
    ).toThrow(LoreValidationError);
    p.manifest.files[0].path = '../facts.json';
    expect(() => assertLoreSchema('manifest', p.manifest)).toThrow(
      LoreValidationError,
    );
    p.atlas.routes[0].minutes = 0;
    expect(() => assertLoreSchema('atlas', p.atlas)).toThrow(
      LoreValidationError,
    );
  });

  it.each<[string, (p: LorePack) => void]>([
    [
      'duplicate identity',
      (p) => {
        p.entities.npcs[0].id = 'porto';
      },
    ],
    [
      'missing NPC location',
      (p) => {
        p.entities.npcs[0].placeId = 'missing';
      },
    ],
    [
      'invalid fact subject',
      (p) => {
        p.facts.facts[0].subjects = ['missing'];
      },
    ],
    [
      'false belief presented as knowledge',
      (p) => {
        p.facts.knowledge.push({
          npcId: 'iria',
          targetId: 'R01',
          stance: 'KNOWS',
          source: 'invalid',
        });
      },
    ],
    [
      'duplicate knowledge',
      (p) => {
        p.facts.knowledge.push(p.facts.knowledge[0]);
      },
    ],
    [
      'map cycle',
      (p) => {
        p.atlas.maps[0].parentId = 'porto';
      },
    ],
    [
      'place cycle',
      (p) => {
        p.entities.places[0].parentId = 'taverna';
      },
    ],
    [
      'out of bounds room',
      (p) => {
        p.atlas.rooms[0].width = 100;
      },
    ],
    [
      'hotspot to unrelated map',
      (p) => {
        p.atlas.places[0].targetMapId = 'vale';
      },
    ],
    [
      'route in reverse repeated',
      (p) => {
        p.atlas.routes.push({
          ...p.atlas.routes[0],
          from: 'ponte',
          to: 'porto',
        });
      },
    ],
    [
      'disconnected region',
      (p) => {
        p.atlas.routes = [];
      },
    ],
    [
      'pressure dependency cycle',
      (p) => {
        p.threads.pressures[1].afterEventId = 'chegada';
      },
    ],
    [
      'invalid clue source',
      (p) => {
        p.threads.clues[0].alternatives[0].holderId = 'missing';
      },
    ],
    [
      'publication with blockers',
      (p) => {
        p.manifest.status = 'PUBLISHED';
      },
    ],
    [
      'money enabled',
      (p) => {
        p.threads.rewards[1].enabled = true;
      },
    ],
  ])('rejects %s', (_name, mutate) => {
    const p = load();
    mutate(p);
    expect(validateLoreReferences(p).length).toBeGreaterThan(0);
  });

  it('rejects content and manifest tampering, missing assets, and disclosure in the manifest', () => {
    const temp = mkdtempSync(join(tmpdir(), 'eldoria-lore-test-'));
    const packDir = join(temp, 'eldoria-tres-sinos', '1.0.0');
    try {
      cpSync(CONTENT_ROOT, temp, { recursive: true });
      const testLoader = new LorePackLoader(temp);
      const factsFile = join(packDir, 'facts.json');
      const original = readFileSync(factsFile);
      writeFileSync(factsFile, '{}');
      expect(() => testLoader.load('eldoria-tres-sinos', '1.0.0')).toThrow(
        LoreValidationError,
      );
      writeFileSync(factsFile, original);
      const manifestPath = join(packDir, 'manifest.json');
      const manifest = load().manifest;
      manifest.files.find((f) => f.path === 'facts.json')!.audience = 'PUBLIC';
      writeFileSync(manifestPath, JSON.stringify(manifest));
      expect(() => testLoader.load('eldoria-tres-sinos', '1.0.0')).toThrow(
        LoreValidationError,
      );
      const repinned = new LorePackLoader(temp, [
        {
          ...BUNDLED_PACKS[0],
          manifestSha256: sha256(readFileSync(manifestPath)),
        },
      ]);
      expect(() => repinned.load('eldoria-tres-sinos', '1.0.0')).toThrow(
        LoreValidationError,
      );
      cpSync(
        join(CONTENT_ROOT, 'eldoria-tres-sinos/1.0.0/manifest.json'),
        manifestPath,
      );
      rmSync(join(packDir, 'assets/vale-do-lume.png'));
      expect(() => testLoader.load('eldoria-tres-sinos', '1.0.0')).toThrow(
        LoreValidationError,
      );
    } finally {
      // Only remove the explicit fixture created by mkdtemp, within the OS temp root.
      cleanupFixture(temp);
    }
  });
});

describe('Lore permissions, catalog and read-only preview', () => {
  const db = {
    campaign: { findUnique: jest.fn() },
    monster: { findMany: jest.fn() },
  };
  let service: LoreService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new LoreService(db as unknown as PrismaService, loader);
    db.campaign.findUnique.mockResolvedValue({
      id: 'campaign',
      name: 'Teste',
      masterId: 'master',
      _count: { members: 1, vttMaps: 0 },
      worldCalendar: null,
      combatEncounter: null,
    });
    const p = load();
    db.monster.findMany.mockResolvedValue([
      ...new Map(
        [
          ...p.entities.npcs.map((n) => n.catalog),
          ...p.encounters.map((e) => e.catalog),
        ].map((b) => [
          `${b.source}:${b.srdIndex}`,
          { ...b, id: b.srdIndex, name: b.srdIndex },
        ]),
      ).values(),
    ]);
  });
  it('public response has only public content and never private counts, sources or identities', () => {
    const result = service.listPublic()[0];
    expect(Object.keys(result).sort()).toEqual(
      ['packId', 'version', 'status', ...Object.keys(load().public)].sort(),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /C05|caixote|Oren|Mara|Bento está vivo|publicationBlockers/,
    );
  });
  it('hides validation errors from public listing', () => {
    const broken = {
      list: () => {
        throw new Error('secret path');
      },
    } as unknown as LorePackLoader;
    expect(() =>
      new LoreService(db as unknown as PrismaService, broken).listPublic(),
    ).toThrow(ServiceUnavailableException);
  });
  it('checks campaign ownership before loading private lore or catalog', async () => {
    const spy = jest.spyOn(loader, 'load');
    await expect(
      service.preview('campaign', 'player', 'eldoria-tres-sinos', '1.0.0'),
    ).rejects.toThrow(ForbiddenException);
    expect(spy).not.toHaveBeenCalled();
    expect(db.monster.findMany).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it('returns 404 for missing campaigns and packages', async () => {
    await expect(
      service.preview('campaign', 'master', 'unknown', '1.0.0'),
    ).rejects.toThrow(NotFoundException);
    db.campaign.findUnique.mockResolvedValue(null);
    await expect(
      service.preview('missing', 'master', 'eldoria-tres-sinos', '1.0.0'),
    ).rejects.toThrow(NotFoundException);
  });
  it('resolves 16 identities, keeps commoner NPCs distinct and never claims installation', async () => {
    const preview = await service.preview(
      'campaign',
      'master',
      'eldoria-tres-sinos',
      '1.0.0',
    );
    expect(preview.validation).toMatchObject({
      catalogValid: true,
      campaignEligible: true,
      canInstall: false,
      conflicts: [],
    });
    expect(preview.bindings).toHaveLength(16);
    expect(
      preview.bindings
        .filter((b) => b.srdIndex === 'commoner')
        .map((b) => b.entityId),
    ).toEqual(['nara', 'bento']);
    expect(db.campaign.findUnique).toHaveBeenCalledTimes(1);
    expect(db.monster.findMany).toHaveBeenCalledTimes(1);
  });
  it('blocks missing, ambiguous and non-exact catalog origins without name fallback', async () => {
    const rows = [
      { id: '1', source: 'dnd5eapi-2014', srdIndex: 'commoner', name: 'A' },
      { id: '2', source: 'dnd5eapi-2014', srdIndex: 'commoner', name: 'B' },
      { id: '3', source: 'local', srdIndex: 'guard', name: 'Guarda' },
      { id: '4', source: 'DND5EAPI-2014', srdIndex: 'goblin', name: 'Duende' },
    ];
    db.monster.findMany.mockResolvedValue(rows);
    const p = await service.preview(
      'campaign',
      'master',
      'eldoria-tres-sinos',
      '1.0.0',
    );
    expect(p.validation.catalogValid).toBe(false);
    expect(p.bindings.find((b) => b.entityId === 'nara')).toMatchObject({
      status: 'AMBIGUOUS',
      monsterId: null,
    });
    expect(p.bindings.find((b) => b.entityId === 'iria')?.status).toBe(
      'MISSING',
    );
    expect(p.bindings.find((b) => b.entityId === 'sava')?.status).toBe(
      'MISSING',
    );
  });
  it('reports populated campaign conflict without overwriting anything', async () => {
    db.campaign.findUnique.mockResolvedValue({
      id: 'campaign',
      name: 'Teste',
      masterId: 'master',
      _count: { members: 2, vttMaps: 3 },
      worldCalendar: null,
      combatEncounter: null,
    });
    const p = await service.preview(
      'campaign',
      'master',
      'eldoria-tres-sinos',
      '1.0.0',
    );
    expect(p.validation.campaignEligible).toBe(false);
    expect(p.validation.conflicts).toContainEqual(
      expect.objectContaining({ code: 'CAMPAIGN_NOT_EMPTY' }),
    );
  });
});
