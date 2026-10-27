const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JwtService}=require('@nestjs/jwt');
const {PrismaService}=require('../../dist/src/prisma/prisma.service');
const {GameMasterService}=require('../../dist/src/game-master/game-master.service');
exports.check=async function(app,{id,owner,player,behavior}){
 const {chromium}=require(process.env.LORE_PLAYWRIGHT_MODULE||'playwright');await app.listen(3001,'127.0.0.1');
 const browser=await chromium.launch({headless:true,channel:'chrome'}),output=path.resolve('backups/game-master-browser');fs.mkdirSync(output,{recursive:true});
 const errors=[],jwt=app.get(JwtService),db=app.get(PrismaService),gm=app.get(GameMasterService);
 const reply=s=>({kind:'ANSWER',text:'Rascunho privado para revisão.',evidenceIds:[s.sources[0].id],routeId:null,restType:null,revisionId:null,knowerIds:[],sourceNpcId:null});
 async function pageFor(u){const context=await browser.newContext({viewport:{width:1440,height:1050}});await context.addInitScript(state=>localStorage.setItem('rpg-auth',JSON.stringify(state)),{state:{token:jwt.sign({sub:u.id,email:u.email}),user:{id:u.id,email:u.email,displayName:u.displayName,avatarUrl:null}},version:0});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://localhost:3100/campaigns/${id}/copilot`);return page;}
 try{
  behavior(reply);const page=await pageFor(owner);await page.getByRole('button',{name:'Pausar copiloto',exact:true}).waitFor();
  await page.getByLabel('Pedido ao copiloto',{exact:true}).fill('Preparar uma descrição para o teste visual.');
  await page.route('**/game-master/actions',async r=>{await r.fetch();await r.abort('failed');},{times:1});
  await page.getByRole('button',{name:'Consultar memória',exact:true}).click();await page.getByRole('status').filter({hasText:/fetch|network|Failed/i}).waitFor();
  await page.getByRole('button',{name:'Consultar memória',exact:true}).click();await page.getByRole('status').filter({hasText:'Pedido salvo'}).waitFor();
  assert.equal(await db.gameMasterTurn.count({where:{campaignId:id,status:'REQUESTED'}}),1);
  await gm.runNext();await page.getByLabel('Texto revisado',{exact:true}).waitFor();
  await page.getByLabel('Texto revisado',{exact:true}).fill('O grupo retomou a conversa na cena atual.');await page.getByLabel('Visibilidade',{exact:true}).selectOption('PUBLIC');
  await page.getByRole('button',{name:'Aprovar texto revisado',exact:true}).click();await page.getByRole('status').filter({hasText:'Proposta aprovada'}).waitFor();
  assert.equal(await db.storyEvent.count({where:{campaignId:id,summary:'O grupo retomou a conversa na cena atual.'}}),1);
  let entered,release;const enteredPromise=new Promise(r=>entered=r);behavior(async s=>{entered();await new Promise(r=>release=r);return reply(s);});
  await page.getByLabel('Pedido ao copiloto',{exact:true}).fill('Aguarde a revisão desta segunda consulta.');await page.getByRole('button',{name:'Consultar memória',exact:true}).click();await page.getByRole('status').filter({hasText:'Pedido salvo'}).waitFor();
  const running=gm.runNext();await enteredPromise;
  await page.getByRole('button',{name:'Pausar copiloto',exact:true}).click();await page.getByRole('button',{name:'Retomar copiloto',exact:true}).waitFor();release();await running;
  assert.equal(await db.gameMasterTurn.count({where:{campaignId:id,status:{in:['GENERATING','READY']}}}),0);
  await page.getByRole('button',{name:'Retomar copiloto',exact:true}).click();await page.getByRole('button',{name:'Pausar copiloto',exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'master-desktop.png')});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(output,'master-mobile.png')});
  const p=await pageFor(player);await p.getByRole('alert').filter({hasText:'reservado ao mestre'}).waitFor();assert.equal(await p.getByLabel('Pedido ao copiloto',{exact:true}).count(),0);
  assert.deepEqual(errors,[]);console.log('OK: browser request/retry, persisted progress, edit/publication, pause during inference, master-only access and desktop/mobile.');
 }finally{await browser.close();}
};
