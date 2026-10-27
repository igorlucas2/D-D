/* Remove os usuários criados pelos testes E2E; campanhas e dados caem em cascata. */
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.deleteMany({
      where: { email: { startsWith: 'e2e-' } },
    });
    console.log(`[e2e] usuários removidos: ${users.count}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[e2e] falha ao limpar:', error);
  process.exit(1);
});
