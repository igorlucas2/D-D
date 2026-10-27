require('reflect-metadata');
require('dotenv').config({quiet:true});
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const request=require('supertest');
const {NestFactory}=require('@nestjs/core');
const {ValidationPipe}=require('@nestjs/common');
const {JwtService}=require('@nestjs/jwt');
const {AppModule}=require('../../dist/src/app.module');
const {PrismaService}=require('../../dist/src/prisma/prisma.service');
const {LoreInstallService}=require('../../dist/src/lore/lore-install.service');
const {LorePackLoader}=require('../../dist/src/lore/lore.loader');
const {LoreService}=require('../../dist/src/lore/lore.service');
const {CampaignsService}=require('../../dist/src/campaigns/campaigns.service');
const {canReach}=require('../../dist/src/vtt/movement');
const {computeVisibleCells}=require('../../dist/src/vtt/vision');

async function main(){
  if(!/^\/rpg_lore_check_\d+$/.test(new URL(process.env.DATABASE_URL).pathname)) throw new Error('Requires disposable rpg_lore_check_<timestamp> database');
  const app=await NestFactory.create(AppModule,{logger:false});
  app.setGlobalPrefix('api');app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
  await app.init();
  const db=app.get(PrismaService),installer=app.get(LoreInstallService),loader=app.get(LorePackLoader),campaigns=app.get(CampaignsService);
  const http=request(app.getHttpServer()),jwt=app.get(JwtService);
  const users=[],campaignIds=[];
  let duplicateId;
  try{
    for(const role of ['owner','player','outsider'])users.push(await db.user.create({data:{email:`lore-${role}-${randomUUID()}@example.test`,displayName:`Teste ${role}`,passwordHash:randomUUID()}}));
    const [owner,player,outsider]=users;
    const auth=u=>`Bearer ${jwt.sign({sub:u.id,email:u.email})}`;
    const loaded=loader.load('eldoria-tres-sinos','1.0.0');
    const input={packId:'eldoria-tres-sinos',version:'1.0.0',expectedHash:loaded.contentHash,allowDraft:true};
    const fresh=async()=>{const c=await db.campaign.create({data:{name:'MI-02 ensaio',masterId:owner.id,members:{create:{userId:owner.id,role:'MASTER'}}}});campaignIds.push(c.id);return c;};
    const first=await fresh();const path=`/api/campaigns/${first.id}/lore/install`;
    await http.post(path).send(input).expect(401);
    await http.post(path).set('Authorization',auth(outsider)).send(input).expect(403);
    await http.post(path).set('Authorization',auth(owner)).send({...input,allowDraft:false}).expect(409);
    await http.post(path).set('Authorization',auth(owner)).send({...input,expectedHash:'0'.repeat(64)}).expect(409);
    assert.equal(await db.campaignEntity.count(),0);
    const commoner=await db.monster.findFirstOrThrow({where:{source:'dnd5eapi-2014',srdIndex:'commoner'}});
    duplicateId=randomUUID();await db.monster.create({data:{...commoner,id:duplicateId}});
    await http.post(path).set('Authorization',auth(owner)).send(input).expect(409);
    await db.monster.delete({where:{id:duplicateId}});duplicateId=null;
    assert.equal(await db.campaignLore.count(),0);
    // Fault after several writes must also remove maps, calendar and package registration.
    const before=await db.lorePackVersion.count();
    const failing=db.$extends({query:{campaignNpc:{async create(){throw new Error('INJECTED_INSTALL_FAILURE');}}}});
    const faultInstaller=new LoreInstallService(failing,loader,new LoreService(failing,loader));
    await assert.rejects(faultInstaller.install(first.id,owner.id,input),/INJECTED_INSTALL_FAILURE/);
    assert.equal(await db.campaignEntity.count(),0);assert.equal(await db.vttMap.count({where:{campaignId:first.id}}),0);assert.equal(await db.lorePackVersion.count(),before);
    const concurrent=await Promise.all([installer.install(first.id,owner.id,input),installer.install(first.id,owner.id,input)]);
    assert.equal(concurrent.filter(r=>!r.alreadyInstalled).length,1);
    assert.equal(await db.campaignEntity.count({where:{campaignId:first.id}}),35);
    assert.equal(await db.campaignNpc.count({where:{campaignId:first.id}}),8);
    assert.equal(await db.travelRoute.count({where:{campaignId:first.id}}),22);
    const replay=await http.post(path).set('Authorization',auth(owner)).send(input).expect(200);assert.equal(replay.body.alreadyInstalled,true);
    const createBody={...input,name:'Novo cenário atômico',requestKey:randomUUID()};
    const created=await Promise.all([installer.create(owner.id,createBody),installer.create(owner.id,createBody)]);
    assert.equal(created[0].campaignId,created[1].campaignId);campaignIds.push(created[0].campaignId);
    await assert.rejects(installer.create(owner.id,{...createBody,name:'Outra campanha'}),e=>e.status===409);
    const second=created[0];
    const firstNpc=await db.campaignNpc.findFirstOrThrow({where:{campaignId:first.id}});
    const foreignPlace=await db.campaignPlace.findFirstOrThrow({where:{campaignId:second.campaignId}});
    await assert.rejects(db.campaignNpc.update({where:{entityId:firstNpc.entityId},data:{placeEntityId:foreignPlace.entityId}}),e=>e.code==='P2003');
    const snapshot=firstNpc.catalogSnapshot;await db.campaignNpc.update({where:{entityId:firstNpc.entityId},data:{currentHp:0}});
    const catalog=JSON.parse(snapshot);assert.equal((await db.monster.findUniqueOrThrow({where:{id:catalog.id}})).maxHp,catalog.maxHp);
    assert.ok((await db.campaignNpc.findMany({where:{campaignId:second.campaignId}})).every(n=>n.currentHp===n.maxHp));
    const state=await installer.state(first.id,owner.id);
    assert.equal(state.scene.place.name,'Cais do Lume');assert.equal(state.entities.length,35);
    const clock=await db.campaignCalendar.findUniqueOrThrow({where:{campaignId:first.id}});assert.equal(clock.currentYear,87);assert.equal(clock.currentHour,8);assert.equal(clock.realMinutesPerTick,0);
    const original=loader.load;loader.load=()=>{throw new Error('Source unavailable after installation');};
    await db.$disconnect();await db.$connect();
    assert.deepEqual((await installer.state(first.id,owner.id)).entities,state.entities);
    assert.equal((await installer.install(first.id,owner.id,input)).alreadyInstalled,true);
    loader.load=original;
    await db.campaignMember.create({data:{campaignId:first.id,userId:player.id,role:'PLAYER'}});
    const playerState=(await http.get(`/api/campaigns/${first.id}/lore/state`).set('Authorization',auth(player)).expect(200)).body;
    assert.ok(!/catalogSnapshot|C05|Mara|Bento|entities|review|routes|installedHash/.test(JSON.stringify(playerState)));
    await http.get(`/api/campaigns/${first.id}/lore/state`).set('Authorization',auth(outsider)).expect(403);
    await http.post(path).set('Authorization',auth(player)).send(input).expect(403);
    const maps=await db.campaignLoreMap.findMany({where:{campaignId:first.id},include:{map:true}});
    for(const m of maps){
      const url=`/api/campaigns/${first.id}/lore/maps/${m.mapId}/image`;
      await http.get(url).expect(401);await http.get(url).set('Authorization',auth(outsider)).expect(403);
      const image=await http.get(url).set('Authorization',auth(owner)).expect(200);
      assert.match(image.headers['content-type'],/image\/png/);assert.match(image.headers['cache-control'],/no-store/);
      await http.get(url).set('Authorization',auth(player)).expect(m.key==='abadia'?404:200);
    }
    const playerMaps=(await http.get(`/api/campaigns/${first.id}/vtt/maps`).set('Authorization',auth(player)).expect(200)).body;
    assert.equal(playerMaps.length,2);
    assert.equal((await db.campaignCalendar.findUniqueOrThrow({where:{campaignId:first.id}})).totalMinutes,clock.totalMinutes);
    assert.deepEqual((await installer.state(first.id,owner.id)).scene,state.scene);
    const character=await db.character.create({data:{userId:player.id,name:'Personagem do ensaio',race:'Humano',class:'Guerreiro'}});
    const attached=await installer.attachCharacter(first.id,player.id,character.id);
    assert.equal((await installer.attachCharacter(first.id,player.id,character.id)).entityId,attached.entityId);
    await db.campaignMember.create({data:{campaignId:second.campaignId,userId:player.id}});
    await assert.rejects(installer.attachCharacter(second.campaignId,player.id,character.id),e=>e.status===409);
    await assert.rejects(installer.attachCharacter(first.id,owner.id,character.id),e=>e.status===403);
    const geometry=loaded.pack.atlas.geometry[0];
    assert.equal(canReach({...geometry.entry,size:1},2,3,24,18,geometry.walls),false);
    const opened=geometry.walls.map(w=>w.door?{...w,door:'open'}:w);
    for(const room of loaded.pack.atlas.rooms)assert.equal(canReach({...geometry.entry,size:1},room.x,room.y,24,18,opened),true);
    const viewer={x:5,y:8,size:1,lightRadius:0,visionRadius:0};
    assert.equal(computeVisibleCells(24,18,'LIT',geometry.walls,[viewer],[]).has('5:9'),false);
    assert.equal(computeVisibleCells(24,18,'LIT',opened,[viewer],[]).has('5:9'),true);
    const occupied=await fresh();await db.campaignCalendar.create({data:{campaignId:occupied.id,monthNames:'[]',daysPerMonth:'[]',weekdayNames:'[]'}});
    await assert.rejects(installer.install(occupied.id,owner.id,input),e=>e.status===409);
    await db.campaignMember.deleteMany({where:{campaignId:first.id,userId:player.id}});
    await http.get(`/api/campaigns/${first.id}/lore/maps/${maps[0].mapId}/image`).set('Authorization',auth(player)).expect(403);
    console.log('OK: rollback, concurrent/repeated installs and creation, snapshots/reconnect, tenant FKs, catalog ambiguity, permissions/assets, character binding, unchanged clock/scene on map reads, geometry and doors.');
    if(process.argv.includes('--browser')) await require('./browser-install.cjs').checkBrowser(app,db,jwt,owner,player,campaignIds);
    if(process.argv.includes('--keep-browser-fixture')) {
      require('fs').writeFileSync('backups/lore-migration/browser-fixture.json',JSON.stringify({campaignId:first.id,ownerId:owner.id,playerId:player.id}));
      campaignIds.length=0;users.length=0;
    }
  }finally{
    try {
      if(duplicateId)await db.monster.delete({where:{id:duplicateId}});
      for(const id of campaignIds.reverse())await campaigns.remove(id,users[0].id);
      for(const user of users.reverse())await db.user.delete({where:{id:user.id}});
    } finally { await app.close(); }
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
