// Additive migration rehearsal/backup. Credentials never appear in output.
require('dotenv').config({ quiet:true });
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient, Prisma } = require('@prisma/client');
const { fingerprint, modelOrder, rowOrder } = require('../mysql/transfer.cjs');
async function snapshot(db,models) {
  const result = {};
  for (const m of models) result[m.name] = await db[m.name[0].toLowerCase()+m.name.slice(1)].findMany({select:Object.fromEntries(m.fields.filter(f=>f.kind!=='object').map(f=>[f.name,true]))});
  return result;
}
async function verify(db,models,data) {
  const actual = await snapshot(db,models); const report = {};
  for (const m of models) {
    if (fingerprint(actual[m.name]) !== fingerprint(data[m.name])) throw new Error('Original table changed: '+m.name);
    report[m.name] = { rows:actual[m.name].length, sha256:fingerprint(actual[m.name]) };
  }
  return report;
}
const pointer = path.resolve('backups/lore-migration/current.json');
async function main() {
  const db = new PrismaClient();
  try {
    const mode = process.argv[2];
    if (mode === 'backup') {
      const tables = await db.$queryRaw`SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema = DATABASE()`;
      const models = Prisma.dmmf.datamodel.models.filter(m => tables.some(t => t.name.toLowerCase() === m.name.toLowerCase()));
      if (models.length < 35) throw new Error('Incomplete original table inventory');
      const data = await db.$transaction(tx => snapshot(tx,models),{ isolationLevel:'RepeatableRead', timeout:120000 });
      const directory = path.resolve('backups/lore-migration',new Date().toISOString().replaceAll(':','-'));
      fs.mkdirSync(directory,{ recursive:true });
      const portable = {};
      for (const model of models) portable[model.name]=data[model.name].map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key, model.fields.some(f=>f.name===key && f.type==='Bytes') && value!==null ? {base64:Buffer.from(value).toString('base64')} : value])));
      fs.writeFileSync(path.join(directory,'snapshot.json'),JSON.stringify({ models,data:portable }));
      fs.copyFileSync('prisma/schema.prisma',path.join(directory,'schema.before.prisma'));
      fs.writeFileSync(pointer,JSON.stringify({ directory,rehearsalName:`rpg_lore_check_${Date.now()}` }));
      console.log(`Backup: ${models.length} tables, ${Object.values(data).reduce((s,rows)=>s+rows.length,0)} rows; local ignored backups/lore-migration.`);
      return;
    }
    const meta = JSON.parse(fs.readFileSync(pointer,'utf8'));
    const backup = JSON.parse(fs.readFileSync(path.join(meta.directory,'snapshot.json'),'utf8'));
    for (const model of backup.models) for (const row of backup.data[model.name]) for (const field of model.fields) {
      if (field.type === 'DateTime' && row[field.name]) row[field.name] = new Date(row[field.name]);
      if (field.type === 'Bytes' && row[field.name]) row[field.name] = new Uint8Array(Buffer.from(row[field.name].base64,'base64'));
    }
    if (mode === 'verify') {
      const report = await verify(db,backup.models,backup.data);
      fs.writeFileSync(path.join(meta.directory,'verification.json'),JSON.stringify(report,null,2));
      console.log(`Preserved: ${Object.keys(report).length} original tables, identical row hashes.`);
      return;
    }
    if (!/^rpg_lore_check_\d+$/.test(meta.rehearsalName)) throw new Error('Invalid rehearsal database name');
    if (mode === 'cleanup') {
      await db.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${meta.rehearsalName}\``);
      console.log('Disposable rehearsal database removed. Backup preserved.'); return;
    }
    if (mode === 'recheck') {
      const url=new URL(process.env.DATABASE_URL);url.pathname='/'+meta.rehearsalName;
      const test=spawnSync(process.execPath,['scripts/lore/install-smoke.cjs',...process.argv.slice(3)],{env:{...process.env,DATABASE_URL:url.href},stdio:'inherit'});
      if(test.status!==0)throw new Error('Rehearsal checks failed');
      return;
    }
    if (mode !== 'rehearse') throw new Error('Expected backup, rehearse, verify or cleanup');
    await db.$executeRawUnsafe(`CREATE DATABASE \`${meta.rehearsalName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    const url = new URL(process.env.DATABASE_URL); url.pathname = '/' + meta.rehearsalName;
    const migrated = spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{ env:{...process.env,DATABASE_URL:url.href}, encoding:'utf8' });
    if (migrated.status !== 0) throw new Error('Rehearsal schema migration failed');
    const target = new PrismaClient({ datasourceUrl:url.href });
    try {
      await target.$transaction(async tx => {
        for (const model of modelOrder(backup.models)) for (const row of rowOrder(model,backup.data[model.name])) await tx[model.name[0].toLowerCase()+model.name.slice(1)].create({data:row});
      },{timeout:240000});
      await verify(target,backup.models,backup.data);
      const test = spawnSync(process.execPath,['scripts/lore/install-smoke.cjs'],{ env:{...process.env,DATABASE_URL:url.href}, stdio:'inherit' });
      if (test.status !== 0) throw new Error('Rehearsal functional checks failed');
      fs.writeFileSync(path.join(meta.directory,'rehearsal.json'),JSON.stringify({ passed:true, at:new Date().toISOString(), tables:backup.models.length }));
      console.log('Rehearsal migration, full backup restore and install checks passed.');
    } finally { await target.$disconnect(); }
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(`Lore migration check failed: ${error.code || error.name}`); process.exitCode=1; });
