const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {PlayerIntentsService}=require('../../dist/src/game-master/player-intents.service');
exports.check=async({app,db,id,owner,player,pc,mara,gm,provider})=>{
 const service=app.get(PlayerIntentsService),original=gm.provider,results=[];gm.provider=provider;
 const revision=async()=>(await db.campaignLore.findUniqueOrThrow({where:{campaignId:id}})).revision;
 const submit=async(prompt,parentTurnId)=>service.submit(id,player.id,{requestKey:randomUUID(),playerEntityId:pc.entityId,focusEntityId:mara.entityId,prompt,parentTurnId,expectedSceneRevision:(await db.sceneState.findUniqueOrThrow({where:{campaignId:id}})).revision});
 async function evaluate(turn){const start=Date.now();await gm.runNext();const t=await gm.detail(id,owner.id,turn.id);const contextOnlyNpc=t.context.sources.every(s=>s.id.startsWith('K:'));const passed=t.status==='READY'&&t.proposal.kind==='ANSWER'&&/Oren/i.test(t.proposal.text)&&contextOnlyNpc;results.push({id:t.id,status:t.status,passed,proposal:t.proposal,conversation:t.context.conversation,errorCode:t.errorCode,inputTokens:t.inputTokens,outputTokens:t.outputTokens,latencyMs:Date.now()-start});return t;}
 try {
  const first=await submit('Quem contratou você para retirar o badajo?');await evaluate(first);
  // Controlled human question exercises approved history, never publishing a model draft.
  await service.respond(id,owner.id,first.id,{text:'Você quer saber o nome de quem contratou Mara?',kind:'ASK',source:'MANUAL',expectedRevision:await revision()});
  const follow=await submit('Sim, quero saber o nome de quem a contratou.',first.id);const t=await evaluate(follow);
  assert.deepEqual(t.context.conversation,[{player:'Quem contratou você para retirar o badajo?',reply:'Você quer saber o nome de quem contratou Mara?'}]);
  const view=await service.state(id,player.id);assert.ok(!JSON.stringify(view).includes('Oren'));
  await service.cancel(id,player.id,follow.id);
  const output=path.resolve('backups/player-intents-model');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'dialogue.json'),JSON.stringify({at:new Date().toISOString(),passed:results.filter(r=>r.passed).length,total:results.length,results},null,2));
  console.log(`MODEL DIALOGUE ${results.filter(r=>r.passed).length}/${results.length}: actual queued NPC generation, approved-history follow-up and no draft exposed to player.`);
 }finally{gm.provider=original;}
};
