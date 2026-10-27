require('reflect-metadata');
require('dotenv').config({quiet:true});
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{spawnSync}=require('node:child_process');
const request=require('supertest');
const {NestFactory}=require('@nestjs/core'),{ValidationPipe}=require('@nestjs/common'),{SchedulerRegistry}=require('@nestjs/schedule'),{JwtService}=require('@nestjs/jwt');
const {AppModule}=require('../../dist/src/app.module');
const {PrismaService}=require('../../dist/src/prisma/prisma.service');
const {GameActionsService}=require('../../dist/src/game-actions/game-actions.service');
const {ConsequencesService}=require('../../dist/src/consequences/consequences.service');
const {GameMasterService}=require('../../dist/src/game-master/game-master.service');
const {PlayerIntentsService}=require('../../dist/src/game-master/player-intents.service');
const {StoryService}=require('../../dist/src/story/story.service');
const {LoreInstallService}=require('../../dist/src/lore/lore-install.service');
const {LorePackLoader}=require('../../dist/src/lore/lore.loader');
const {CampaignsService}=require('../../dist/src/campaigns/campaigns.service');
const conflict=e=>e.status===409;
async function main(){
  if(!/^\/rpg_lore_check_\d+$/.test(new URL(process.env.DATABASE_URL).pathname))throw new Error('Requires disposable database');
  if(process.argv.includes('--resume')){
    const {PrismaClient}=require('@prisma/client'),db=new PrismaClient(),f=JSON.parse(process.env.CONSEQUENCE_FIXTURE);
    try{assert.equal((await db.campaignNpc.findUniqueOrThrow({where:{entityId:f.npc}})).activeJourneyId,f.trip);assert.equal((await db.scheduledConsequence.findUniqueOrThrow({where:{id:f.arrival}})).status,'SCHEDULED');assert.equal(await db.storyEvent.count({where:{campaignId:f.id}}),f.events);console.log('OK: fresh process retains journey and does not apply arrival on restart.');}finally{await db.$disconnect();}return;
  }
  const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api');app.enableCors();app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();
  const registry=app.get(SchedulerRegistry);for(const name of registry.getIntervals())registry.deleteInterval(name);
  const db=app.get(PrismaService),service=app.get(ConsequencesService),game=app.get(GameActionsService),users=[],ids=[];
  try{
    for(let i=0;i<3;i++)users.push(await db.user.create({data:{email:`deadlines-${i}-${randomUUID()}@example.test`,displayName:`Teste ${i}`,passwordHash:randomUUID()}}));
    const [owner,player,outsider]=users,installer=app.get(LoreInstallService),pack=app.get(LorePackLoader).load('eldoria-tres-sinos','1.0.0');
    const fresh=async()=>{const c=await installer.create(owner.id,{packId:'eldoria-tres-sinos',version:'1.0.0',expectedHash:pack.contentHash,allowDraft:true,name:'Prazos de teste',requestKey:randomUUID()});ids.push(c.campaignId);return c.campaignId;};
    const id=await fresh(),other=await fresh(),actor={kind:'USER',userId:owner.id};
    await db.campaignMember.create({data:{campaignId:id,userId:player.id,role:'PLAYER'}});
    const c=await db.character.create({data:{userId:player.id,name:'Heroína dos prazos',race:'Humano',class:'Mago',maxHp:20,currentHp:20}}),pc=await installer.attachCharacter(id,player.id,c.id);
    const state=()=>service.state(id,owner.id),revision=async()=>(await state()).revision;
    const get=key=>db.scheduledConsequence.findUniqueOrThrow({where:{id:key}});
    const npcGet=entityId=>db.campaignNpc.findUniqueOrThrow({where:{entityId}});
    const propose=async minutes=>game.request(id,actor,{requestKey:randomUUID(),expectedSceneRevision:(await game.state(id,owner.id)).scene.revision,operation:{kind:'ADVANCE_TIME',minutes,reason:'Ensaio de prazos.'}});
    const commit=async(action,service=game)=>service.resolve(id,action.id,actor,{decision:'COMMIT',expectedRevision:await revision()});
    const advance=async minutes=>commit(await propose(minutes));
    const policy=async values=>service.policy(id,owner.id,{expectedRevision:await revision(),...(await state()).policy,...values});
    const input=async values=>({expectedRevision:await revision(),requestKey:randomUUID(),kind:'REMINDER',title:'Revisar o mundo',text:'Lembrete privado de teste.',delayMinutes:5,autoApproved:true,...values});
    const schedule=async values=>service.schedule(id,owner.id,await input(values));
    const resolve=async(item,decision='APPLY')=>service.resolve(id,owner.id,item.id,{decision,expectedRevision:await revision()});
    const postpone=async(item,delayMinutes=5)=>service.postpone(id,owner.id,item.id,{expectedRevision:await revision(),delayMinutes,autoApproved:true});
    const jwt=app.get(JwtService),auth=u=>`Bearer ${jwt.sign({sub:u.id,email:u.email})}`,http=request(app.getHttpServer()),path=`/api/campaigns/${id}/consequences`;
    assert.equal((await state()).policy.enabled,false);
    await http.get(path).expect(401);for(const u of [player,outsider])await http.get(path).set('Authorization',auth(u)).expect(403);
    const body=await input({});await http.post(path).set('Authorization',auth(owner)).send({...body,sql:'SELECT 1'}).expect(400);
    await http.post(path).set('Authorization',auth(owner)).send({...body,kind:'NPC_ARRIVE'}).expect(400);
    await http.patch(path+'/policy').set('Authorization',auth(owner)).send({expectedRevision:body.expectedRevision,enabled:true,paused:false,allowNpcTravel:true,maxPerAdvance:99}).expect(400);
    await http.post(path).set('Authorization',auth(player)).send(body).expect(403);
    const repeated=await Promise.all([service.schedule(id,owner.id,body),service.schedule(id,owner.id,body)]);assert.equal(repeated[0].id,repeated[1].id);
    await assert.rejects(service.schedule(id,owner.id,{...body,title:'Outra instrução'}),conflict);
    await assert.rejects(resolve(repeated[0]),conflict);
    await advance(5);assert.equal((await get(repeated[0].id)).reasonCode,'DISABLED');
    await policy({enabled:true,allowNpcTravel:true});await advance(1);assert.equal((await get(repeated[0].id)).status,'WAITING_MASTER');
    await resolve(repeated[0]);assert.equal((await resolve(repeated[0])).alreadyApplied,true);
    const event=await db.storyEvent.findUniqueOrThrow({where:{id:(await get(repeated[0].id)).resultEventId},include:{audience:true}});assert.equal(event.audience.scope,'MASTER');
    assert.ok(!(JSON.stringify(await app.get(StoryService).state(id,player.id))).includes('Lembrete privado de teste.'));
    const unapproved=await schedule({autoApproved:false});await advance(5);assert.equal((await get(unapproved.id)).reasonCode,'APPROVAL_REQUIRED');await resolve(unapproved,'CANCEL');
    const cancelled=await schedule({});await resolve(cancelled,'CANCEL');await assert.rejects(resolve(cancelled),conflict);
    await policy({paused:true});const paused=await schedule({});await advance(5);assert.equal((await get(paused.id)).reasonCode,'PAUSED');
    await policy({paused:false});await advance(1);assert.equal((await get(paused.id)).status,'WAITING_MASTER');await postpone(paused);await advance(5);assert.equal((await get(paused.id)).status,'APPLIED');
    const globalPause=await schedule({});await db.campaignLore.update({where:{campaignId:id},data:{aiPaused:true}});await advance(5);assert.equal((await get(globalPause.id)).reasonCode,'PAUSED');await db.campaignLore.update({where:{campaignId:id},data:{aiPaused:false}});await resolve(globalPause,'CANCEL');
    await policy({maxPerAdvance:1});const one=await schedule({delayMinutes:1}),two=await schedule({delayMinutes:2});await advance(2);assert.equal((await get(one.id)).status,'APPLIED');assert.equal((await get(two.id)).reasonCode,'BUDGET');await resolve(two,'CANCEL');await policy({maxPerAdvance:4});
    const groupPlace=(await game.state(id,owner.id)).scene.placeId;
    const npc=await db.campaignNpc.findFirstOrThrow({where:{campaignId:id,entity:{key:'mara'}}});
    const route=await db.travelRoute.findFirstOrThrow({where:{campaignId:id,fromEntityId:npc.placeEntityId,toEntityId:{not:groupPlace},blocked:false}});
    assert.notEqual(npc.placeEntityId,groupPlace);
    const tripInput={kind:'NPC_DEPART',title:'Viagem de Mara',npcEntityId:npc.entityId,routeId:route.id,delayMinutes:1};
    const foreign=await db.travelRoute.findFirstOrThrow({where:{campaignId:other}});
    await assert.rejects(schedule({...tripInput,routeId:foreign.id}),conflict);
    const objects=await db.campaignPlotObject.findMany({where:{campaignId:id},orderBy:{entityId:'asc'}});
    const trip=await schedule(tripInput),departureMinute=(await get(trip.id)).dueMinute;
    const action=await advance(1);assert.equal((await npcGet(npc.entityId)).activeJourneyId,trip.id);assert.equal((await npcGet(npc.entityId)).placeEntityId,route.fromEntityId);
    const arrival=await db.scheduledConsequence.findUniqueOrThrow({where:{parentId:trip.id}});assert.equal(arrival.dueMinute,departureMinute+route.minutes);
    // Even at the historical origin, presence queries must exclude a travelling NPC.
    await db.sceneState.update({where:{campaignId:id},data:{placeEntityId:route.fromEntityId}});
    assert.ok(!(await app.get(GameMasterService).state(id,owner.id)).npcs.some(n=>n.id===npc.entityId));
    assert.ok(!(await app.get(PlayerIntentsService).state(id,player.id)).npcs.some(n=>n.id===npc.entityId));
    await db.sceneState.update({where:{campaignId:id},data:{placeEntityId:groupPlace}});
    const resumed=spawnSync(process.execPath,[__filename,'--resume'],{env:{...process.env,CONSEQUENCE_FIXTURE:JSON.stringify({id,npc:npc.entityId,trip:trip.id,arrival:arrival.id,events:await db.storyEvent.count({where:{campaignId:id}})})},stdio:'inherit'});assert.equal(resumed.status,0);
    const fact=await db.storyFact.findUniqueOrThrow({where:{campaignId_key:{campaignId:id,key:`NPC_LOC_${npc.entityId}`}},include:{revisions:true}});
    // Another NPC's prior observation must remain unchanged after the arrival.
    const witness=await db.campaignNpc.findFirstOrThrow({where:{campaignId:id,entityId:{not:npc.entityId}}});
    const observation=await db.entityKnowledge.create({data:{campaignId:id,knowerEntityId:witness.entityId,factRevisionId:fact.revisions[0].id,sourceEventId:fact.revisions[0].sourceEventId,stance:'KNOWN',source:'Observou a partida.'}});
    await policy({paused:true});await advance(route.minutes);assert.equal((await get(arrival.id)).reasonCode,'PAUSED');assert.equal((await npcGet(npc.entityId)).activeJourneyId,trip.id);
    await assert.rejects(resolve(arrival,'CANCEL'),conflict);await policy({paused:false});await advance(1);assert.equal((await get(arrival.id)).status,'WAITING_MASTER');await resolve(arrival);
    assert.equal((await npcGet(npc.entityId)).activeJourneyId,null);assert.equal((await npcGet(npc.entityId)).placeEntityId,route.toEntityId);
    assert.equal((await db.storyFact.findUniqueOrThrow({where:{id:fact.id}})).currentVersion,2);
    assert.equal((await db.entityKnowledge.findUniqueOrThrow({where:{id:observation.id}})).factRevisionId,fact.revisions[0].id);
    assert.deepEqual(await db.campaignPlotObject.findMany({where:{campaignId:id},orderBy:{entityId:'asc'}}),objects);
    assert.equal((await app.get(StoryService).state(id,owner.id)).facts.find(f=>f.id===fact.id).editable,false);
    assert.equal((await game.resolve(id,action.id,actor,{decision:'COMMIT',expectedRevision:0})).alreadyApplied,true);
    const resetNpc=()=>db.campaignNpc.update({where:{entityId:npc.entityId},data:{placeEntityId:route.fromEntityId,currentHp:npc.currentHp,conditions:npc.conditions,activeJourneyId:null}});
    await resetNpc();const complete=await schedule(tripInput);const start=(await state()).totalMinutes;await advance(1+route.minutes);
    const events=await db.storyEvent.findMany({where:{campaignId:id,gameMinute:{gt:start}},orderBy:{sequence:'asc'}});
    assert.deepEqual(events.map(e=>e.kind),['NPC_DEPARTED','NPC_ARRIVED','CLOCK_ADVANCED']);assert.equal(events[0].gameMinute,start+1);assert.equal(events[1].gameMinute,start+1+route.minutes);
    assert.equal((await get(complete.id)).status,'APPLIED');
    // Mutated health/route, nearby players and live dialogue demand review.
    for(const condition of ['health','route','endpoint','group','conversation','travelDisabled']){
      await resetNpc();const item=await schedule(tripInput);let turn;
      if(condition==='health')await db.campaignNpc.update({where:{entityId:npc.entityId},data:{currentHp:npc.currentHp-1}});
      if(condition==='route')await db.travelRoute.update({where:{id:route.id},data:{blocked:true}});
      if(condition==='endpoint')await db.travelRoute.update({where:{id:route.id},data:{toEntityId:route.fromEntityId}});
      if(condition==='group')await db.sceneState.update({where:{campaignId:id},data:{placeEntityId:route.fromEntityId}});
      if(condition==='travelDisabled')await policy({allowNpcTravel:false});
      if(condition==='conversation')turn=await db.gameMasterTurn.create({data:{campaignId:id,requestedById:player.id,requestKey:randomUUID(),requestHash:'f'.repeat(64),kind:'NPC',prompt:'Conversa de teste',focusEntityId:npc.entityId,playerEntityId:pc.entityId,expectedRevision:await revision(),sceneRevision:1,epoch:0,status:'WAITING_PLAYER',context:'{}'}});
      await advance(1);assert.equal((await get(item.id)).status,'WAITING_MASTER',condition);assert.equal((await npcGet(npc.entityId)).activeJourneyId,null,condition);
      if(turn)await db.gameMasterTurn.delete({where:{id:turn.id}});
      await db.travelRoute.update({where:{id:route.id},data:{blocked:false,toEntityId:route.toEntityId}});await db.sceneState.update({where:{campaignId:id},data:{placeEntityId:groupPlace}});await policy({allowNpcTravel:true});await resolve(item,'CANCEL');
    }
    await resetNpc();
    // Failure after NPC departure/arrival and calendar writes rolls the entire command back.
    const rollback=await schedule(tripInput),pendingAction=await propose(1+route.minutes),before=await state(),beforeNpc=await npcGet(npc.entityId),beforeEvents=await db.storyEvent.count({where:{campaignId:id}});
    let calls=0;const failing=new GameActionsService(db.$extends({query:{outboxEvent:{async create({args,query}){if(++calls===3)throw new Error('INJECTED_FINAL_OUTBOX_FAILURE');return query(args);}}}}));
    await assert.rejects(commit(pendingAction,failing),/INJECTED_FINAL_OUTBOX_FAILURE/);assert.deepEqual(await state(),before);assert.deepEqual(await npcGet(npc.entityId),beforeNpc);assert.equal(await db.storyEvent.count({where:{campaignId:id}}),beforeEvents);assert.equal(await db.scheduledConsequence.count({where:{parentId:rollback.id}}),0);
    await commit(pendingAction);
    // Two independent clock approvals compete on the same revision; only one can commit.
    const concurrent=await schedule({delayMinutes:1}),aa=await propose(1),bb=await propose(1),rev=await revision();
    const race=await Promise.allSettled([aa,bb].map(a=>game.resolve(id,a.id,actor,{decision:'COMMIT',expectedRevision:rev})));assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal((await get(concurrent.id)).status,'APPLIED');
    for(const a of [aa,bb])if((await db.gameAction.findUniqueOrThrow({where:{id:a.id}})).status==='PENDING')await game.resolve(id,a.id,actor,{decision:'CANCEL'});
    // Reassigning the master invalidates old capability grants; no inherited automatic authorization.
    const ownership=await schedule({delayMinutes:1});await db.campaign.update({where:{id},data:{masterId:outsider.id}});
    const s=await game.state(id,outsider.id),a=await game.request(id,{kind:'USER',userId:outsider.id},{requestKey:randomUUID(),expectedSceneRevision:s.scene.revision,operation:{kind:'ADVANCE_TIME',minutes:1,reason:'Troca do mestre.'}});
    await game.resolve(id,a.id,{kind:'USER',userId:outsider.id},{decision:'COMMIT',expectedRevision:s.revision});assert.equal((await get(ownership.id)).reasonCode,'AUTHORIZATION_CHANGED');await db.campaign.update({where:{id},data:{masterId:owner.id}});await resolve(ownership,'CANCEL');
    const preset=await service.preset(id,owner.id,{expectedRevision:await revision(),autoApproved:false});assert.equal(preset.created,6);assert.equal((await service.preset(id,owner.id,{expectedRevision:await revision(),autoApproved:false})).created,0);
    const genesis=await db.storyEvent.findFirstOrThrow({where:{campaignId:id,kind:'GENESIS'}}),presetItems=await db.scheduledConsequence.findMany({where:{campaignId:id,requestKey:{startsWith:'lore-pressure-v1:'}}});assert.deepEqual(presetItems.map(i=>i.dueMinute-genesis.gameMinute).sort((a,b)=>a-b),[720,1440,1530,2160,2880,2880]);
    const foreignNpc=await db.campaignNpc.findFirstOrThrow({where:{campaignId:other}});await assert.rejects(db.scheduledConsequence.update({where:{id:ownership.id},data:{npcEntityId:foreignNpc.entityId}}),e=>e.code==='P2003');
    // The preset never moves cargo or kills injured characters.
    assert.deepEqual(await db.campaignPlotObject.findMany({where:{campaignId:id},orderBy:{entityId:'asc'}}),objects);
    if(process.argv.includes('--browser'))await require('./browser.cjs').check(app,{id,owner,player});
    console.log('OK: deadlines, permissions, replay, bounded policy, pauses, ordered journeys, presence, factual revisions, stale observations, cargo preservation, guards, rollback, clock concurrency, ownership and preset.');
  }finally{
    try{for(const id of ids.reverse()){await db.campaign.update({where:{id},data:{masterId:users[0].id}});await app.get(CampaignsService).remove(id,users[0].id);}for(const u of users.reverse())await db.user.delete({where:{id:u.id}});}finally{await app.close();}
  }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
