/* Remove os usuários criados pelos testes E2E; campanhas e dados caem em cascata. */
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: 'e2e-' } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    const logs = await prisma.auditLog.deleteMany({
      where: { actorId: { in: ids } },
    });
    const removed = await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });
    console.log(
      `[e2e] usuários removidos: ${removed.count} (auditoria: ${logs.count})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[e2e] falha ao limpar:', error);
  process.exit(1);
});
