// Run after `npm run build`, only against a disposable rehearsal database.
require('reflect-metadata');
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  if (url.protocol !== 'mysql:' || !/^\/rpg_migration_check_\d+$/.test(url.pathname)) {
    throw new Error('Smoke test requires a disposable rpg_migration_check_<timestamp> database');
  }
  const { NestFactory } = require('@nestjs/core');
  const { ValidationPipe } = require('@nestjs/common');
  const { AppModule } = require('../../dist/src/app.module');
  const { PrismaService } = require('../../dist/src/prisma/prisma.service');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.init();
  const db = app.get(PrismaService);
  const http = request(app.getHttpServer());
  let userId;
  try {
    const counts = { items: await db.item.count(), spells: await db.spell.count(), monsters: await db.monster.count(), rules: await db.ruleSection.count() };
    assert.ok(counts.items && counts.monsters, 'Rehearsal must contain migrated catalog');
    await http.get('/api/health').expect(200);
    await http.get('/api/catalog/items').expect(401);
    const credentials = { email: `mysql-check-${randomUUID()}@example.test`, password: randomUUID() };
    const registration = await http.post('/api/auth/register').send({ ...credentials, displayName: 'Validação MySQL' }).expect(201);
    userId = registration.body.user.id;
    const login = await http.post('/api/auth/login').send(credentials).expect(201);
    const auth = `Bearer ${login.body.accessToken}`;
    assert.equal(login.body.user.id, userId);
    for (const [route, count] of Object.entries(counts)) {
      const response = await http.get('/api/catalog/' + route).set('Authorization', auth).expect(200);
      assert.equal(response.body.length, count);
    }
    // Identity lookups retain SQLite's exact comparison rather than accepting case variants.
    assert.equal(await db.user.findUnique({ where: { id: userId.toUpperCase() } }), null);
    const text = 'Memória da expedição: ação, céu e dragão 🐉. '.repeat(40);
    const campaign = (await http.post('/api/campaigns').set('Authorization', auth).send({ name: 'MI-DB — ensaio', description: text }).expect(201)).body;
    assert.equal(campaign.description, text);
    const base = `/api/campaigns/${campaign.id}`;
    const character = (await http.post('/api/characters').set('Authorization', auth).send({
      name: 'Exploradora', race: 'Humano', class: 'Guerreiro', backstory: text,
      strength: 12, dexterity: 12, constitution: 12, intelligence: 12, wisdom: 12, charisma: 12,
    }).expect(201)).body;
    assert.equal(character.backstory, text);
    const item = await db.item.findFirstOrThrow();
    await http.post(`/api/characters/${character.id}/inventory`).set('Authorization', auth).send({ itemId: item.id, quantity: 2 }).expect(201);
    assert.equal(await db.inventoryItem.count({ where: { characterId: character.id } }), 1);
    const fogCells = Array.from({ length: 200 }, (_, i) => `${i % 24}:${Math.floor(i / 24)}`);
    const parent = (await http.post(base + '/vtt/maps').set('Authorization', auth).send({ name: 'Vale', kind: 'REGION', width: 24, height: 18, fogCells }).expect(201)).body;
    const child = (await http.post(base + '/vtt/maps').set('Authorization', auth).send({ name: 'Abadia', kind: 'INTERIOR', parentMapId: parent.id }).expect(201)).body;
    const savedMap = (await http.get(base + '/vtt/maps/' + child.id).set('Authorization', auth).expect(200)).body;
    assert.equal(savedMap.parentMapId, parent.id);
    assert.deepEqual(JSON.parse((await db.vttMap.findUniqueOrThrow({ where: { id: parent.id } })).fogOfWarData), fogCells);
    const entry = (await http.post(base + '/world/entries').set('Authorization', auth).send({ type: 'REINO', name: 'Véspera', description: text }).expect(201)).body;
    await http.post(base + '/world/entries').set('Authorization', auth).send({ type: 'FACCAO', name: 'Conselho', parentId: entry.id }).expect(201);
    const calendar = (await http.get(base + '/world/calendar').set('Authorization', auth).expect(200)).body;
    const advanced = (await http.post(base + '/world/clock/advance').set('Authorization', auth).send({ minutes: 60 }).expect(201)).body;
    assert.equal(advanced.totalMinutes, calendar.totalMinutes + 60);
    const message = 'O sino voltou a tocar. 🐉 '.repeat(20).trim();
    await http.post(base + '/chat').set('Authorization', auth).send({ kind: 'OOC', content: message }).expect(201);
    await db.$disconnect();
    await db.$connect();
    const history = (await http.get(base + '/chat').set('Authorization', auth).expect(200)).body;
    assert.equal(history.at(-1).content, message);
    assert.equal((await http.get(base).set('Authorization', auth).expect(200)).body.description, text);
    const sentinel = new Error('intentional rollback');
    await assert.rejects(db.$transaction(async tx => {
      await tx.campaign.update({ where: { id: campaign.id }, data: { description: 'uncommitted' } });
      throw sentinel;
    }), error => error === sentinel);
    assert.equal((await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).description, text);
    console.log('OK: HTTP authentication, catalog, character/inventory, map hierarchy/fog, world hierarchy/calendar, Unicode chat, reconnect and transaction rollback.');
  } finally {
    try { if (userId) await db.user.delete({ where: { id: userId } }); }
    finally { await app.close(); }
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
