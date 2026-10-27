// HTTP verification against the local catalog/campaign, with ALL database writes rejected.
require('reflect-metadata');
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { AppModule } = require('../../dist/src/app.module');
const { PrismaService } = require('../../dist/src/prisma/prisma.service');

async function checkBrowser(app, db, jwt, campaign) {
  const { chromium } = require(process.env.LORE_PLAYWRIGHT_MODULE || 'playwright');
  const { mkdirSync } = require('node:fs');
  const { join, resolve } = require('node:path');
  const output = resolve('backups/lore-browser-check');
  mkdirSync(output, { recursive:true });
  await app.listen(3001, '127.0.0.1');
  const browser = await chromium.launch({ headless:true, channel:process.env.LORE_BROWSER_CHANNEL });
  const errors = [];
  const seed = async (context, userId) => {
    const user = await db.user.findUniqueOrThrow({ where:{ id:userId }, select:{ id:true, email:true, displayName:true, avatarUrl:true } });
    const state = { state:{ token:jwt.sign({ sub:userId, email:user.email }), user }, version:0 };
    await context.addInitScript(value => localStorage.setItem('rpg-auth', JSON.stringify(value)), state);
  };
  try {
    const context = await browser.newContext({ viewport:{ width:1440, height:1000 } });
    await seed(context,campaign.masterId);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    const url = `http://localhost:3100/campaigns/${campaign.id}/lore`;
    await page.goto(url);
    await page.getByRole('button',{ name:'Revisar cenário' }).click();
    await page.getByText('Todas as fichas foram encontradas no catálogo.',{ exact:true }).waitFor();
    assert.equal(await page.getByRole('heading',{ name:'Nara Braseiro' }).count(),1);
    await page.screenshot({ path:join(output,'desktop.png') });
    await page.getByText('Cânone e segredos da história',{ exact:true }).click();
    await page.getByText('C05 · Segredo do mestre · Fato fixo',{ exact:true }).waitFor({ state:'visible' });
    await page.setViewportSize({ width:390, height:844 });
    await page.reload();
    // Exercise a recoverable preview error before the successful mobile view.
    const pattern = '**/api/campaigns/*/lore/install-preview';
    await page.route(pattern, route => route.fulfill({ status:503, contentType:'application/json', body:JSON.stringify({ message:'Indisponibilidade simulada para teste.' }) }));
    await page.getByRole('button',{ name:'Revisar cenário' }).click();
    await page.getByRole('alert').filter({ hasText:'Indisponibilidade simulada' }).waitFor();
    await page.unroute(pattern);
    await page.getByRole('button',{ name:'Tentar novamente' }).click();
    await page.getByText('Todas as fichas foram encontradas no catálogo.',{ exact:true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),false);
    await page.screenshot({ path:join(output,'mobile.png') });
    const member = campaign.members.find(m => m.userId !== campaign.masterId);
    if (member) {
      const playerContext = await browser.newContext();
      await seed(playerContext,member.userId);
      const playerPage = await playerContext.newPage();
      let privateRequests = 0;
      playerPage.on('request', r => { if (r.url().includes('install-preview')) privateRequests++; });
      await playerPage.goto(url);
      await playerPage.getByRole('alert').filter({ hasText:'reservada ao mestre' }).waitFor();
      assert.equal(privateRequests,0);
      assert.equal(await playerPage.getByRole('heading',{ name:'Nara Braseiro' }).count(),0);
      await playerContext.close();
    }
    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    await anonymousPage.goto(url);
    await anonymousPage.waitForURL('**/login?**');
    await anonymous.close();
    assert.deepEqual(errors,[]);
    console.log('OK: browser desktop/mobile, private preview, error/retry, no horizontal overflow, player denial and login redirect. Screenshots in backend/backups/lore-browser-check.');
  } finally { await browser.close(); }
}

async function main() {
  let readQueries = 0;
  const db = new PrismaService().$extends({ query: { async $allOperations({ operation, args, query }) {
    assert.ok(['findUnique','findUniqueOrThrow','findFirst','findFirstOrThrow','findMany','count','aggregate','groupBy'].includes(operation), `Database mutation forbidden in lore smoke: ${operation}`);
    readQueries++;
    return query(args);
  } } });
  const module = await Test.createTestingModule({ imports:[AppModule] }).overrideProvider(PrismaService).useValue(db).compile();
  const app = module.createNestApplication({ logger:false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  try {
    await app.init();
    const http = request(app.getHttpServer());
    const campaign = await db.campaign.findFirstOrThrow({ include: { members:true } });
    const jwt = app.get(JwtService);
    const auth = id => `Bearer ${jwt.sign({ sub:id, email:'lore-readonly@example.test' })}`;
    const owner = auth(campaign.masterId);
    const body = { packId:'eldoria-tres-sinos', version:'1.0.0' };
    const base = `/api/campaigns/${campaign.id}/lore/install-preview`;
    await http.get('/api/lore-packs').expect(401);
    await http.post(base).send(body).expect(401);
    const publicList = (await http.get('/api/lore-packs').set('Authorization',owner).expect(200)).body;
    assert.equal(publicList.length,1);
    assert.ok(!/C05|caixote|Oren|Mara|publicationBlockers|contentHash/.test(JSON.stringify(publicList)));
    const preview = await http.post(base).set('Authorization',owner).send(body).expect(200);
    assert.equal(preview.headers['cache-control'],'no-store');
    assert.equal(preview.body.bindings.length,16);
    assert.equal(preview.body.validation.catalogValid,true);
    assert.equal(preview.body.validation.canInstall,false);
    assert.equal(preview.body.counts.npcs,8);
    assert.equal(preview.body.counts.maps,3);
    const repeated = await http.post(base).set('Authorization',owner).send(body).expect(200);
    assert.deepEqual(repeated.body,preview.body);
    const member = campaign.members.find(m => m.userId !== campaign.masterId);
    if (member) await http.post(base).set('Authorization',auth(member.userId)).send(body).expect(403);
    await http.post(base).set('Authorization',auth(randomUUID())).send(body).expect(403);
    await http.post(base).set('Authorization',owner).send({ ...body, packId:'../secrets' }).expect(400);
    await http.post(base).set('Authorization',owner).send({ ...body, extra:'invalid' }).expect(400);
    await http.post(base).set('Authorization',owner).send({ ...body, version:'9.9.9' }).expect(404);
    await http.post(`/api/campaigns/${randomUUID()}/lore/install-preview`).set('Authorization',owner).send(body).expect(404);
    await http.post(`/api/campaigns/${campaign.id}/lore/install`).set('Authorization',owner).send(body).expect(400);
    await http.get('/content/eldoria-tres-sinos/1.0.0/facts.json').expect(404);
    if (process.argv.includes('--browser')) await checkBrowser(app, db, jwt, campaign);
    console.log(`OK: authenticated HTTP preview, ${member ? 'member + ' : ''}outsider denied, public projection, DTO, immutable files, repeat preview, 16 MySQL bindings. ${readQueries} read-only queries; writes blocked.`);
  } finally { await app.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
