// The backend's state (#102): caller verification, rate limits and resume snapshots live in Stores, so they survive a
// restart, are shared by a second instance, and never grow past a cap. Octo's SQL is stubbed at fetch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../api.ts';
import { MemoryStore, type Store } from '../../../copilot-engine/src/memory.ts';
import { OctoStore } from '../../../copilot-engine/src/octo-store.ts';
import { pgSql } from '../../../copilot-engine/tests/pg-sql.ts';

let clients: { id: string; full_name: string }[] = [];
globalThis.fetch = (async (_url: string, init: { body: string }) => {
  const sql = JSON.parse(init.body).sql as string;
  const rows = /bw_clients/.test(sql) ? clients : /bw_returns/.test(sql) ? [{ tax_year: 2025, status: 'ready', updated: '2026-01-01', next_step: 'sign', preparer: 'Pat', amount: '0' }] : [];
  return new Response(JSON.stringify({ rows }), { status: 200 });
}) as unknown as typeof fetch;

const ENV = { OPENROUTER_JEV_KEY: 'k', OCTO_KEY: 'k', OCTO_WORKSPACE: 'ws', OCTO_BASE: 'http://octo.test/api', SIGNING_SECRET: 's' };
const same = async (said: string, names: string[]) => names.map(n => n === said);
const instance = (stores: { calls?: Store; sessions?: Store; limits?: Store }, env: Record<string, string> = {}) => createApi({ ...ENV, ...env }, { matchNames: same, stores });
const post = (api: ReturnType<typeof instance>, path: string, body: unknown, ip = '9.9.9.9') =>
  api.handle(new Request(`http://x${path}`, { method: 'POST', body: JSON.stringify(body) }), ip).then(async (r): Promise<Reply> => ({ status: r.status, ...(await r.json() as object) }));
// biome-ignore lint/suspicious/noExplicitAny: a reply is whatever JSON the endpoint sent
type Reply = { status: number } & Record<string, any>;
const guess = { name: 'Ann Lee', dob: '1980-01-01', ssn4: '1234', zip: '12345' };

test('three failed tries lock a call, and the lock holds on a second instance and after a restart', async () => {
  clients = [];
  const calls = new MemoryStore();
  const a = instance({ calls });
  const r1 = await post(a, '/api/verify', guess);
  assert.equal(r1.result, 'no_match'); assert.equal(r1.triesLeft, 2);
  const call = r1.call as string;
  const b = instance({ calls }); // a second instance
  const r2 = await post(b, '/api/verify', { ...guess, call });
  assert.equal(r2.triesLeft, 1);
  const c = instance({ calls }); // a restart: new process, same store
  assert.equal((await post(c, '/api/verify', { ...guess, call })).result, 'locked');
  clients = [{ id: 'cl1', full_name: 'Ann Lee' }];
  assert.equal((await post(a, '/api/verify', { ...guess, call })).result, 'locked', 'even a right answer is refused once locked');
});

test('six failures from one visitor lock their next call too, however many calls they start', async () => {
  clients = [];
  const calls = new MemoryStore();
  const a = instance({ calls });
  for (let i = 0; i < 6; i++) await post(a, '/api/verify', guess, '5.5.5.5');
  assert.equal((await post(instance({ calls }), '/api/verify', guess, '5.5.5.5')).result, 'locked');
  assert.equal((await post(a, '/api/verify', guess, '6.6.6.6')).result, 'no_match', 'another visitor is not affected');
});

test('a verified call is known to a second instance, and its account card needs that', async () => {
  clients = [{ id: 'cl1', full_name: 'Ann Lee' }];
  const calls = new MemoryStore();
  const a = instance({ calls });
  const r = await post(a, '/api/verify', guess);
  assert.equal(r.result, 'match');
  const b = instance({ calls });
  assert.equal(await b.verifiedAs(r.call as string), 'cl1');
  assert.equal((await post(b, '/api/account/status', { call: r.call })).status, 200);
  assert.equal((await post(b, '/api/account/status', { call: 'f'.repeat(32) })).status, 403);
  assert.equal((await post(b, '/api/account/status', { call: 'not-a-call-id' })).status, 403);
});

