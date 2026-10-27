const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { JwtService } = require('@nestjs/jwt');
const { PlayerIntentsService } = require('../../dist/src/game-master/player-intents.service');

exports.check = async ({ app, db, id, owner, player, outsider, gm, story, ctx, pc, mara, behavior }) => {
  const service = app.get(PlayerIntentsService), http = request(app.getHttpServer()), jwt = app.get(JwtService);
  const auth = user => `Bearer ${jwt.sign({sub:user.id,email:user.email})}`, path = `/api/campaigns/${id}/intents`;
  const revision = async () => (await db.campaignLore.findUniqueOrThrow({where:{campaignId:id}})).revision;
  const scene = async () => (await db.sceneState.findUniqueOrThrow({where:{campaignId:id}})).revision;
  const settings = async (mode='COPILOT', paused=false) => gm.settings(id,owner.id,{mode,paused,expectedRevision:await revision()});
  const body = async (patch={}) => ({requestKey:randomUUID(),playerEntityId:pc.entityId,focusEntityId:mara.entityId,prompt:'O que você sabe do badajo?',expectedSceneRevision:await scene(),...patch});
  const submit = async patch => service.submit(id,player.id,await body(patch));
  const get = t => gm.detail(id,owner.id,t.id);
  const cancel = t => service.cancel(id,player.id,t.id);
  const reply = async (t,patch={}) => service.respond(id,owner.id,t.id,{kind:'ANSWER',source:'MANUAL',text:'Resposta revisada.',expectedRevision:await revision(),...patch});
  const conflict = e => e.status === 409;
  const answer = s => ({kind:'ANSWER',text:'RASCUNHO PRIVADO: Oren contratou Mara.',evidenceIds:[s.sources[0].id],routeId:null,restType:null,revisionId:null,knowerIds:[],sourceNpcId:null});
  behavior(answer);
  await http.get(path).expect(401);
  await http.get(path).set('Authorization',auth(outsider)).expect(403);
  await http.post(path).set('Authorization',auth(player)).send({...await body(),kind:'PLAN'}).expect(400);
  await assert.rejects(submit({playerEntityId:mara.entityId}),conflict);
  const input = await body(), repeated = await Promise.all([service.submit(id,player.id,input),service.submit(id,player.id,input)]), first = repeated[0];
  assert.equal(first.id,repeated[1].id);
  await assert.rejects(service.submit(id,player.id,{...input,prompt:'Outro pedido'}),conflict);
  await assert.rejects(submit(),conflict);
  await gm.runNext(); assert.equal((await get(first)).status,'READY');
  assert.ok(!(await gm.state(id,owner.id)).turns.some(t=>t.id===first.id));
  await assert.rejects(gm.resolve(id,owner.id,first.id,{decision:'ACCEPT'}),conflict);
  await http.get(`/api/campaigns/${id}/game-master/turns/${first.id}`).set('Authorization',auth(player)).expect(403);
  const projected = (await http.get(path).set('Authorization',auth(player)).expect(200)).body;
  assert.equal(projected.revision,undefined);
  assert.ok(!JSON.stringify(projected).includes('RASCUNHO PRIVADO'));
  for (const key of ['sources','proposal','context','expectedRevision','errorCode','model']) assert.equal(projected.turns[0][key],undefined);
  assert.equal(projected.turns[0].status,'WAITING_MASTER');
  await http.post(`${path}/${first.id}/respond`).set('Authorization',auth(player)).send({kind:'ANSWER',source:'MANUAL',text:'Eu mesmo aprovo.',expectedRevision:await revision()}).expect(403);
  await db.campaignMember.create({data:{campaignId:id,userId:outsider.id,role:'PLAYER'}});
  assert.equal((await service.state(id,outsider.id)).turns.length,0);
  await assert.rejects(service.cancel(id,outsider.id,first.id),e=>e.status===404);
  const question = {kind:'ASK',source:'DRAFT',text:'Você pergunta sobre a retirada ou sobre o transporte?',expectedRevision:await revision()};
  const accepted = await Promise.all([service.respond(id,owner.id,first.id,question),service.respond(id,owner.id,first.id,question)]);
  assert.equal(accepted.filter(r=>r.alreadyApplied).length,1);
  assert.equal((await get(first)).status,'WAITING_PLAYER');
  assert.equal((await service.state(id,player.id)).turns[0].reply,question.text);
  assert.ok(!(await story.events(id,outsider.id)).events.some(e=>e.id===accepted[0].eventId));
  const event = await db.storyEvent.findUniqueOrThrow({where:{id:accepted[0].eventId},include:{audience:{include:{members:true}}}});
  assert.equal(event.audience.scope,'RECIPIENTS'); assert.deepEqual(event.audience.members.map(m=>m.userId),[player.id]);
  await assert.rejects(reply(first,{text:'Texto diferente.'}),conflict);
  await assert.rejects(submit({parentTurnId:first.id,focusEntityId:undefined}),conflict);
  const followInput = await body({parentTurnId:first.id,prompt:'Quero saber do transporte.'});
  const follows = await Promise.all([service.submit(id,player.id,followInput),service.submit(id,player.id,followInput)]), follow=follows[0];
  assert.equal(follow.id,follows[1].id); assert.equal((await get(first)).status,'COMMITTED');
  const followContext = (await get(follow)).context;
  assert.deepEqual(followContext.conversation,[{player:input.prompt,reply:question.text}]);
  assert.ok(!JSON.stringify(followContext).includes('RASCUNHO PRIVADO'));
  assert.ok(followContext.sources.every(s=>s.id.startsWith('K:')));
  await gm.runNext(); await reply(follow,{source:'DRAFT',text:'Mara oferece a resposta revisada sobre o transporte.'});
  assert.equal((await get(follow)).status,'COMMITTED');
  await db.campaignMember.delete({where:{campaignId_userId:{campaignId:id,userId:outsider.id}}});

  // A response from an old world revision cannot be approved as model output.
  const stale = await submit(); await gm.runNext();
  await story.command(id,owner.id,{requestKey:randomUUID(),expectedRevision:await revision(),operation:{kind:'NOTE',text:'Atualização reservada.',entityIds:[],audience:{scope:'MASTER',recipientIds:[]}}});
  await assert.rejects(reply(stale,{source:'DRAFT'}),conflict);
  await reply(stale,{text:'O mestre conferiu a situação atual.'});

  // Cancellation and pause while inference is pending both discard late output.
  async function inFlight(action) {
    let entered,release; const started=new Promise(r=>entered=r);
    behavior(async s=>{entered();await new Promise(r=>release=r);return answer(s);});
    const t=await submit(), running=gm.runNext();await started;await action(t);release();await running;return t;
  }
  const cancelled=await inFlight(cancel);assert.equal((await get(cancelled)).status,'CANCELLED');
  const paused=await inFlight(()=>settings('COPILOT',true));assert.equal((await get(paused)).status,'CANCELLED');
  await settings();
  const manualRace=await inFlight(t=>reply(t,{text:'Resposta humana durante a geração.'}));
  assert.equal((await get(manualRace)).reviewedText,'Resposta humana durante a geração.');assert.equal((await get(manualRace)).proposal,null);
  const removed=await inFlight(()=>db.campaignMember.delete({where:{campaignId_userId:{campaignId:id,userId:player.id}}}));
  assert.equal((await get(removed)).status,'STALE');
  await http.get(path).set('Authorization',auth(player)).expect(403);
  await assert.rejects(reply(removed),conflict);
  await db.campaignMember.create({data:{campaignId:id,userId:player.id,role:'PLAYER'}});await cancel(removed);
  const transferred=await inFlight(()=>db.character.update({where:{id:pc.characterId},data:{userId:outsider.id}}));
  assert.equal((await get(transferred)).status,'STALE');await assert.rejects(reply(transferred),conflict);
  await db.character.update({where:{id:pc.characterId},data:{userId:player.id}});await cancel(transferred);
  behavior(answer);
  const moved=await submit();await db.sceneState.update({where:{campaignId:id},data:{revision:{increment:1}}});
  await gm.runNext();assert.equal((await get(moved)).status,'STALE');await assert.rejects(reply(moved),conflict);await cancel(moved);

  // Local model outage/disabled mode still allows a human response with no side effects.
  await settings('OFF');const offline=await submit();assert.equal((await get(offline)).errorCode,'MANUAL_REVIEW');await reply(offline);
  await settings();behavior(()=>{throw Error('offline');});const unavailable=await submit();await gm.runNext();assert.equal((await get(unavailable)).status,'FAILED');await reply(unavailable);
  behavior(answer);
  const atomic=await submit(), before=await db.campaignLore.findUniqueOrThrow({where:{campaignId:id}}), eventCount=await db.storyEvent.count({where:{campaignId:id}}), outboxCount=await db.outboxEvent.count({where:{campaignId:id}});
  const failingDb=db.$extends({query:{gameMasterTurn:{async update({args,query}){if(args.data.status==='WAITING_PLAYER')throw Error('INTENT_COMMIT_FAILURE');return query(args);}}}});
  const failing=new PlayerIntentsService(failingDb,ctx,story);
  await assert.rejects(failing.respond(id,owner.id,atomic.id,{kind:'ASK',source:'MANUAL',text:'Uma pergunta?',expectedRevision:before.revision}),/INTENT_COMMIT_FAILURE/);
  assert.equal((await db.campaignLore.findUniqueOrThrow({where:{campaignId:id}})).revision,before.revision);
  assert.equal(await db.storyEvent.count({where:{campaignId:id}}),eventCount);assert.equal(await db.outboxEvent.count({where:{campaignId:id}}),outboxCount);
  assert.equal((await get(atomic)).status,'REQUESTED');
  await reply(atomic,{kind:'ASK',text:'Pergunta persistida para retomar depois do reinício.'});
  // Active requests must not disappear behind the last thirty closed records.
  const template=await db.gameMasterTurn.findUniqueOrThrow({where:{id:atomic.id}});
  for(let i=0;i<31;i++)await db.gameMasterTurn.create({data:{...template,id:undefined,requestKey:randomUUID(),requestHash:'a'.repeat(64),status:'CANCELLED',parentTurnId:null,resultEventId:null,replyKind:null,reviewedText:null,createdAt:new Date(Date.now()+i)}});
  assert.ok((await service.state(id,player.id)).turns.some(t=>t.id===atomic.id&&t.status==='WAITING_PLAYER'));
  await assert.rejects(submit({parentTurnId:atomic.id}),conflict);
  console.log('OK: player intents, private projections, dialogue replies, idempotence, stale drafts, cancellation, pause, revoked participation, character transfer, outage fallback, atomic publication and active-history visibility.');
  return {playerId:player.id,turnId:atomic.id,reply:'Pergunta persistida para retomar depois do reinício.'};
};
