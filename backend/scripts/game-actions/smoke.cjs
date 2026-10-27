require('reflect-metadata');
require('dotenv').config({quiet:true});
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const request=require('supertest');
const {NestFactory}=require('@nestjs/core');
const {ValidationPipe}=require('@nestjs/common');
const {SchedulerRegistry}=require('@nestjs/schedule');
const {JwtService}=require('@nestjs/jwt');
const {AppModule}=require('../../dist/src/app.module');
const {PrismaService}=require('../../dist/src/prisma/prisma.service');
const {GameActionsService}=require('../../dist/src/game-actions/game-actions.service');
const {StoryService}=require('../../dist/src/story/story.service');
const {StoryOutboxService}=require('../../dist/src/story/story-outbox.service');
const {LoreInstallService}=require('../../dist/src/lore/lore-install.service');
const {LorePackLoader}=require('../../dist/src/lore/lore.loader');
const {CampaignsService}=require('../../dist/src/campaigns/campaigns.service');
const actor=u=>({kind:'USER',userId:u.id});
const conflict=e=>e.status===409;
async function appInstance(){
  const app=await NestFactory.create(AppModule,{logger:false});
  app.setGlobalPrefix('api');app.enableCors();
  app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
  await app.init();
  const scheduler=app.get(SchedulerRegistry);
  for(const name of scheduler.getIntervals())scheduler.deleteInterval(name);
  return app;
}
async function main(){
  if(!/^\/rpg_lore_check_\d+$/.test(new URL(process.env.DATABASE_URL).pathname))throw new Error('Requires disposable rehearsal database');
  let app=await appInstance();
  let db=app.get(PrismaService),game=app.get(GameActionsService),story=app.get(StoryService);
  if(process.argv.includes('--resume')){
    try{
      const f=JSON.parse(process.env.ACTION_RESUME_FIXTURE),s=await game.state(f.id,f.ownerId);
      assert.equal(s.clock.totalMinutes,f.minutes);assert.equal(s.scene.placeId,f.placeId);
      assert.equal((await db.gameAction.findUniqueOrThrow({where:{id:f.actionId}})).status,'COMMITTED');
      assert.equal((await story.state(f.id,f.ownerId)).facts.find(x=>x.key==='C07').text,f.location);
      const calls=[];const worker=new StoryOutboxService(db,{async emitStoryUpdateToUser(...args){calls.push(args);}});
      await worker.drain();
      assert.ok(calls.some(c=>c[2]===f.eventId));
      assert.equal((await db.outboxEvent.findUniqueOrThrow({where:{eventId:f.eventId}})).status,'DELIVERED');
      const replay=await game.resolve(f.id,f.actionId,{kind:'USER',userId:f.ownerId},{decision:'COMMIT',expectedRevision:0});
      assert.equal(replay.alreadyApplied,true);assert.equal((await game.state(f.id,f.ownerId)).clock.totalMinutes,f.minutes);
      console.log('OK: fresh process recovered committed state and expired outbox lease without applying effects twice.');
    }finally{await app.close();}return;
  }
  const users=[],campaignIds=[];
  try{
    const installer=app.get(LoreInstallService),jwt=app.get(JwtService),http=request(app.getHttpServer());
    for(let i=0;i<6;i++)users.push(await db.user.create({data:{email:`actions-${i}-${randomUUID()}@example.test`,displayName:`Teste ${i}`,passwordHash:randomUUID()}}));
    const [owner,...others]=users,players=others.slice(0,4),outsider=others[4];
    const auth=u=>`Bearer ${jwt.sign({sub:u.id,email:u.email})}`;
    const pack=app.get(LorePackLoader).load('eldoria-tres-sinos','1.0.0');
    const fresh=async()=>{const r=await installer.create(owner.id,{packId:'eldoria-tres-sinos',version:'1.0.0',expectedHash:pack.contentHash,allowDraft:true,name:'MI-04 ensaio',requestKey:randomUUID()});campaignIds.push(r.campaignId);return r.campaignId;};
    const id=await fresh(),other=await fresh(),path=`/api/campaigns/${id}/game-actions`;
    await db.campaignMember.createMany({data:players.map(u=>({campaignId:id,userId:u.id,role:'PLAYER'}))});
    const pcs=[];
    for(const u of players){
      const c=await db.character.create({data:{userId:u.id,name:`Herói ${pcs.length+1}`,race:'Humano',class:'Mago',maxHp:20,currentHp:10,tempHp:2}});
      pcs.push({...await installer.attachCharacter(id,u.id,c.id),characterId:c.id});
      await db.characterSpellSlot.create({data:{characterId:c.id,level:1,total:2,used:2}});
    }
    const state=()=>game.state(id,owner.id);
    const propose=async(op,u=owner,pc)=>game.request(id,actor(u),{requestKey:randomUUID(),expectedSceneRevision:(await state()).scene.revision,operation:op,...(pc?{characterEntityId:pc.entityId}:{})});
    const commit=async(a,service=game)=>service.resolve(id,a.id,actor(owner),{decision:'COMMIT',expectedRevision:(await state()).revision});
    const execute=async op=>commit(await propose(op));
    const cancel=async a=>game.resolve(id,a.id,actor(owner),{decision:'CANCEL'});
    const baseline=await state();assert.equal(baseline.participants.length,4);assert.equal(baseline.objects.length,6);
    assert.equal((await story.state(id,owner.id)).facts.length,33);
    assert.equal((await game.state(id,players[0].id)).objects,undefined);
    await http.get(path+'/state').expect(401);
    await http.get(path+'/state').set('Authorization',auth(outsider)).expect(403);
    await assert.rejects(game.request(id,{kind:'AI_MASTER',initiatedById:owner.id},{requestKey:randomUUID(),expectedSceneRevision:0,operation:{kind:'REST',type:'LONG'}}),e=>e.status===403);
    const body={requestKey:randomUUID(),expectedSceneRevision:baseline.scene.revision,operation:{kind:'REST',type:'SHORT'},characterEntityId:pcs[0].entityId};
    await http.post(path).set('Authorization',auth(players[0])).send({...body,actor:{kind:'USER',userId:owner.id}}).expect(400);
    await http.post(path).set('Authorization',auth(players[0])).send({...body,operation:{...body.operation,sql:'SELECT 1'}}).expect(400);
    await assert.rejects(propose({kind:'REST',type:'SHORT'},players[0],pcs[1]),e=>e.status===403);
    await assert.rejects(propose({kind:'ADVANCE_TIME',minutes:60,reason:'forbidden'},players[0],pcs[0]),e=>e.status===403);
    const repeats=await Promise.all([game.request(id,actor(players[0]),body),game.request(id,actor(players[0]),body)]);
    assert.equal(repeats[0].id,repeats[1].id);assert.equal(repeats.filter(r=>r.alreadyRequested).length,1);
    await assert.rejects(game.request(id,actor(players[0]),{...body,operation:{kind:'REST',type:'LONG'}}),conflict);
    await assert.rejects(game.resolve(id,repeats[0].id,actor(players[0]),{decision:'COMMIT',expectedRevision:baseline.revision}),e=>e.status===403);
    await game.resolve(id,repeats[0].id,actor(players[0]),{decision:'CANCEL'});
    await assert.rejects(commit(repeats[0]),conflict);assert.equal((await state()).clock.totalMinutes,baseline.clock.totalMinutes);
    const rejected=await propose({kind:'REST',type:'SHORT'});await game.resolve(id,rejected.id,actor(owner),{decision:'REJECT',reason:'Ainda não.'});
    // No group and combat/incapacitated characters never receive travel/rest effects.
    const empty=await game.state(other,owner.id);
    const emptyAction=await game.request(other,actor(owner),{requestKey:randomUUID(),expectedSceneRevision:empty.scene.revision,operation:{kind:'REST',type:'LONG'}});
    await assert.rejects(game.resolve(other,emptyAction.id,actor(owner),{decision:'COMMIT',expectedRevision:empty.revision}),conflict);
    const blocked=await propose({kind:'REST',type:'LONG'});
    await db.combatEncounter.create({data:{campaignId:id}});await assert.rejects(commit(blocked),conflict);await db.combatEncounter.delete({where:{campaignId:id}});
    await db.character.update({where:{id:pcs[0].characterId},data:{currentHp:0}});await assert.rejects(commit(blocked),conflict);
    await db.character.update({where:{id:pcs[0].characterId},data:{currentHp:10}});await cancel(blocked);
    const allRoutes=await db.travelRoute.findMany({where:{campaignId:id},include:{from:{include:{entity:true}},to:{include:{entity:true}}}});
    const walkTo=async predicate=>{
      const current=(await state()).scene.placeId,queue=[[current,[]]],visited=new Set([current]);let path;
      while(queue.length){const [at,steps]=queue.shift();if(predicate(at)){path=steps;break;}
        for(const r of allRoutes.filter(r=>r.fromEntityId===at&&!r.blocked&&r.to.entity.key!=='abadia'))if(!visited.has(r.toEntityId)){visited.add(r.toEntityId);queue.push([r.toEntityId,[...steps,r]]);}}
      assert.ok(path,'connected route');for(const r of path)await execute({kind:'TRAVEL',routeId:r.id});
    };
    const sixty=allRoutes.find(r=>r.minutes===60&&!r.blocked&&r.from.entity.key==='porto');assert.ok(sixty);
    await walkTo(at=>at===sixty.fromEntityId);
    const travelStart=await state();
    const travel=await Promise.all(players.map((u,i)=>propose({kind:'TRAVEL',routeId:sixty.id},u,pcs[i])));
    assert.equal((await state()).clock.totalMinutes,travelStart.clock.totalMinutes);
    const revision=travelStart.revision;
    const race=await Promise.allSettled(travel.map(a=>game.resolve(id,a.id,actor(owner),{decision:'COMMIT',expectedRevision:revision})));
    assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.filter(r=>r.status==='rejected'&&conflict(r.reason)).length,3);
    assert.equal((await state()).clock.totalMinutes,travelStart.clock.totalMinutes+60);
    const winner=race.find(r=>r.status==='fulfilled').value;
    assert.equal((await game.resolve(id,winner.id,actor(owner),{decision:'COMMIT',expectedRevision:revision})).alreadyApplied,true);
    for(const a of travel)if(a.id!==winner.id){await assert.rejects(commit(a),conflict);await cancel(a);}
    const localRoute=(await state()).routes.find(r=>r.published&&!r.blocked);
    await db.travelRoute.update({where:{id:localRoute.id},data:{blocked:true}});
    await assert.rejects(propose({kind:'TRAVEL',routeId:localRoute.id}),conflict);await db.travelRoute.update({where:{id:localRoute.id},data:{blocked:false}});
    const foreignRoute=await db.travelRoute.findFirstOrThrow({where:{campaignId:other}});
    await assert.rejects(propose({kind:'TRAVEL',routeId:foreignRoute.id}),e=>e.status===404);
    const box=await db.campaignPlotObject.findFirstOrThrow({where:{campaignId:id,entity:{key:'caixote'}}});
    const clapper=await db.campaignPlotObject.findFirstOrThrow({where:{campaignId:id,entity:{key:'badajo'}}});
    assert.equal(clapper.containerEntityId,box.entityId);
    await walkTo(at=>at===box.placeEntityId);
    const original=(await story.state(id,owner.id)),c07=original.facts.find(f=>f.key==='C07'),mara=original.entities.find(e=>e.key==='mara');
    assert.equal(c07.editable,false);
    for(const kind of ['FACT_UPDATE','CORRECTION'])await assert.rejects(story.command(id,owner.id,{requestKey:randomUUID(),expectedRevision:original.revision,operation:{kind,factId:c07.id,text:'Teletransporte',reason:'Teste',audience:{scope:'MASTER',recipientIds:[]}}}),conflict);
    const takeOp={kind:'TAKE_OBJECT',objectId:box.entityId,carrierId:pcs[0].entityId,visibility:'MASTER'};
    const contained=await propose({...takeOp,objectId:clapper.entityId});await assert.rejects(commit(contained),conflict);await cancel(contained);
    const foreignObject=await db.campaignPlotObject.findFirstOrThrow({where:{campaignId:other}});
    const foreign=await propose({...takeOp,objectId:foreignObject.entityId});await assert.rejects(commit(foreign),conflict);await cancel(foreign);
    await assert.rejects(db.campaignPlotObject.update({where:{entityId:box.entityId},data:{containerEntityId:foreignObject.entityId}}),e=>e.code==='P2003');
    const beforePrivate=await game.state(id,players[0].id),playerStory=await story.state(id,players[0].id);
    const takes=await Promise.all([propose(takeOp),propose({...takeOp,carrierId:pcs[1].entityId})]);
    const takeRev=(await state()).revision;
    const took=await Promise.allSettled(takes.map(a=>game.resolve(id,a.id,actor(owner),{decision:'COMMIT',expectedRevision:takeRev})));
    assert.equal(took.filter(r=>r.status==='fulfilled').length,1);assert.equal(took.filter(r=>r.status==='rejected'&&conflict(r.reason)).length,1);
    for(let i=0;i<took.length;i++)if(took[i].status==='rejected'){await assert.rejects(commit(takes[i]),conflict);await cancel(takes[i]);}
    assert.deepEqual(await game.state(id,players[0].id),beforePrivate);assert.deepEqual(await story.state(id,players[0].id),playerStory);
    const abbey=await db.campaignPlace.findFirstOrThrow({where:{campaignId:id,entity:{key:'abadia'}}});
    // Destination map visibility is rechecked at commit, including master proposals.
    const abbeyRoute=allRoutes.find(r=>r.toEntityId===abbey.entityId);
    await walkTo(at=>at===abbeyRoute.fromEntityId);
    const unpublished=await propose({kind:'TRAVEL',routeId:abbeyRoute.id});await assert.rejects(commit(unpublished),conflict);await cancel(unpublished);
    await db.vttMap.update({where:{id:abbey.mapId},data:{published:true}});
    await execute({kind:'TRAVEL',routeId:abbeyRoute.id});
    await execute({kind:'DROP_OBJECT',objectId:box.entityId,visibility:'MASTER'});
    const moved=await db.campaignPlotObject.findMany({where:{entityId:{in:[box.entityId,clapper.entityId]}}});assert.ok(moved.every(o=>o.placeEntityId===abbey.entityId));
    const memory=await story.state(id,owner.id),location=memory.facts.find(f=>f.key==='C07');assert.match(location.text,/Abadia/);assert.notEqual(location.text,c07.text);
    assert.equal(memory.knowledge.find(k=>k.knowerId===mara.id&&k.factId===c07.id).stale,true);
    assert.ok((await story.actorKnowledge(id,owner.id,mara.id)).knowledge.some(k=>k.text===c07.text));
    assert.equal((await story.factHistory(id,owner.id,c07.id)).revisions[0].text,c07.text);
    for(const key of ['C05','C09'])assert.equal(memory.facts.find(f=>f.key===key).text,original.facts.find(f=>f.key===key).text);
    assert.ok((await story.events(id,owner.id,{entityId:box.entityId})).events.some(e=>e.kind==='GROUP_TRAVEL'));
    const restStart=(await state()).clock.totalMinutes;
    await execute({kind:'REST',type:'SHORT'});assert.equal((await state()).clock.totalMinutes,restStart+60);
    assert.equal((await db.character.findUniqueOrThrow({where:{id:pcs[0].characterId}})).currentHp,10);
    await execute({kind:'REST',type:'LONG'});assert.equal((await state()).clock.totalMinutes,restStart+540);
    for(const pc of pcs){const c=await db.character.findUniqueOrThrow({where:{id:pc.characterId},include:{spellSlots:true}});assert.equal(c.currentHp,20);assert.equal(c.tempHp,0);assert.ok(c.spellSlots.every(s=>s.used===0));}
    // A late failure, after clock/event/action writes, must roll back every effect.
    const failing=new GameActionsService(db.$extends({query:{outboxEvent:{async create(){throw new Error('INJECTED_OUTBOX_FAILURE');}}}}));
    const advance=await propose({kind:'ADVANCE_TIME',minutes:17,reason:'Teste de continuidade.'});
    const beforeFailure=await state(),events=await db.storyEvent.count({where:{campaignId:id}});
    await assert.rejects(commit(advance,failing),/INJECTED_OUTBOX_FAILURE/);
    assert.deepEqual(await state(),beforeFailure);assert.equal(await db.storyEvent.count({where:{campaignId:id}}),events);
    const confirmed=await commit(advance);assert.equal((await state()).clock.totalMinutes,beforeFailure.clock.totalMinutes+17);
    // Legacy paths cannot mutate the same world without an event.
    const {WorldService}=require('../../dist/src/world/world.service');const world=app.get(WorldService);
    await assert.rejects(world.addMinutes(id,1),conflict);
    const {CharactersService}=require('../../dist/src/characters/characters.service');
    await assert.rejects(app.get(CharactersService).longRest(pcs[0].characterId,players[0].id),e=>e.status===400);
    // Clear prior dispatches only in this disposable fixture, then test audiences/retries.
    await db.outboxEvent.updateMany({data:{status:'DELIVERED',deliveredAt:new Date()}});
    const note=async(audience,text)=>story.command(id,owner.id,{requestKey:randomUUID(),expectedRevision:(await state()).revision,operation:{kind:'NOTE',text,entityIds:[],audience}});
    const privateEvent=await note({scope:'MASTER',recipientIds:[]},'Segredo de teste');
    const recipientEvent=await note({scope:'RECIPIENTS',recipientIds:[players[0].id,players[3].id]},'Informação dirigida');
    const publicEvent=await note({scope:'PUBLIC',recipientIds:[]},'Informação pública');
    const pendingRemoved=await propose({kind:'REST',type:'SHORT'},players[3],pcs[3]);
    await db.campaignMember.deleteMany({where:{campaignId:id,userId:players[3].id}});await assert.rejects(commit(pendingRemoved),conflict);await cancel(pendingRemoved);
    await assert.rejects(game.state(id,players[3].id),e=>e.status===403);
    const calls=[];let fail=true;
    const gateway={async emitStoryUpdateToUser(...args){if(fail)throw new Error('transport down');calls.push(args);}};
    const worker=new StoryOutboxService(db,gateway);await worker.drain();
    assert.equal(calls.length,0);assert.equal(await db.outboxEvent.count({where:{status:'PENDING',lastError:'DELIVERY_FAILED'}}),3);
    await db.outboxEvent.updateMany({where:{status:'PENDING'},data:{availableAt:new Date(0)}});fail=false;
    await Promise.all([worker.drain(),new StoryOutboxService(db,gateway).drain()]);
    const recipients=e=>calls.filter(c=>c[2]===e.eventId).map(c=>c[1]).sort();
    assert.deepEqual(recipients(privateEvent),[owner.id]);
    assert.deepEqual(recipients(recipientEvent),[owner.id,players[0].id].sort());
    assert.deepEqual(recipients(publicEvent),[owner.id,...players.slice(0,3).map(p=>p.id)].sort());
    assert.ok(calls.every(c=>c.length===3&&c[0]===id));
    const final=await state();
    await db.outboxEvent.update({where:{eventId:confirmed.eventId},data:{status:'PROCESSING',leaseToken:randomUUID(),leaseUntil:new Date(0),deliveredAt:null}});
    const fixture={id,ownerId:owner.id,actionId:confirmed.id,eventId:confirmed.eventId,minutes:final.clock.totalMinutes,placeId:final.scene.placeId,location:location.text};
    await app.close();
    const resumed=spawnSync(process.execPath,[__filename,'--resume'],{env:{...process.env,ACTION_RESUME_FIXTURE:JSON.stringify(fixture)},stdio:'inherit'});assert.equal(resumed.status,0);
    app=await appInstance();db=app.get(PrismaService);game=app.get(GameActionsService);story=app.get(StoryService);
    if(process.argv.includes('--browser'))await require('./browser.cjs').check(app,{id,owner,player:players[0],pc:pcs[0]});
    console.log('OK: four-person travel, containment/location facts, stale NPC memory, rest, pending/replayed/concurrent actions, rollback, tenant/actor authorization, revoked membership, durable private/public outbox and restart.');
  }finally{
    try{for(const id of campaignIds.reverse())await app.get(CampaignsService).remove(id,users[0].id);for(const u of users.reverse())await app.get(PrismaService).user.delete({where:{id:u.id}});}
    finally{await app.close();}
  }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