test('a flood of calls cannot grow the call store past its cap', async () => {
  clients = [];
  const calls = new MemoryStore(Date.now, { max: 100 });
  const a = instance({ calls }, { RATE_PER_MIN: '100000' });
  for (let i = 0; i < 1000; i++) await post(a, '/api/verify', {}, `10.0.${i >> 8}.${i & 255}`);
  assert.ok(calls.size <= 100, `holds ${calls.size}`);
});

test('the rate limit counts per visitor, a minute from their first request, and a shared store makes it shared', async () => {
  const limits = new MemoryStore();
  const a = instance({ limits }, { RATE_PER_MIN: '5' }), b = instance({ limits }, { RATE_PER_MIN: '5' });
  const statuses: number[] = [];
  for (let i = 0; i < 7; i++) statuses.push((await post(i % 2 ? a : b, '/api/log', { where: 'x', message: 'y' }, '7.7.7.7')).status);
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429, 429]);
  assert.equal((await post(a, '/api/log', { where: 'x', message: 'y' }, '8.8.8.8')).status, 200, 'another visitor has their own count');
});

test('resume snapshots: kept per business and session, shared by instances, never crossing businesses', async () => {
  const sessions = new MemoryStore();
  const a = instance({ sessions }), b = instance({ sessions });
  const id = 'session-abcdefgh-1234';
  const snap = { v: 1, flow: 'f1', savedAt: 0, values: { name: 'Maya' }, pending: null, queue: [], current: 'x', returnTo: [], log: [] };
  assert.equal((await post(a, '/api/session', { op: 'set', business: 'acme', id, snapshot: snap })).status, 200);
  const got = await post(b, '/api/session', { op: 'get', business: 'acme', id });
  assert.deepEqual((got.snapshot as typeof snap).values, { name: 'Maya' });
  assert.equal((await post(b, '/api/session', { op: 'get', business: 'other', id })).snapshot, null, 'same session id, another business: nothing');
  assert.equal((await post(b, '/api/session', { op: 'get', business: 'acme', id: 'session-zzzzzzzz-9999' })).snapshot, null);
  await post(a, '/api/session', { op: 'delete', business: 'acme', id });
  assert.equal((await post(b, '/api/session', { op: 'get', business: 'acme', id })).snapshot, null);
});

test('bad session requests are refused: odd ids, odd businesses, malformed or huge snapshots', async () => {
  const a = instance({ sessions: new MemoryStore() });
  const id = 'session-abcdefgh-1234';
  const ok = { v: 1, flow: 'f', values: { a: 'b' }, log: [] };
  for (const bad of [{ business: 'A b', id }, { business: 'acme', id: 'short' }, { business: 'a:b', id }, { business: 'acme', id: 'x'.repeat(100) }])
    assert.equal((await post(a, '/api/session', { op: 'get', ...bad })).status, 400);
  assert.equal((await post(a, '/api/session', { op: 'set', business: 'acme', id, snapshot: { ...ok, v: 2 } })).status, 400);
  assert.equal((await post(a, '/api/session', { op: 'set', business: 'acme', id, snapshot: { ...ok, values: { a: 5 } } })).status, 400);
  assert.equal((await post(a, '/api/session', { op: 'set', business: 'acme', id, snapshot: { ...ok, log: Array.from({ length: 25 }, () => ({ who: 'user', text: 'x'.repeat(900) })) } })).status, 400);
  assert.equal((await post(a, '/api/session', { op: 'nope', business: 'acme', id })).status, 400);
});

test('the same state works on the Octo-backed store: a restart loses neither a lock nor a snapshot', async () => {
  clients = [];
  const { sql } = await pgSql();
  const mk = () => instance({ calls: new OctoStore(sql, { table: 'kv_api' }), sessions: new OctoStore(sql, { table: 'kv_api' }) });
  const a = mk();
  const call = (await post(a, '/api/verify', guess)).call as string;
  await post(a, '/api/verify', { ...guess, call });
  const id = 'session-abcdefgh-1234';
  await post(a, '/api/session', { op: 'set', business: 'acme', id, snapshot: { v: 1, flow: 'f', values: { a: 'b' }, log: [] } });
  const restarted = mk();
  assert.equal((await post(restarted, '/api/verify', { ...guess, call })).result, 'locked');
  assert.deepEqual(((await post(restarted, '/api/session', { op: 'get', business: 'acme', id })).snapshot as { values: unknown }).values, { a: 'b' });
});
