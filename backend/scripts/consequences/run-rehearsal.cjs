require('dotenv').config({quiet:true});
const fs=require('node:fs'),{spawnSync}=require('node:child_process');
const meta=JSON.parse(fs.readFileSync('backups/lore-migration/current.json','utf8'));
if(!/^rpg_lore_check_\d+$/.test(meta.rehearsalName))throw new Error('Invalid disposable database');
const url=new URL(process.env.DATABASE_URL);url.pathname='/'+meta.rehearsalName;
const result=spawnSync(process.execPath,['scripts/consequences/smoke.cjs',...process.argv.slice(2)],{env:{...process.env,DATABASE_URL:url.href},stdio:'inherit'});
process.exitCode=result.status??1;
