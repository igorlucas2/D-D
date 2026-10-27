// Offline, one-time transfer. An empty destination is required; no upsert/delete.
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function delegateName(name) {
  return name[0].toLowerCase() + name.slice(1);
}

function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  }
  return value;
}

function fingerprint(rows) {
  const content = rows.map(row => JSON.stringify(canonical(row))).sort();
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

function modelOrder(models) {
  const pending = new Map(models.map(m => [m.name, m]));
  const done = new Set();
  const ordered = [];
  while (pending.size) {
    const ready = [...pending.values()].filter(m => m.fields.every(f =>
      f.kind !== 'object' || !f.relationFromFields?.length || f.type === m.name || done.has(f.type)));
    if (!ready.length) throw new Error('Cyclic model dependencies: explicit migration required');
    for (const model of ready) {
      ordered.push(model); done.add(model.name); pending.delete(model.name);
    }
  }
  return ordered;
}

function rowOrder(model, rows) {
  const selfRelations = model.fields.filter(f => f.kind === 'object' &&
    f.type === model.name && f.relationFromFields?.length);
  if (!selfRelations.length) return rows;
  // Self-references are inserted parent first with foreign keys kept enabled.
  const pending = [...rows];
  const ordered = [];
  const known = selfRelations.map(() => new Set());
  while (pending.length) {
    const ready = pending.filter(row => selfRelations.every((r, i) =>
      r.relationFromFields.some(k => row[k] == null) ||
      known[i].has(JSON.stringify(r.relationFromFields.map(k => row[k])))));
    if (!ready.length) throw new Error(`Invalid/cyclic hierarchy in ${model.name}`);
    const readySet = new Set(ready);
    for (const row of ready) {
      ordered.push(row);
      selfRelations.forEach((r, i) => known[i].add(JSON.stringify(r.relationToFields.map(k => row[k]))));
    }
    for (let i = pending.length - 1; i >= 0; i--) if (readySet.has(pending[i])) pending.splice(i, 1);
  }
  return ordered;
}

async function snapshot(client, models) {
  const data = {};
  for (const m of models) data[m.name] = await client[delegateName(m.name)].findMany();
  return data;
}

async function verify(client, models, data) {
  const report = {};
  for (const m of models) {
    const actual = await client[delegateName(m.name)].findMany();
    const hash = fingerprint(data[m.name]);
    if (actual.length !== data[m.name].length || fingerprint(actual) !== hash) {
      throw new Error(`Content verification failed: ${m.name}`);
    }
    report[m.name] = { rows: actual.length, sha256: hash };
  }
  return report;
}

async function transfer(source, target, models, { verifyOnly = false, rollback = false } = {}) {
  const ordered = modelOrder(models);
  const data = await source.$transaction(tx => snapshot(tx, ordered), { timeout: 120000 });
  // Validate hierarchies before starting any writes.
  for (const m of ordered) data[m.name] = rowOrder(m, data[m.name]);
  const sentinel = new Error('REHEARSAL_ROLLBACK');
  let report;
  try {
    await target.$transaction(async tx => {
      if (verifyOnly) { report = await verify(tx, ordered, data); return; }
      for (const m of ordered) {
        if (await tx[delegateName(m.name)].count()) throw new Error(`Destination is not empty: ${m.name}`);
      }
      for (const m of ordered) {
        // Each model is small enough for this one-time, offline transfer.
        // Individual creates preserve parent-before-child order and defaults.
        for (const row of data[m.name]) await tx[delegateName(m.name)].create({ data: row });
      }
      report = await verify(tx, ordered, data);
      if (rollback) throw sentinel;
    }, { maxWait: 15000, timeout: 240000, isolationLevel: 'Serializable' });
  } catch (error) {
    if (error !== sentinel) throw error;
    for (const m of ordered) {
      if (await target[delegateName(m.name)].count()) throw new Error('Rehearsal rollback failed');
    }
  }
  return { mode: verifyOnly ? 'verify' : rollback ? 'rehearsal-rolled-back' : 'imported', tables: report };
}

async function main() {
  require('dotenv').config({ quiet: true });
  const args = process.argv.slice(2);
  const sourceArg = args.indexOf('--source');
  const outputArg = args.indexOf('--report');
  const modes = args.filter(arg => ['--import', '--rehearse', '--verify'].includes(arg));
  if (sourceArg < 0 || outputArg < 0 || modes.length !== 1) {
    throw new Error('Use --source <sqlite-backup> --report <report.json> and exactly one of --import, --rehearse, --verify');
  }
  const sourcePath = path.resolve(args[sourceArg + 1]);
  if (!fs.statSync(sourcePath).isFile()) throw new Error('Source must be an existing SQLite snapshot');
  const reportPath = path.resolve(args[outputArg + 1]);
  if (fs.existsSync(reportPath)) throw new Error('Report already exists; choose a new report path');
  const url = process.env.MYSQL_DATABASE_URL;
  if (!url || new URL(url).protocol !== 'mysql:') throw new Error('MYSQL_DATABASE_URL is required');
  const { PrismaClient: SqliteClient, Prisma } = require('../../generated/sqlite-migration');
  const { PrismaClient } = require('@prisma/client');
  const source = new SqliteClient({ datasourceUrl: 'file:' + sourcePath.replaceAll('\\', '/') });
  const target = new PrismaClient({ datasourceUrl: url });
  try {
    const report = await transfer(source, target, Prisma.dmmf.datamodel.models, {
      verifyOnly: modes[0] === '--verify', rollback: modes[0] === '--rehearse',
    });
    const result = { completedAt: new Date().toISOString(), ...report };
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ mode: result.mode, tables: Object.keys(report.tables).length,
      rows: Object.values(report.tables).reduce((n, t) => n + t.rows, 0), verified: true }));
  } finally { await source.$disconnect(); await target.$disconnect(); }
}

module.exports = { fingerprint, modelOrder, rowOrder, transfer };
if (require.main === module) main().catch(error => {
  // Do not print connection strings, row contents or Prisma query arguments.
  const safe = /^(Destination is not empty:|Content verification failed:|Invalid\/cyclic hierarchy|Use --source|Cyclic model dependencies|Rehearsal rollback failed|Report already exists)/.test(error.message);
  console.error(safe ? error.message : `Migration failed (${error.code || error.name}); destination transaction was not partially imported.`);
  process.exitCode = 1;
});
