require('reflect-metadata');require('dotenv').config({quiet:true});
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{spawnSync}=require('node:child_process');
const request=require('supertest'),{NestFactory}=require('@nestjs/core'),{ValidationPipe}=require('@nestjs/common'),{SchedulerRegistry}=require('@nestjs/schedule'),{JwtService}=require('@nestjs/jwt');
const {AppModule}=require('../../dist/src/app.module'),{PrismaService}=require('../../dist/src/prisma/prisma.service');
const {GameMasterService}=require('../../dist/src/game-master/game-master.service'),{GameMasterContext}=require('../../dist/src/game-master/game-master.context'),{GameMasterProvider}=require('../../dist/src/game-master/ollama.provider');
const {GameActionsService}=require('../../dist/src/game-actions/game-actions.service'),{StoryService}=require('../../dist/src/story/story.service');
const {LoreInstallService}=require('../../dist/src/lore/lore-install.service'),{LorePackLoader}=require('../../dist/src/lore/lore.loader'),{CampaignsService}=require('../../dist/src/campaigns/campaigns.service');
const answer=(s,patch={})=>({kind:'ANSWER',text:'Resposta sustentada por registro.',evidenceIds:s.sources.slice(0,1).map(x=>x.id),routeId:null,restType:null,revisionId:null,knowerIds:[],sourceNpcId:null,...patch});
const conflict=e=>e.status===409;
async function appInstance(){const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api');app.enableCors();app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();const sch=app.get(SchedulerRegistry);for(const id of sch.getIntervals())sch.deleteInterval(id);return app;}
async function main(){
 if(!/^\/rpg_lore_check_\d+$/.test(new URL(process.env.DATABASE_URL).pathname))throw new Error('Requires disposable rehearsal database');
 let app=await appInstance(),db=app.get(PrismaService),gm=app.get(GameMasterService),ctx=app.get(GameMasterContext),game=app.get(GameActionsService),story=app.get(StoryService);
 if(process.argv.includes('--resume')){try{const f=JSON.parse(process.env.COPILOT_RESUME_FIXTURE);assert.equal((await gm.detail(f.id,f.ownerId,f.turnId)).status,'COMMITTED');await gm.runNext();assert.equal((await gm.detail(f.id,f.ownerId,f.interruptedId)).status,'FAILED');assert.equal((await gm.resolve(f.id,f.ownerId,f.turnId,{decision:'ACCEPT'})).alreadyApplied,true);assert.equal((await game.state(f.id,f.ownerId)).clock.totalMinutes,f.minutes);if(f.intent){const {PlayerIntentsService}=require('../../dist/src/game-master/player-intents.service');const s=await app.get(PlayerIntentsService).state(f.id,f.intent.playerId),t=s.turns.find(t=>t.id===f.intent.turnId);assert.equal(t.status,'WAITING_PLAYER');assert.equal(t.reply,f.intent.reply);assert.equal(t.canReply,true);console.log('OK: approved question and private player conversation recovered after full backend restart.');}console.log('OK: persisted approval and interrupted inference recovered after full backend restart.');}finally{await app.close();}return;}
 const users=[],campaigns=[];
 try{
  for(const role of ['owner','player','outsider'])users.push(await db.user.create({data:{email:`copilot-${role}-${randomUUID()}@example.test`,displayName:`Teste ${role}`,passwordHash:randomUUID()}}));
  const [owner,player,outsider]=users,installer=app.get(LoreInstallService),pack=app.get(LorePackLoader).load('eldoria-tres-sinos','1.0.0');
  const installed=await installer.create(owner.id,{packId:'eldoria-tres-sinos',version:'1.0.0',expectedHash:pack.contentHash,allowDraft:true,name:'MI-05 ensaio',requestKey:randomUUID()});const id=installed.campaignId;campaigns.push(id);
  await db.campaignMember.create({data:{campaignId:id,userId:player.id,role:'PLAYER'}});
  const character=await db.character.create({data:{userId:player.id,name:'Lia',race:'Humano',class:'Guerreiro',currentHp:10,maxHp:20}}),pc=await installer.attachCharacter(id,player.id,character.id);
  const revision=async()=>(await db.campaignLore.findUniqueOrThrow({where:{campaignId:id}})).revision;
  let calls=0,behavior=s=>answer(s);const fake={async status(){return{available:true,model:'fixture'};},async generate(text){calls++;const s=JSON.parse(text),p=await behavior(s);return{text:typeof p==='string'?p:JSON.stringify(p),model:'fixture',inputTokens:100,outputTokens:40,latencyMs:1};}};
  const actual=app.get(GameMasterProvider);gm.provider=fake;
  const ask=async(prompt='Consulte os fatos.',kind='PLAN',focusEntityId)=>gm.request(id,owner.id,{requestKey:randomUUID(),kind,prompt,focusEntityId,expectedRevision:await revision()});
  const get=t=>gm.detail(id,owner.id,t.id),cancel=t=>gm.resolve(id,owner.id,t.id,{decision:'CANCEL'}),accept=(t,extra={})=>gm.resolve(id,owner.id,t.id,{decision:'ACCEPT',...extra});
  const configure=async(mode='COPILOT',paused=false)=>gm.settings(id,owner.id,{mode,paused,expectedRevision:await revision()});
  const http=request(app.getHttpServer()),jwt=app.get(JwtService),auth=u=>`Bearer ${jwt.sign({sub:u.id,email:u.email})}`,path=`/api/campaigns/${id}/game-master`;
  await http.get(path+'/state').expect(401);for(const u of [player,outsider])await http.get(path+'/state').set('Authorization',auth(u)).expect(403);
  await assert.rejects(ask(),conflict);await configure();
  const body={requestKey:randomUUID(),kind:'PLAN',prompt:'Quem roubou o badajo?',expectedRevision:await revision()};
  await http.post(path+'/actions').set('Authorization',auth(owner)).send({...body,sql:'SELECT 1'}).expect(400);
  const repeats=await Promise.all([gm.request(id,owner.id,body),gm.request(id,owner.id,body)]);assert.equal(repeats[0].id,repeats[1].id);
  await assert.rejects(gm.request(id,owner.id,{...body,prompt:'Outro pedido'}),conflict);
  const clockBefore=(await game.state(id,owner.id)).clock.totalMinutes;
  await gm.runNext();assert.equal((await get(repeats[0])).status,'READY');assert.equal(calls,1);assert.equal((await game.state(id,owner.id)).clock.totalMinutes,clockBefore);
  await http.get(`${path}/turns/${repeats[0].id}`).set('Authorization',auth(player)).expect(403);
  const readied=await get(repeats[0]);assert.ok(readied.context.sources.some(s=>s.id.startsWith('F:C05:')));
  await accept(repeats[0],{text:'Texto revisado explicitamente pelo mestre.',visibility:'PUBLIC'});
  assert.equal((await accept(repeats[0])).alreadyApplied,true);
  assert.ok((await story.events(id,player.id)).events.some(e=>e.summary.includes('Texto revisado explicitamente')));
  const pub=await db.$transaction(tx=>ctx.build(tx,id,'PUBLIC','Descreva a cena pública.'));
  assert.ok(!JSON.stringify(pub).includes('F:C05:'));assert.ok(!JSON.stringify(pub).includes('F:C09:'));
  const beforeLore=await story.state(id,owner.id);
  behavior=s=>answer(s,{kind:'TRAVEL',text:'Proponho percorrer a rota.',routeId:s.routes[0].id,evidenceIds:[]});
  const travel=await ask('Vamos pela rota disponível.');await gm.runNext();const readyTravel=await get(travel);assert.equal(readyTravel.status,'READY');const minutes=readyTravel.context.routes[0].minutes;
  const accepted=await Promise.all([accept(travel),accept(travel)]);assert.equal(accepted.filter(r=>r.alreadyApplied).length,1);assert.equal((await game.state(id,owner.id)).clock.totalMinutes,clockBefore+minutes);
  for(const key of ['C05','C09'])assert.equal((await story.state(id,owner.id)).facts.find(f=>f.key===key).text,beforeLore.facts.find(f=>f.key===key).text);
  // Locate a present NPC without granting them omniscience; no gameplay mutation is inferred from prose.
  const mara=await db.campaignNpc.findFirstOrThrow({where:{campaignId:id,entity:{key:'mara'}}});
  await db.sceneState.update({where:{campaignId:id},data:{placeEntityId:mara.placeEntityId,revision:{increment:1}}});await db.campaignLore.update({where:{campaignId:id},data:{revision:{increment:1}}});
  const npc=await db.$transaction(tx=>ctx.build(tx,id,'NPC','Onde está o badajo?',mara.entityId));
  assert.ok(npc.sources.length>0);assert.ok(npc.sources.every(s=>s.id.startsWith('K:')));assert.ok(!JSON.stringify(npc).includes('F:C09'));
  const dalia=await db.campaignNpc.findFirstOrThrow({where:{campaignId:id,entity:{key:'dalia'}}});await assert.rejects(db.$transaction(tx=>ctx.build(tx,id,'NPC','Fale.',dalia.entityId)),e=>e.status===404);
  // Discovery uses a real NPC observation, not the current master truth.
  behavior=s=>{const k=s.sources.find(x=>x.npcId===mara.entityId&&x.stance==='KNOWN');return answer(s,{kind:'DISCOVER',text:'Proponho registrar o que Mara contou.',evidenceIds:[k.id],sourceNpcId:mara.entityId,revisionId:k.revisionId,knowerIds:[pc.entityId]});};
  const discover=await ask('Mara contou a Lia o que sabe.','PLAN',mara.entityId);await gm.runNext();assert.equal((await get(discover)).status,'READY');await accept(discover);assert.ok((await story.state(id,player.id)).knowledge.length>0);
  behavior=s=>answer(s,{evidenceIds:['F:FOREIGN:1']});const invalid=await ask();const beforeCalls=calls;await gm.runNext();assert.equal(calls-beforeCalls,2);assert.equal((await get(invalid)).status,'FAILED');
  behavior=()=>{throw new Error('offline');};const offline=await ask();await gm.runNext();assert.equal((await get(offline)).errorCode,'PROVIDER_UNAVAILABLE');
  behavior=s=>answer(s);const stale=await ask();await story.command(id,owner.id,{requestKey:randomUUID(),expectedRevision:await revision(),operation:{kind:'NOTE',text:'Mudança de contexto',entityIds:[],audience:{scope:'MASTER',recipientIds:[]}}});await gm.runNext();assert.equal((await get(stale)).status,'STALE');await assert.rejects(accept(stale),conflict);
  // Pause while inference is in flight: late answer cannot revive the cancelled turn.
  let release,entered;const enteredPromise=new Promise(r=>entered=r);behavior=async s=>{entered();await new Promise(r=>release=r);return answer(s);};
  const paused=await ask(),inflight=gm.runNext();await enteredPromise;await configure('COPILOT',true);release();await inflight;assert.equal((await get(paused)).status,'CANCELLED');await assert.rejects(accept(paused),conflict);await configure();
  behavior=s=>answer(s);const cancelled=await ask();await cancel(cancelled);const beforeCancelled=calls;await gm.runNext();assert.equal(calls,beforeCancelled);
  const staleReady=await ask();await gm.runNext();assert.equal((await get(staleReady)).status,'READY');
  await story.command(id,owner.id,{requestKey:randomUUID(),expectedRevision:await revision(),operation:{kind:'NOTE',text:'Contexto alterado depois da resposta.',entityIds:[],audience:{scope:'MASTER',recipientIds:[]}}});
  await assert.rejects(accept(staleReady),conflict);await cancel(staleReady);
  const oneWorker=await ask(),beforeWorkers=calls;await Promise.all([gm.runNext(),gm.runNext()]);assert.equal(calls-beforeWorkers,1);await cancel(oneWorker);
  // Atomic reuse of the game command: even a late turn update failure rolls back clock/event/outbox.
  behavior=s=>answer(s,{kind:'REST',restType:'SHORT',text:'Descanso proposto.',evidenceIds:[]});const rest=await ask('Descansar.');await gm.runNext();assert.equal((await get(rest)).status,'READY');
  const beforeFailure=await game.state(id,owner.id),events=await db.storyEvent.count({where:{campaignId:id}});
  const failingDb=db.$extends({query:{gameMasterTurn:{async update({args,query}){if(args.data.status==='COMMITTED')throw new Error('TURN_COMMIT_FAILURE');return query(args);}}}});
  const failing=new GameMasterService(failingDb,ctx,fake,game,story);
  await assert.rejects(failing.resolve(id,owner.id,rest.id,{decision:'ACCEPT'}),/TURN_COMMIT_FAILURE/);assert.deepEqual(await game.state(id,owner.id),beforeFailure);assert.equal(await db.storyEvent.count({where:{campaignId:id}}),events);assert.equal((await get(rest)).status,'READY');await accept(rest);
  if(process.argv.includes('--model'))await require('./model-eval.cjs').check({db,id,owner,ctx,provider:actual,gm,mara,pc});
  if(process.argv.includes('--dialogue-model'))await require('./dialogue-model.cjs').check({app,db,id,owner,player,pc,mara,gm,provider:actual});
  const intent=process.argv.includes('--intents')?await require('./intents-eval.cjs').check({app,db,id,owner,player,outsider,gm,story,ctx,pc,mara,behavior:fn=>behavior=fn}):null;
  const interrupted=await ask();await db.gameMasterTurn.update({where:{id:interrupted.id},data:{status:'GENERATING',leaseToken:randomUUID(),leaseUntil:new Date(0)}});
  const fixture={id,ownerId:owner.id,turnId:rest.id,interruptedId:interrupted.id,minutes:(await game.state(id,owner.id)).clock.totalMinutes,intent};
  await app.close();const resumed=spawnSync(process.execPath,[__filename,'--resume'],{env:{...process.env,COPILOT_RESUME_FIXTURE:JSON.stringify(fixture)},stdio:'inherit'});assert.equal(resumed.status,0);
  app=await appInstance();db=app.get(PrismaService);gm=app.get(GameMasterService);gm.provider=fake;
  if(process.argv.includes('--browser'))await require('./browser.cjs').check(app,{id,owner,player,behavior:fn=>behavior=fn});
  if(process.argv.includes('--intents-browser'))await require('./intents-browser.cjs').check(app,{id,owner,player,pc,mara,behavior:fn=>behavior=fn});
  console.log('OK: private/public/NPC context, bounded schema repair, exact references, pending/replayed requests, approvals, discovery, pause in flight, stale state, provider outage, atomic rollback and restart.');
 }finally{try{for(const id of campaigns.reverse())await app.get(CampaignsService).remove(id,users[0].id);for(const u of users.reverse())await app.get(PrismaService).user.delete({where:{id:u.id}});}finally{await app.close();}}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
