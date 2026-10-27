const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fingerprint, modelOrder, rowOrder } = require('./transfer.cjs');

test('content verification ignores row/key order but detects data/date changes', () => {
  const a = [{ id: 'b', content: 'ação 🐉'.repeat(1000), at: new Date('2026-01-01T00:00:00Z') }, { id: 'a', content: null }];
  const b = [{ content: null, id: 'a' }, { at: new Date('2026-01-01T00:00:00Z'), content: a[0].content, id: 'b' }];
  assert.equal(fingerprint(a), fingerprint(b));
  assert.notEqual(fingerprint(a), fingerprint([{ ...a[0], content: 'truncated' }, a[1]]));
  assert.notEqual(fingerprint(a), fingerprint([{ ...a[0], at: new Date('2026-01-01T00:00:00.001Z') }, a[1]]));
});

const relation = (name, type, field, to = 'id') => ({ name, kind: 'object', type, relationFromFields: [field], relationToFields: [to] });
test('dependencies order tables without disabling foreign keys', () => {
  const models = [{ name: 'Child', fields: [relation('parent', 'Parent', 'parentId')] }, { name: 'Parent', fields: [] }];
  assert.deepEqual(modelOrder(models).map(m => m.name), ['Parent', 'Child']);
  models[1].fields.push(relation('child', 'Child', 'childId'));
  assert.throws(() => modelOrder(models), /Cyclic/);
});

test('map/world hierarchies order parents first and reject cycles or missing parents', () => {
  const model = { name: 'Map', fields: [relation('parent', 'Map', 'parentId')] };
  const rows = [{ id: 'c', parentId: 'b' }, { id: 'a', parentId: null }, { id: 'b', parentId: 'a' }];
  assert.deepEqual(rowOrder(model, rows).map(r => r.id), ['a', 'b', 'c']);
  assert.throws(() => rowOrder(model, [{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }]), /cyclic/);
  assert.throws(() => rowOrder(model, [{ id: 'a', parentId: 'missing' }]), /Invalid/);
});
