const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JwtService}=require('@nestjs/jwt');
const {PrismaService}=require('../../dist/src/prisma/prisma.service');
const {GameMasterService}=require('../../dist/src/game-master/game-master.service');
exports.check=async function(app,{id,owner,player,pc,mara,behavior}){
 const {chromium}=require(process.env.LORE_PLAYWRIGHT_MODULE||'playwright');await app.listen(3001,'127.0.0.1');
 const browser=await chromium.launch({headless:true,channel:'chrome'}),output=path.resolve('backups/player-intents-browser');fs.mkdirSync(output,{recursive:true});
 const errors=[],jwt=app.get(JwtService),db=app.get(PrismaService),gm=app.get(GameMasterService);
 const answer=s=>({kind:'ANSWER',text:'RASCUNHO PRIVADO: Mara transportou o caixote.',evidenceIds:[s.sources[0].id],routeId:null,restType:null,revisionId:null,knowerIds:[],sourceNpcId:null});
 behavior(answer);
 async function pageFor(user){const c=await browser.newContext({viewport:{width:1440,height:1050}});await c.addInitScript(state=>localStorage.setItem('rpg-auth',JSON.stringify(state)),{state:{token:jwt.sign({sub:user.id,email:user.email}),user:{id:user.id,email:user.email,displayName:user.displayName,avatarUrl:null}},version:0});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://localhost:3100/campaigns/${id}/intents`);return p;}
 try {
  const p=await pageFor(player),m=await pageFor(owner);
  await p.getByLabel('Seu personagem',{exact:true}).selectOption(pc.entityId);await p.getByLabel('Com quem falar',{exact:true}).selectOption(mara.entityId);
  await p.getByLabel('O que seu personagem faz?',{exact:true}).fill('Pergunto a Mara sobre o transporte.');
  let dropResponse=true;
  await p.route('**/intents',async r=>{if(r.request().method()==='POST'&&dropResponse){dropResponse=false;await r.fetch();await r.abort('failed');}else await r.continue();});
  await p.getByRole('button',{name:'Enviar intenção',exact:true}).click();await p.getByRole('status').filter({hasText:/fetch|network|Failed/i}).waitFor();
  await p.getByRole('button',{name:'Enviar intenção',exact:true}).click();await p.getByRole('status').filter({hasText:'Intenção salva'}).waitFor();
  assert.equal(await db.gameMasterTurn.count({where:{campaignId:id,playerEntityId:pc.entityId}}),1);
  await gm.runNext();await m.getByText('RASCUNHO PRIVADO: Mara transportou o caixote.',{exact:true}).waitFor();
  assert.equal(await p.getByText('RASCUNHO PRIVADO: Mara transportou o caixote.',{exact:true}).count(),0);
  await m.getByRole('button',{name:'Usar rascunho',exact:true}).click();
  await m.getByLabel('Resposta do mestre',{exact:true}).fill('Você pergunta sobre o caixote ou sobre o caminho?');
  await m.getByLabel('Como continuar',{exact:true}).selectOption('ASK');
  await m.screenshot({path:path.join(output,'master-desktop.png'),fullPage:true});
  await m.setViewportSize({width:390,height:844});assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await m.screenshot({path:path.join(output,'master-mobile.png'),fullPage:true});
  await m.getByRole('button',{name:'Enviar ao jogador',exact:true}).click();
  await p.getByLabel('Seu esclarecimento',{exact:true}).waitFor();await p.reload();await p.getByLabel('Seu esclarecimento',{exact:true}).waitFor();
  await p.screenshot({path:path.join(output,'player-desktop.png'),fullPage:true});
  await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.screenshot({path:path.join(output,'player-mobile.png'),fullPage:true});
  await p.getByLabel('Seu esclarecimento',{exact:true}).fill('Quero saber sobre o caminho.');await p.getByRole('button',{name:'Responder à pergunta',exact:true}).click();
  await p.getByText('Quero saber sobre o caminho.',{exact:true}).waitFor();await gm.runNext();
  const current=m.locator('article').filter({hasText:'Quero saber sobre o caminho.'});
  await current.getByLabel('Resposta do mestre',{exact:true}).fill('Mara descreve o caminho na resposta revisada.');
  await current.getByRole('button',{name:'Enviar ao jogador',exact:true}).click();
  await p.getByText('Mara descreve o caminho na resposta revisada.',{exact:true}).waitFor();
  assert.equal(await db.storyEvent.count({where:{campaignId:id,summary:'Mara descreve o caminho na resposta revisada.'}}),1);
  // Human fallback remains usable with inference switched off.
  const lore=await db.campaignLore.findUniqueOrThrow({where:{campaignId:id}});await gm.settings(id,owner.id,{mode:'OFF',paused:false,expectedRevision:lore.revision});
  await p.getByLabel('O que seu personagem faz?',{exact:true}).fill('Quero observar a entrada.');await p.getByRole('button',{name:'Enviar intenção',exact:true}).click();
  const manual=m.locator('article').filter({hasText:'Quero observar a entrada.'});await manual.getByLabel('Resposta do mestre',{exact:true}).fill('O mestre descreve a entrada sem consultar o modelo.');
  await manual.getByRole('button',{name:'Enviar ao jogador',exact:true}).click();await p.getByText('O mestre descreve a entrada sem consultar o modelo.',{exact:true}).waitFor();
  await db.campaignMember.delete({where:{campaignId_userId:{campaignId:id,userId:player.id}}});await p.reload();await p.getByRole('alert').filter({hasText:'não participa'}).waitFor();
  assert.equal(await p.getByText('Mara descreve o caminho na resposta revisada.',{exact:true}).count(),0);
  assert.deepEqual(errors,[]);console.log('OK: player/master browser dialogue, lost-response retry, private draft, edited question, reload/follow-up, manual fallback, revoked access and desktop/mobile layout.');
 } catch(e) {
  for(const c of browser.contexts())for(const page of c.pages()) console.error('Browser failure state: '+(await page.locator('body').innerText()).slice(0,3000));
  throw e;
 } finally {await browser.close();}
};
