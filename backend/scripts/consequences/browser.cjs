const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {JwtService}=require('@nestjs/jwt');
const {PrismaService}=require('../../dist/src/prisma/prisma.service');
const {GameActionsService}=require('../../dist/src/game-actions/game-actions.service');
const {StoryOutboxService}=require('../../dist/src/story/story-outbox.service');
exports.check=async function(app,{id,owner,player}){
  const {chromium}=require(process.env.LORE_PLAYWRIGHT_MODULE||'playwright');
  await app.listen(3001,'127.0.0.1');
  const browser=await chromium.launch({headless:true,channel:'chrome'}),output=path.resolve('backups/consequences-browser');fs.mkdirSync(output,{recursive:true});
  const jwt=app.get(JwtService),db=app.get(PrismaService),game=app.get(GameActionsService),outbox=app.get(StoryOutboxService),errors=[];
  async function open(user){
    const context=await browser.newContext({viewport:{width:1440,height:1050}});
    await context.addInitScript(state=>localStorage.setItem('rpg-auth',JSON.stringify(state)),{state:{token:jwt.sign({sub:user.id,email:user.email}),user:{id:user.id,email:user.email,displayName:user.displayName,avatarUrl:null}},version:0});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://localhost:3100/campaigns/${id}/consequences`);return {context,page};
  }
  try{
    const master=await open(owner),member=await open(player),page=master.page;
    await page.getByRole('heading',{name:'Novo prazo',exact:true}).waitFor();
    await member.page.getByRole('alert').filter({hasText:'Somente o mestre'}).waitFor();assert.equal(await member.page.getByRole('heading',{name:'Novo prazo',exact:true}).count(),0);
    await page.getByLabel('Pausar execução de prazos',{exact:true}).check();await page.getByRole('button',{name:'Salvar permissões',exact:true}).click();await page.getByText('Execução automática pausada',{exact:true}).waitFor();
    await page.getByLabel('Pausar execução de prazos',{exact:true}).uncheck();await page.getByRole('button',{name:'Salvar permissões',exact:true}).click();await page.getByText('Execução automática habilitada',{exact:true}).waitFor();
    await page.getByLabel('Título',{exact:true}).fill('Revisar a ponte no navegador');await page.getByLabel('O que revisar',{exact:true}).fill('Conferir as marcas e registrar a decisão.');await page.getByLabel('Minutos até o prazo',{exact:true}).fill('2');
    await page.getByLabel('Autorizar execução automática deste prazo e da chegada, se as condições continuarem válidas',{exact:true}).check();
    // Losing the response after persistence must preserve the request key in the form.
    await page.route('**/consequences',async route=>{if(route.request().method()==='POST'){await route.fetch();await route.abort('failed');}else await route.continue();},{times:1});
    await page.getByRole('button',{name:'Preparar prazo',exact:true}).click();await page.getByRole('alert').filter({hasText:/fetch|network|Failed/i}).waitFor();
    await page.getByRole('button',{name:'Preparar prazo',exact:true}).click();await page.getByRole('status').filter({hasText:'Prazos atualizados'}).waitFor();
    assert.equal(await db.scheduledConsequence.count({where:{campaignId:id,title:'Revisar a ponte no navegador'}}),1);
    const reminder=page.getByRole('article',{name:'Revisar a ponte no navegador',exact:true});await reminder.getByText('Programado',{exact:true}).waitFor();assert.equal(await reminder.getByRole('button',{name:'Aplicar agora',exact:true}).isEnabled(),false);
    const advance=async minutes=>{const s=await game.state(id,owner.id),actor={kind:'USER',userId:owner.id},a=await game.request(id,actor,{requestKey:randomUUID(),expectedSceneRevision:s.scene.revision,operation:{kind:'ADVANCE_TIME',minutes,reason:'Verificação no navegador.'}});await game.resolve(id,a.id,actor,{decision:'COMMIT',expectedRevision:s.revision});await outbox.drain();};
    await advance(2);await reminder.getByText('Aplicado',{exact:true}).waitFor();
    // A manual reminder can be postponed and cancelled from its own card.
    await page.getByLabel('Título',{exact:true}).fill('Reunião adiada');await page.getByRole('button',{name:'Preparar prazo',exact:true}).click();
    const review=page.getByRole('article',{name:'Reunião adiada',exact:true});await review.getByText('Programado',{exact:true}).waitFor();await review.getByText('Adiar e revisar autorização',{exact:true}).click();await review.getByLabel('Novo prazo a partir de agora',{exact:true}).fill('120');await review.getByRole('button',{name:'Salvar adiamento',exact:true}).click();await review.getByText(/Em 120 minutos de jogo/).waitFor();
    await review.getByRole('button',{name:'Cancelar prazo',exact:true}).click();await review.getByText('Cancelado',{exact:true}).waitFor();
    await page.getByLabel('Tipo',{exact:true}).selectOption('NPC_DEPART');
    const npc=await db.campaignNpc.findFirstOrThrow({where:{campaignId:id,entity:{key:'mara'}}}),route=await db.travelRoute.findFirstOrThrow({where:{campaignId:id,fromEntityId:npc.placeEntityId,blocked:false}});
    await page.getByLabel('NPC',{exact:true}).selectOption(npc.entityId);await page.getByLabel('Rota',{exact:true}).selectOption(route.id);await page.getByLabel('Título',{exact:true}).fill('Mara retoma a estrada');await page.getByLabel('Minutos até o prazo',{exact:true}).fill('3');await page.getByRole('button',{name:'Preparar prazo',exact:true}).click();
    await page.getByRole('article',{name:'Mara retoma a estrada',exact:true}).getByText('Programado',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Preparar lembretes da lore',exact:true}).click();await page.getByRole('status').filter({hasText:'Prazos atualizados'}).waitFor();assert.equal(await db.scheduledConsequence.count({where:{campaignId:id,requestKey:{startsWith:'lore-pressure-v1:'}}}),6);
    await page.screenshot({path:path.join(output,'master-desktop.png')});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(output,'master-mobile.png')});
    await master.context.setOffline(true);await advance(3);await master.context.setOffline(false);await page.getByRole('button',{name:'Atualizar prazos',exact:true}).click();await page.getByRole('article',{name:'Mara retoma a estrada',exact:true}).getByText('Aguardando o mestre',{exact:true}).waitFor();
    await page.getByRole('article',{name:'Mara retoma a estrada',exact:true}).getByRole('button',{name:'Aplicar agora',exact:true}).click();await page.getByRole('heading',{name:'Em viagem',exact:true}).waitFor();
    await page.screenshot({path:path.join(output,'journey-mobile.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    // Losing master ownership clears protected content in the existing page.
    await db.campaign.update({where:{id},data:{masterId:player.id}});await page.getByRole('button',{name:'Atualizar prazos',exact:true}).click();await page.getByRole('alert').filter({hasText:'Somente o mestre'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Novo prazo',exact:true}).count(),0);await db.campaign.update({where:{id},data:{masterId:owner.id}});
    assert.deepEqual(errors,[]);console.log('OK: browser policy, lost-response retry, reminders, postpone/cancel, NPC departure, preset, reconnect, ownership revocation and desktop/mobile.');
  }finally{await browser.close();}
};
