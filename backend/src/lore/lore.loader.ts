import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { BUNDLED_PACKS } from './bundled-packs';
import { loreValidators } from './lore.schema';
import type { LoreIssue, LorePack, Manifest } from './lore.types';
import { validateLoreReferences } from './lore.validation';

export class LoreValidationError extends Error {
  constructor(public readonly issues: LoreIssue[]) {
    super('Pacote de lore inválido.');
  }
}
export class LorePackNotFoundError extends Error {}
export const sha256 = (data: Buffer | string) =>
  createHash('sha256').update(data).digest('hex');
export const CONTENT_ROOT = resolve(__dirname, '../../content');
// Source: src/lore -> backend/content. Compiled: dist/src/lore -> dist/content.
// Nest copies content into dist/content as a build asset.

export function assertLoreSchema<T>(
  key: keyof LorePack,
  value: unknown,
): asserts value is T {
  const validate = loreValidators[key];
  if (!validate(value))
    throw new LoreValidationError(
      (validate.errors ?? []).map((e) => ({
        code: 'INVALID_SCHEMA',
        path: `${key}${e.instancePath}`,
        message: e.message ?? 'Schema inválido.',
      })),
    );
}

export class LorePackLoader {
  constructor(
    private readonly root = CONTENT_ROOT,
    private readonly registry = BUNDLED_PACKS,
  ) {}

  list() {
    return this.registry.map((entry) => this.load(entry.packId, entry.version));
  }

  load(
    packId: string,
    version: string,
  ): { pack: LorePack; contentHash: string; textures: Map<string, Buffer> } {
    const entry = this.registry.find(
      (r) => r.packId === packId && r.version === version,
    );
    if (!entry) throw new LorePackNotFoundError();
    const issue = (code: string, path: string, message: string): never => {
      throw new LoreValidationError([{ code, path, message }]);
    };
    try {
      const root = realpathSync(this.root);
      const dir = join(root, entry.packId, entry.version);
      const inside = (base: string, path: string) => {
        const rel = relative(base, path);
        return (
          rel !== '..' &&
          !rel.startsWith('..\\') &&
          !rel.startsWith('../') &&
          !isAbsolute(rel)
        );
      };
      if (!inside(root, realpathSync(dir)))
        issue(
          'INVALID_PATH',
          'manifest',
          'Pacote fora do diretório permitido.',
        );
      const read = (name: string) => {
        const path = realpathSync(join(dir, name));
        if (!inside(realpathSync(dir), path))
          issue('INVALID_PATH', name, 'Arquivo fora do pacote.');
        if (!statSync(path).isFile() || statSync(path).size > 5 * 1024 * 1024)
          issue('INVALID_FILE', name, 'Arquivo inválido ou grande demais.');
        return readFileSync(path);
      };
      const raw = read('manifest.json');
      const contentHash = sha256(raw);
      if (contentHash !== entry.manifestSha256)
        issue(
          'INTEGRITY',
          'manifest',
          'Manifesto diverge do registro aprovado.',
        );
      const manifest: unknown = JSON.parse(raw.toString('utf8'));
      assertLoreSchema<Manifest>('manifest', manifest);
      if (manifest.packId !== packId || manifest.version !== version)
        issue('IDENTITY', 'manifest', 'Identidade do pacote divergente.');
      const files = new Map<string, Buffer>();
      for (const file of manifest.files) {
        if (files.has(file.path) || file.path === 'manifest.json')
          issue('DUPLICATE_FILE', file.path, 'Arquivo duplicado ou reservado.');
        if (
          file.audience !== (file.path === 'public.json' ? 'PUBLIC' : 'MASTER')
        )
          issue('AUDIENCE', file.path, 'Projeção pública indevida.');
        const buffer = read(file.path);
        if (sha256(buffer) !== file.sha256)
          issue('INTEGRITY', file.path, 'Checksum divergente.');
        files.set(file.path, buffer);
      }
      const sections: Record<string, unknown> = { manifest };
      const expected = new Set<string>();
      for (const key of [
        'public',
        'entities',
        'facts',
        'history',
        'threads',
        'atlas',
        'encounters',
      ] as const) {
        const name = `${key}.json`;
        expected.add(name);
        const raw = files.get(name);
        if (!raw) issue('MISSING_FILE', name, 'Seção obrigatória ausente.');
        const value: unknown = JSON.parse(raw!.toString('utf8'));
        assertLoreSchema(key, value);
        sections[key] = value;
      }
      // All sections were validated, including unknown properties and enums.
      const pack = sections as unknown as LorePack;
      const issues = validateLoreReferences(pack);
      if (issues.length) throw new LoreValidationError(issues);
      for (const map of pack.atlas.maps) {
        for (const name of [map.asset, map.texture]) {
          expected.add(name);
          if (!files.has(name))
            issue('MISSING_ASSET', name, 'Asset não declarado no manifesto.');
        }
        if (!map.asset.endsWith('.svg') || !map.texture.endsWith('.png'))
          issue('INVALID_ASSET', map.id, 'Mapa exige SVG e PNG.');
        const png = files.get(map.texture)!;
        if (
          png.length < 24 ||
          png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
        )
          issue('INVALID_ASSET', map.texture, 'PNG inválido.');
        const w = png.readUInt32BE(16);
        const h = png.readUInt32BE(20);
        if (
          !w ||
          !h ||
          w > 16000 ||
          h > 16000 ||
          w * map.height !== h * map.width
        )
          issue(
            'INVALID_ASSET',
            map.texture,
            'Proporção da textura incompatível com o mapa.',
          );
        const svg = files.get(map.asset)!.toString('utf8');
        if (
          !svg.includes('<svg') ||
          /<script|<foreignObject|\bon\w+\s*=|(?:href|url)\s*[=(]\s*["']?(?:https?:|\/\/|data:)/i.test(
            svg,
          )
        )
          issue(
            'INVALID_ASSET',
            map.asset,
            'SVG contém elemento ativo ou remoto.',
          );
      }
      if (
        files.size !== expected.size ||
        [...files.keys()].some((name) => !expected.has(name))
      )
        issue(
          'UNUSED_FILE',
          'manifest.files',
          'Manifesto contém arquivos sem uso.',
        );
      return {
        pack,
        contentHash,
        textures: new Map(
          pack.atlas.maps.map((m) => [m.id, files.get(m.texture)!]),
        ),
      };
    } catch (error) {
      if (error instanceof LoreValidationError) throw error;
      return issue(
        'UNREADABLE_PACK',
        'manifest',
        'Não foi possível ler o pacote completo.',
      );
    }
  }
}
