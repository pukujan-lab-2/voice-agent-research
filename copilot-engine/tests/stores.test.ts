// The stores behind the backend's state (#102): a hard size cap, a time limit, atomic counters, and the Octo-backed
// store on a real Postgres engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../src/memory.ts';
import { OctoStore } from '../src/octo-store.ts';
import { pgSql } from './pg-sql.ts';

// One engine for the file; each test uses its own table.
const { sql, db } = await pgSql();

const clock = () => { let t = 1_000_000; return { now: () => t, add: (ms: number) => { t += ms; } }; };

test('MemoryStore never holds more than its cap: 10,000 inserts keep the newest 1,000', async () => {
  const s = new MemoryStore(Date.now, { max: 1000 });
  for (let i = 0; i < 10_000; i++) await s.set(`k${i}`, { i }, 60_000);
  assert.equal(s.size, 1000);
  assert.equal(await s.get('k0'), undefined, 'the oldest is gone');
  assert.deepEqual(await s.get('k9999'), { i: 9999 }, 'the newest is kept');
  assert.deepEqual(await s.get('k9000'), { i: 9000 });
  assert.equal(await s.get('k8999'), undefined);
});

test('MemoryStore drops expired entries before live ones, and a counter window does not slide', async () => {
  const c = clock(); const s = new MemoryStore(c.now, { max: 3 });
  await s.set('old', 1, 1000);
  await s.set('live', 2, 60_000);
  c.add(2000);
  await s.set('a', 3, 60_000); await s.set('b', 4, 60_000);
  assert.equal(await s.get('live'), 2, 'the expired one went first, not the oldest live one');
  assert.equal(await s.get('old'), undefined);
  assert.equal(await s.incr('n', 1000), 1);
  c.add(600);
  assert.equal(await s.incr('n', 1000), 2);
  c.add(500); // 1,100 ms after the first: a new window, even though the second increment was only 500 ms ago
  assert.equal(await s.incr('n', 1000), 1);
});

test('MemoryStore without a cap still sheds expired entries as it goes', async () => {
  const c = clock(); const s = new MemoryStore(c.now);
  for (let i = 0; i < 1000; i++) await s.set(`k${i}`, i, 100);
  c.add(1000);
  for (let i = 0; i < 300; i++) await s.set(`n${i}`, i, 100_000);
  assert.ok(s.size <= 300 + 256, `size ${s.size}`);
});

test('OctoStore: get, set, delete, expiry and counters on real SQL', async () => {
  const s = new OctoStore(sql, { table: 'kv_basic' });
  assert.equal(await s.get('missing'), undefined);
  await s.set('snap', { v: 1, values: { a: 'x' } }, 60_000);
  assert.deepEqual(await s.get('snap'), { v: 1, values: { a: 'x' } });
  await s.set('forever', 'yes');
  assert.equal(await s.get('forever'), 'yes');
  await s.delete('snap');
  assert.equal(await s.get('snap'), undefined);
  await s.set('short', 1, 60_000);
  await db.query(`update kv_basic set exp = now() - interval '1 second' where k = 'short'`);
  assert.equal(await s.get('short'), undefined, 'an expired entry is not returned');
  assert.equal(await s.incr('n', 60_000), 1);
  assert.equal(await s.incr('n', 60_000), 2);
  assert.equal(await s.get('n'), 2);
  await db.query(`update kv_basic set exp = now() - interval '1 second' where k = 'n'`);
  assert.equal(await s.incr('n', 60_000), 1, 'an expired counter starts again');
});

test('OctoStore: a second instance, or a restart, loses nothing; counters are atomic across instances', async () => {
  const a = new OctoStore(sql, { table: 'kv_shared' }), b = new OctoStore(sql, { table: 'kv_shared' });
  await a.set('sess:acme:abc', { v: 1 }, 60_000);
  assert.deepEqual(await b.get('sess:acme:abc'), { v: 1 }, 'another instance reads what the first wrote');
  const counts = await Promise.all(Array.from({ length: 50 }, (_, i) => (i % 2 ? a : b).incr('rl:1.2.3.4', 60_000)));
  assert.deepEqual([...counts].sort((x, y) => x - y), Array.from({ length: 50 }, (_, i) => i + 1), 'no increment is lost or doubled');
});

test('OctoStore.sweep drops expired rows and keeps only the newest `max`', async () => {
  const s = new OctoStore(sql, { table: 'kv_sweep', max: 100 });
  for (let i = 0; i < 300; i++) await s.set(`k${i}`, i, 60_000);
  await db.query(`update kv_sweep set exp = now() - interval '1 second' where k = 'k299'`);
  await s.sweep();
  const n = (await sql('select count(*)::int as n from kv_sweep'))[0].n;
  assert.equal(n, 100);
  assert.equal(await s.get('k299'), undefined);
  assert.equal(await s.get('k250'), 250);
  assert.equal(await s.get('k0'), undefined);
});
