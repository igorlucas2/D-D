require('reflect-metadata');
require('dotenv').config({quiet:true});
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const request=require('supertest');
const {NestFactory}=require('@nestjs/core');
const {ValidationPipe}=require('@nestjs/common');
const {JwtService}=require('@nestjs/jwt');
const {AppModule}=require('../../dist/src/app.module');
const {PrismaService}=require('../../dist/src/prisma/prisma.service');
const {StoryService}=require('../../dist/src/story/story.service');
const {LoreInstallService}=require('../../dist/src/lore/lore-install.service');
const {LorePackLoader}=require('../../dist/src/lore/lore.loader');
const {CampaignsService}=require('../../dist/src/campaigns/campaigns.service');
const master={scope:'MASTER',recipientIds:[]},publicAudience={scope:'PUBLIC',recipientIds:[]};
async function appInstance(){
  const app=await NestFactory.create(AppModule,{logger:false});
  app.setGlobalPrefix('api');app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
  await app.init();return app;
}
async function main(){
  if(!/^\/rpg_lore_check_\d+$/.test(new URL(process.env.DATABASE_URL).pathname))throw new Error('Requires disposable rehearsal database');
  let app=await appInstance();
  const db=app.get(PrismaService),story=app.get(StoryService),installer=app.get(LoreInstallService),jwt=app.get(JwtService);
  if(process.argv.includes('--resume')){
    try{
      const fixture=JSON.parse(process.env.STORY_RESUME_FIXTURE);
      const s=await story.state(fixture.campaignId,fixture.ownerId);
      assert.equal(s.facts.find(f=>f.key==='TEST_LOCATION').text,fixture.newLocation);
      assert.equal(s.knowledge.find(k=>k.knowerId===fixture.maraId&&k.factId===fixture.locationId).stale,true);
      assert.equal(s.promises.find(p=>p.id===fixture.promiseId).status,'FULFILLED');
      assert.equal(s.threads.find(t=>t.id===fixture.threadId).status,'RESOLVED');
      assert.equal((await story.factHistory(fixture.campaignId,fixture.ownerId,fixture.locationId)).revisions.length,2);
      const p=await story.state(fixture.campaignId,fixture.playerId);
      assert.ok(p.knowledge.some(k=>k.text===fixture.oldLocation));
      assert.ok(!JSON.stringify(p).includes(fixture.newLocation));
      console.log('OK: fresh backend process recovered fact revisions, stale NPC knowledge, private discovery, promise and thread.');
    }finally{await app.close();}return;
  }
  const users=[],campaignIds=[];
  try{
    for(const role of ['owner','player','second-player','outsider'])users.push(await db.user.create({data:{email:`story-${role}-${randomUUID()}@example.test`,displayName:`Teste ${role}`,passwordHash:randomUUID()}}));
    const [owner,player,secondPlayer,outsider]=users;
    const http=request(app.getHttpServer()),auth=u=>`Bearer ${jwt.sign({sub:u.id,email:u.email})}`;
    const loaded=app.get(LorePackLoader).load('eldoria-tres-sinos','1.0.0');
    const fresh=async()=>{const r=await installer.create(owner.id,{packId:'eldoria-tres-sinos',version:'1.0.0',expectedHash:loaded.contentHash,allowDraft:true,name:'MI-03 ensaio',requestKey:randomUUID()});campaignIds.push(r.campaignId);return r.campaignId;};
    const id=await fresh(),other=await fresh();
    // Reproduce an MI-02 installation with no story tables populated; preserve its world.
    await db.$transaction(async tx=>{
      await require('../../dist/src/story/delete-story').deleteCampaignStory(tx,other);
      await tx.campaignLore.update({where:{campaignId:other},data:{storySequence:0}});
    });
    const beforeWorld=await installer.state(other,owner.id);
    assert.equal((await story.state(other,owner.id)).initialized,false);
    const backfill=await Promise.all([story.initialize(other,owner.id),story.initialize(other,owner.id)]);
    assert.equal(backfill.filter(r=>r.alreadyInitialized).length,1);
    assert.deepEqual((await installer.state(other,owner.id)).entities,beforeWorld.entities);
    assert.equal((await story.state(other,owner.id)).facts.length,28);
    await db.campaignMember.createMany({data:[player,secondPlayer].map(u=>({campaignId:id,userId:u.id,role:'PLAYER'}))});
    const character=await db.character.create({data:{userId:player.id,name:'Lia da memória',race:'Humano',class:'Guerreiro'}});
    const pc=await installer.attachCharacter(id,player.id,character.id);
    const state=()=>story.state(id,owner.id);
    const command=async operation=>story.command(id,owner.id,{operation,requestKey:randomUUID(),expectedRevision:(await state()).revision});
    let s=await state();
    assert.equal(s.facts.length,33);assert.equal(s.knowledge.length,16);assert.equal(s.threads.length,4);
    const c05=s.facts.find(f=>f.key==='C05'),c09=s.facts.find(f=>f.key==='C09'),originalLocation=s.facts.find(f=>f.key==='C07'),r01=s.facts.find(f=>f.key==='R01');
    const mara=s.entities.find(e=>e.key==='mara'),dalia=s.entities.find(e=>e.key==='dalia'),nara=s.entities.find(e=>e.key==='nara');
    // MI-04 binds C07 to physical state. Retain MI-03 coverage on an independent assertion.
    await command({kind:'FACT_CREATE',key:'TEST_LOCATION',text:originalLocation.text,factKind:'FACT',classification:'MUTABLE',entityIds:[mara.id],audience:master});
    const c07=(await state()).facts.find(f=>f.key==='TEST_LOCATION');
    await command({kind:'DISCOVER',revisionId:c07.revisionId,knowerIds:[mara.id],stance:'KNOWN',source:'Observação inicial de teste.'});
    assert.equal(s.knowledge.some(k=>k.knowerId===dalia.id&&k.factId===c05.id),false);
    const daliaView=await story.actorKnowledge(id,owner.id,dalia.id);
    assert.equal(daliaView.knowledge.length,3);assert.ok(!JSON.stringify(daliaView).includes(c05.text));
    const path=`/api/campaigns/${id}/story`;
    await http.get(path+'/state').expect(401);
    await http.get(path+'/state').set('Authorization',auth(outsider)).expect(403);
    await http.post(path+'/commands').set('Authorization',auth(player)).send({expectedRevision:s.revision,requestKey:randomUUID(),operation:{kind:'NOTE',text:'forbidden',entityIds:[],audience:publicAudience}}).expect(403);
    const initialPlayer=await story.state(id,player.id);
    assert.ok(!/"revision":|throughSequence|C05|C09|C07|R01|Mara|Oren/.test(JSON.stringify(initialPlayer)));
    const emptySearch=await story.state(id,player.id,{q:'badajo'});assert.equal(emptySearch.facts.length,0);assert.equal(emptySearch.knowledge.length,0);
    assert.deepEqual(await story.events(id,player.id,{q:'badajo'}),{events:[],nextCursor:null});
    await assert.rejects(story.state(id,player.id,{entityId:mara.id}),e=>e.status===403);
    await assert.rejects(story.actorKnowledge(id,player.id,mara.id),e=>e.status===403);
    await http.get(`${path}/facts/${c05.id}/history`).set('Authorization',auth(player)).expect(403);
    await assert.rejects(command({kind:'FACT_UPDATE',factId:c05.id,text:'Sava roubou o badajo.',reason:'Acusação no chat',audience:master}),e=>e.status===409);
    assert.equal((await state()).facts.find(f=>f.id===c05.id).text,c05.text);
    await assert.rejects(command({kind:'DISCOVER',revisionId:r01.revisionId,knowerIds:[pc.entityId],stance:'KNOWN',source:'Rumor'}),e=>e.status===400);
    await command({kind:'DISCOVER',revisionId:r01.revisionId,knowerIds:[pc.entityId],stance:'BELIEVED',source:'Ouviu um boato no cais.'});
    let p=await story.state(id,player.id);assert.equal(p.knowledge[0].stance,'BELIEVED');assert.ok(!/FALSE|evaluation|C09|stale|sourceEventId/.test(JSON.stringify(p)));
    assert.equal((await state()).facts.find(f=>f.id===c09.id).text,c09.text);
    await command({kind:'DISCOVER',revisionId:c07.revisionId,knowerIds:[pc.entityId],stance:'KNOWN',source:'Lia examinou o abrigo na sessão dirigida.'});
    const secondView=await story.state(id,secondPlayer.id);assert.equal(secondView.knowledge.length,0);
    const newLocation='O caixote foi levado para a abadia, conforme o transporte confirmado pelo mestre.';
    await command({kind:'FACT_UPDATE',factId:c07.id,text:newLocation,reason:'Transporte confirmado na sessão humana.',audience:master});
    s=await state();assert.equal(s.knowledge.find(k=>k.knowerId===mara.id&&k.factId===c07.id).stale,true);
    const maraView=await story.actorKnowledge(id,owner.id,mara.id);assert.ok(maraView.knowledge.some(k=>k.text===c07.text));assert.ok(!JSON.stringify(maraView).includes(newLocation));
    assert.equal(s.knowledge.find(k=>k.knowerId===pc.entityId&&k.factId===c07.id).stale,true);
    p=await story.state(id,player.id);assert.ok(p.knowledge.some(k=>k.text===c07.text));assert.ok(!JSON.stringify(p).includes(newLocation));assert.ok(!JSON.stringify(p).includes('stale'));
    await command({kind:'CORRECTION',factId:c05.id,text:c05.text+' (Autoria revisada pelo mestre, sem alterar o culpado.)',reason:'Esclarecer a formulação.',audience:master});
    const history=await story.factHistory(id,owner.id,c05.id);assert.equal(history.revisions.length,2);assert.equal(history.revisions[0].text,c05.text);assert.equal(history.revisions[1].event.correctsEventId,history.revisions[0].sourceEventId);
    // Notes are speech/evidence, never automatic changes to canonical facts or promises.
    await command({kind:'NOTE',text:'Um jogador disse que Sava era culpado e que receberia ouro.',entityIds:[],audience:publicAudience});
    await command({kind:'FACT_CREATE',key:'TEST_BRIDGE',text:'O grupo encontrou uma marca azul na ponte.',factKind:'FACT',classification:'MUTABLE',entityIds:[nara.id],audience:publicAudience});
    assert.ok((await story.state(id,player.id)).facts.some(f=>f.key==='TEST_BRIDGE'));
    assert.equal((await state()).promises.length,0);assert.equal((await state()).facts.find(f=>f.id===c09.id).text,c09.text);
    await command({kind:'PROMISE_CREATE',giverId:nara.id,receiverId:pc.entityId,terms:'Dois dias de hospedagem após trazer Bento.',audience:publicAudience});
    const promise=(await state()).promises[0];
    const resolve={requestKey:randomUUID(),expectedRevision:(await state()).revision,operation:{kind:'PROMISE_RESOLVE',promiseId:promise.id,status:'FULFILLED',reason:'Hospedagem concedida pelo mestre.'}};
    const replay=await Promise.all([story.command(id,owner.id,resolve),story.command(id,owner.id,resolve)]);
    assert.equal(replay.filter(r=>r.alreadyApplied).length,1);
    await assert.rejects(story.command(id,owner.id,{...resolve,operation:{...resolve.operation,reason:'mudou'}}),e=>e.status===409);
    await assert.rejects(command(resolve.operation),e=>e.status===409);
    const thread=(await state()).threads[0];await command({kind:'THREAD_UPDATE',threadId:thread.id,status:'RESOLVED',reason:'Desfecho confirmado em sessão.',audience:master});
    await command({kind:'RELATIONSHIP',fromId:nara.id,toId:pc.entityId,trust:40,fear:0,description:'Nara confia em Lia após o resgate.',audience:publicAudience});
    p=await story.state(id,player.id);assert.ok(p.relationships.some(r=>r.description.includes('Nara confia')));assert.ok(p.relationships.every(r=>r.trust===undefined));
    const rev=(await state()).revision;
    const note={kind:'NOTE',text:'Disputa concorrente',entityIds:[],audience:master};
    const concurrent=await Promise.allSettled([1,2].map(()=>story.command(id,owner.id,{requestKey:randomUUID(),expectedRevision:rev,operation:note})));
    assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);assert.equal(concurrent.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);
    // Mid-command fault must roll back new audience/event/revision and revision counter.
    const before=await state(),count=await db.storyEvent.count({where:{campaignId:id}}),audiences=await db.storyAudience.count({where:{campaignId:id}});
    const failing=new StoryService(db.$extends({query:{storyFactRevision:{async create(){throw new Error('INJECTED_REVISION_FAILURE');}}}}));
    await assert.rejects(failing.command(id,owner.id,{requestKey:randomUUID(),expectedRevision:before.revision,operation:{kind:'CORRECTION',factId:c05.id,text:'Rollback',reason:'Falha injetada',audience:master}}),/INJECTED_REVISION_FAILURE/);
    assert.equal((await state()).revision,before.revision);assert.equal(await db.storyEvent.count({where:{campaignId:id}}),count);assert.equal(await db.storyAudience.count({where:{campaignId:id}}),audiences);
    const otherState=await story.state(other,owner.id);
    await assert.rejects(command({kind:'DISCOVER',revisionId:otherState.facts[0].revisionId,knowerIds:[pc.entityId],stance:'KNOWN',source:'Wrong tenant'}),e=>e.status===404);
    const genesis=await db.storyEvent.findFirstOrThrow({where:{campaignId:id,sequence:1}});
    await assert.rejects(db.entityKnowledge.create({data:{campaignId:id,knowerEntityId:pc.entityId,factRevisionId:otherState.facts[0].revisionId,stance:'KNOWN',source:'wrong',sourceEventId:genesis.id}}),e=>e.code==='P2003');
    await http.post(path+'/commands').set('Authorization',auth(owner)).send({requestKey:randomUUID(),expectedRevision:(await state()).revision,operation:{...note,sql:'SELECT 1'}}).expect(400);
    await assert.rejects(command({...note,audience:{scope:'RECIPIENTS',recipientIds:[outsider.id]}}),e=>e.status===400);
    await assert.rejects(command({kind:'RELATIONSHIP',fromId:nara.id,toId:pc.entityId,trust:101,fear:0,description:'invalid',audience:master}),e=>e.status===400);
    // Private activity must not change player counters/revision/projections.
    const beforePrivate=await story.state(id,secondPlayer.id),eventsBefore=await story.events(id,secondPlayer.id);
    await command({kind:'NOTE',text:'SEGREDO-DO-MESTRE',entityIds:[mara.id],audience:master});
    assert.deepEqual(await story.state(id,secondPlayer.id),beforePrivate);assert.deepEqual(await story.events(id,secondPlayer.id),eventsBefore);
    assert.deepEqual(await story.events(id,player.id,{q:'SEGREDO-DO-MESTRE'}),{events:[],nextCursor:null});
    await assert.rejects(story.events(id,player.id,{before:genesis.id}),e=>e.status===404);
    // Pagination filters before applying the limit, regardless of private event gaps.
    for(let i=0;i<53;i++)await command({kind:'NOTE',text:`Registro público ${i}`,entityIds:[],audience:publicAudience});
    const page1=await story.events(id,secondPlayer.id),page2=await story.events(id,secondPlayer.id,{before:page1.nextCursor});
    assert.equal(page1.events.length,50);assert.ok(page2.events.length>0);assert.equal(new Set([...page1.events,...page2.events].map(e=>e.id)).size,page1.events.length+page2.events.length);assert.ok(page1.events.every(e=>e.sequence===undefined));
    assert.equal((await story.initialize(id,owner.id)).alreadyInitialized,true);
    const fixture={campaignId:id,ownerId:owner.id,playerId:player.id,maraId:mara.id,locationId:c07.id,oldLocation:c07.text,newLocation,promiseId:promise.id,threadId:thread.id};
    await app.close();
    const resumed=spawnSync(process.execPath,[__filename,'--resume'],{env:{...process.env,STORY_RESUME_FIXTURE:JSON.stringify(fixture)},stdio:'inherit'});
    assert.equal(resumed.status,0);
    app=await appInstance();
    if(process.argv.includes('--browser'))await require('./browser.cjs').check(app,{id,owner,player,secondPlayer,pcId:pc.entityId,c05});
    const dbAgain=app.get(PrismaService);await dbAgain.campaignMember.deleteMany({where:{campaignId:id,userId:player.id}});
    await assert.rejects(app.get(StoryService).state(id,player.id),e=>e.status===403);
    console.log('OK: genesis, truth vs rumor, revision-bound discoveries, no omniscience, corrections, promises, relationships, threads, concurrent/replayed writes, rollback, tenant FKs, filtered search/pagination, revoked membership and full-process restart.');
  }finally{
    try{
      const activeDb=app.get(PrismaService);const campaigns=app.get(CampaignsService);
      for(const id of campaignIds.reverse())await campaigns.remove(id,users[0].id);
      for(const u of users.reverse())await activeDb.user.delete({where:{id:u.id}});
    }finally{await app.close();}
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
