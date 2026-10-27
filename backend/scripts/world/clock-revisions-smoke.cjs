/*
 * Ensaio de concorrência do relógio (P1-1) e das revisões (P1-2).
 *
 * Cria uma campanha descartável no banco configurado em backend/.env, roda os
 * cenários concorrentes e apaga tudo no final. Só executa com
 * ALLOW_DB_SMOKE=1, porque escreve no banco de desenvolvimento:
 *
 *   ALLOW_DB_SMOKE=1 node scripts/world/clock-revisions-smoke.cjs
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function loadEnv() {
  const file = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

loadEnv();

if (process.env.ALLOW_DB_SMOKE !== '1') {
  console.error(
    'Recusado: este ensaio grava no banco. Rode com ALLOW_DB_SMOKE=1.',
  );
  process.exit(2);
}

const { WorldService } = require('../../dist/src/world/world.service');
const { VttService } = require('../../dist/src/vtt/vtt.service');

const prisma = new PrismaClient();
const clockGateway = {
  emitClockUpdated() {},
  emitWorldEvent() {},
  closeCampaign() {},
  evictUser() {},
};
const vttGateway = {
  emitMapCreated() {},
  emitMapUpdated() {},
  emitMapRemoved() {},
  resyncPlayers() {},
  emitRoll() {},
  emitNarration() {},
  emitToMaster() {},
  emitToUser() {},
  emitCombat() {},
  emitStoryUpdateToUser() {},
  evictUser() {},
  closeCampaign() {},
};

const world = new WorldService(prisma, clockGateway);
const vtt = new VttService(prisma, vttGateway);

let failures = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`OK   | ${name}${detail ? ` | ${detail}` : ''}`);
  } else {
    failures += 1;
    console.log(`FAIL | ${name}${detail ? ` | ${detail}` : ''}`);
  }
}

async function main() {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const user = await prisma.user.create({
    data: {
      email: `smoke-clock-${suffix}@example.com`,
      passwordHash: 'smoke',
      displayName: 'Smoke Clock',
    },
  });
  const campaign = await prisma.campaign.create({
    data: {
      name: `Smoke Clock ${suffix}`,
      masterId: user.id,
      members: { create: { userId: user.id, role: 'MASTER' } },
    },
  });

  try {
    // Inicializa o calendário pelos padrões.
    await world.addMinutes(campaign.id, 0);
    let calendar = await prisma.campaignCalendar.findUnique({
      where: { campaignId: campaign.id },
    });

    // 1) Incremento atômico: 20 avanços simultâneos de 8 minutos.
    const before = calendar.totalMinutes;
    await Promise.all(
      Array.from({ length: 20 }, () => world.addMinutes(campaign.id, 8)),
    );
    calendar = await prisma.campaignCalendar.findUnique({
      where: { campaignId: campaign.id },
    });
    check(
      'addMinutes concorrente não perde minutos',
      calendar.totalMinutes === before + 160,
      `${before} + 160 = ${before + 160}; obtido ${calendar.totalMinutes}`,
    );

    // 2) Tick automático: dois workers com o mesmo snapshot, 3 intervalos vencidos.
    const tickBase = new Date(Date.now() - 3.5 * 60_000);
    await prisma.campaignCalendar.update({
      where: { campaignId: campaign.id },
      data: {
        realMinutesPerTick: 1,
        gameMinutesPerTick: 60,
        lastTickAt: tickBase,
      },
    });
    const snapshot = await prisma.campaignCalendar.findUnique({
      where: { campaignId: campaign.id },
    });
    const tickBefore = snapshot.totalMinutes;
    const tickResults = await Promise.all([
      world.advanceAutoTick(snapshot),
      world.advanceAutoTick(snapshot),
    ]);
    const tickWinners = tickResults.filter(Boolean).length;
    const afterTick = await prisma.campaignCalendar.findUnique({
      where: { campaignId: campaign.id },
    });
    check(
      'apenas um worker aplica o tick (CAS em lastTickAt)',
      tickWinners === 1,
      `${tickWinners} vencedor(es)`,
    );
    check(
      'tick recupera 3 intervalos de 60 min',
      afterTick.totalMinutes === tickBefore + 180,
      `${tickBefore} + 180 = ${tickBefore + 180}; obtido ${afterTick.totalMinutes}`,
    );
    check(
      'lastTickAt avança no alinhamento do intervalo',
      afterTick.lastTickAt instanceof Date &&
        afterTick.lastTickAt.getTime() >
          tickBase.getTime() + 2 * 60_000,
      String(afterTick.lastTickAt),
    );

    // 3) Calendário: duas gravações com a mesma revisão, uma vence.
    const revision = afterTick.revision;
    const calendarWrites = await Promise.allSettled([
      world.updateCalendar(campaign.id, user.id, {
        expectedRevision: revision,
        notes: 'smoke A',
      }),
      world.updateCalendar(campaign.id, user.id, {
        expectedRevision: revision,
        notes: 'smoke B',
      }),
    ]);
    const calendarOk = calendarWrites.filter(
      (result) => result.status === 'fulfilled',
    ).length;
    const calendarConflicts = calendarWrites.filter(
      (result) =>
        result.status === 'rejected' && result.reason?.getStatus?.() === 409,
    ).length;
    check(
      'updateCalendar com expectedRevision: 1 vence, 1 recebe 409',
      calendarOk === 1 && calendarConflicts === 1,
      `${calendarOk} ok / ${calendarConflicts} conflito(s)`,
    );

    // 4) Mapa: duas edições concorrentes com a mesma revisão, uma vence.
    const map = await vtt.createMap(campaign.id, user.id, {
      name: `Smoke Map ${suffix}`,
      width: 24,
      height: 16,
    });
    const mapWrites = await Promise.allSettled([
      vtt.updateMap(campaign.id, map.id, user.id, {
        vision: 'LIT',
        expectedRevision: map.revision,
      }),
      vtt.updateMap(campaign.id, map.id, user.id, {
        vision: 'DARK',
        expectedRevision: map.revision,
      }),
    ]);
    const mapOk = mapWrites.filter(
      (result) => result.status === 'fulfilled',
    ).length;
    const mapConflicts = mapWrites.filter(
      (result) =>
        result.status === 'rejected' && result.reason?.getStatus?.() === 409,
    ).length;
    const storedMap = await prisma.vttMap.findUnique({ where: { id: map.id } });
    check(
      'updateMap com expectedRevision: 1 vence, 1 recebe 409',
      mapOk === 1 && mapConflicts === 1,
      `${mapOk} ok / ${mapConflicts} conflito(s)`,
    );
    check(
      'revisão do mapa incrementou uma única vez',
      storedMap.revision === map.revision + 1,
      `esperado ${map.revision + 1}; obtido ${storedMap.revision}`,
    );
  } finally {
    await prisma.campaign
      .delete({ where: { id: campaign.id } })
      .catch(() => undefined);
    await prisma.user
      .delete({ where: { id: user.id } })
      .catch(() => undefined);
    await prisma.$disconnect();
  }

  if (failures > 0) {
    console.error(`\n${failures} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log('\nTodas as verificações passaram.');
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
