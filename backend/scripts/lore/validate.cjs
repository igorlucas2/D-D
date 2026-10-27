require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const { LorePackLoader } = require('../../dist/src/lore/lore.loader');
const { LoreService } = require('../../dist/src/lore/lore.service');

async function main() {
  const db = new PrismaClient();
  try {
    const loader = new LorePackLoader();
    const service = new LoreService(db, loader);
    for (const { pack, contentHash } of loader.list()) {
      const bindings = await service.resolveCatalog(pack);
      const invalid = bindings.filter(b => b.status !== 'RESOLVED');
      console.log(JSON.stringify({ packId: pack.manifest.packId, version: pack.manifest.version, status: pack.manifest.status, contentHash, resolved: bindings.length - invalid.length, total: bindings.length, invalid }, null, 2));
      if (invalid.length) process.exitCode = 1;
    }
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error.issues ?? 'Falha ao validar pacote ou consultar catálogo.'); process.exitCode = 1; });
