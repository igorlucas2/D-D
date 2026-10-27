const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {JwtService}=require('@nestjs/jwt');
const {PrismaService}=require('../../dist/src/prisma/prisma.service');
const {GameActionsService}=require('../../dist/src/game-actions/game-actions.service');
const {StoryService}=require('../../dist/src/story/story.service');
const {StoryOutboxService}=require('../../dist/src/story/story-outbox.service');
exports.check=async function(app,{id,owner,player,pc}){
  const {chromium}=require(process.env.LORE_PLAYWRIGHT_MODULE||'playwright');
  await app.listen(3001,'127.0.0.1');
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const output=path.resolve('backups/game-actions-browser');fs.mkdirSync(output,{recursive:true});
  const jwt=app.get(JwtService),db=app.get(PrismaService),game=app.get(GameActionsService),story=app.get(StoryService),outbox=app.get(StoryOutboxService);
  const errors=[];
  async function pageFor(user){
    const context=await browser.newContext({viewport:{width:1440,height:1050}});
    await context.addInitScript(state=>localStorage.setItem('rpg-auth',JSON.stringify(state)),{state:{token:jwt.sign({sub:user.id,email:user.email}),user:{id:user.id,email:user.email,displayName:user.displayName,avatarUrl:null}},version:0});
    const page=await context.newPage(),updates=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('websocket',ws=>ws.on('framereceived',({payload})=>{if(String(payload).includes('story:updated'))updates.push(String(payload));}));
    await page.goto(`http://localhost:3100/campaigns/${id}/actions`);
    await page.getByTestId('group-clock').waitFor();
    return {page,context,updates};
  }
  const actor={kind:'USER',userId:owner.id};
  try{
    const master=await pageFor(owner),member=await pageFor(player),page=master.page,p=member.page;
    const start=await game.state(id,owner.id),route=start.routes.find(r=>!r.blocked&&r.published);assert.ok(route);
    assert.equal(await p.getByText('Objetos de trama',{exact:true}).count(),0);
    assert.equal(await p.getByRole('button',{name:'Confirmar ação',exact:true}).count(),0);
    await p.getByLabel('Seu personagem',{exact:true}).selectOption(pc.entityId);
    await p.getByLabel('Destino',{exact:true}).selectOption(route.id);
    // Preserve a request key after the server commits the pending row but the response is lost.
    await p.route('**/game-actions',async r=>{await r.fetch();await r.abort('failed');},{times:1});
    await p.getByRole('button',{name:'Enviar solicitação',exact:true}).click();
    await p.getByRole('status').filter({hasText:/fetch|network|Failed/i}).waitFor();
    await p.getByRole('button',{name:'Enviar solicitação',exact:true}).click();
    await p.getByRole('status').filter({hasText:'Solicitação registrada'}).waitFor();
    const pending=await db.gameAction.findMany({where:{campaignId:id,status:'PENDING'}});assert.equal(pending.length,1);
    assert.equal((await game.state(id,owner.id)).clock.totalMinutes,start.clock.totalMinutes);
    await page.getByRole('button',{name:'Atualizar cena',exact:true}).click();
    await page.getByRole('button',{name:'Confirmar ação',exact:true}).waitFor();
    await page.getByRole('button',{name:'Confirmar ação',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Ação aplicada'}).waitFor();
    await outbox.drain();
    await p.getByRole('heading',{name:route.name,exact:true}).waitFor();
    assert.equal((await game.state(id,owner.id)).clock.totalMinutes,start.clock.totalMinutes+route.minutes);
    assert.equal(await p.getByTestId('group-clock').textContent(),await page.getByTestId('group-clock').textContent());
    const committed=await db.gameAction.findUniqueOrThrow({where:{id:pending[0].id}});
    assert.ok(member.updates.some(s=>s.includes(committed.eventId)),'player received authorized socket invalidation');
    const publicPayload=JSON.parse(member.updates.find(s=>s.includes(committed.eventId)).slice(member.updates.find(s=>s.includes(committed.eventId)).indexOf('[')))[1];
    assert.deepEqual(Object.keys(publicPayload).sort(),['campaignId','eventId']);
    // Private outbox messages reach only the master, including with both sockets connected.
    const secret=await story.command(id,owner.id,{requestKey:randomUUID(),expectedRevision:(await game.state(id,owner.id)).revision,operation:{kind:'NOTE',text:'SEGREDO-MI04',entityIds:[],audience:{scope:'MASTER',recipientIds:[]}}});
    await outbox.drain();
    await page.getByRole('button',{name:'Atualizar cena',exact:true}).click();
    await page.getByTestId('group-clock').waitFor();
    assert.ok(master.updates.some(s=>s.includes(secret.eventId)));assert.ok(!member.updates.some(s=>s.includes(secret.eventId)));
    // Reconnect fetches authoritative state after an offline event; it never repeats an action.
    await member.context.setOffline(true);
    const s=await game.state(id,owner.id),a=await game.request(id,actor,{requestKey:randomUUID(),expectedSceneRevision:s.scene.revision,operation:{kind:'ADVANCE_TIME',minutes:31,reason:'Retomada de conexão.'}});
    await game.resolve(id,a.id,actor,{decision:'COMMIT',expectedRevision:s.revision});await outbox.drain();
    await member.context.setOffline(false);
    await p.getByRole('button',{name:'Atualizar cena',exact:true}).click();
    await page.getByRole('button',{name:'Atualizar cena',exact:true}).click();
    const current=await game.state(id,owner.id),time=`${String(current.clock.hour).padStart(2,'0')}:${String(current.clock.minute).padStart(2,'0')}`;
    await p.getByTestId('group-clock').filter({hasText:time}).waitFor();
    await page.getByTestId('group-clock').filter({hasText:time}).waitFor();
    await page.screenshot({path:path.join(output,'master-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(output,'master-mobile.png')});
    await p.screenshot({path:path.join(output,'player-desktop.png')});
    // Removing membership while a socket remains connected prevents subsequent delivery.
    await db.campaignMember.deleteMany({where:{campaignId:id,userId:player.id}});
    const revoked=await story.command(id,owner.id,{requestKey:randomUUID(),expectedRevision:(await game.state(id,owner.id)).revision,operation:{kind:'NOTE',text:'Após remoção.',entityIds:[],audience:{scope:'PUBLIC',recipientIds:[]}}});
    await outbox.drain();await p.getByRole('button',{name:'Atualizar cena',exact:true}).click();
    await p.getByRole('alert').filter({hasText:'Sem acesso'}).waitFor();await p.getByTestId('group-clock').waitFor({state:'hidden'});
    assert.ok(!member.updates.some(s=>s.includes(revoked.eventId)));
    assert.deepEqual(errors,[]);
    console.log('OK: browser proposal/retry, master approval, live private/public sockets, shared clock, reconnect, revoked membership and desktop/mobile.');
  }finally{await browser.close();}
};
