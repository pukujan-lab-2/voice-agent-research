// An outside business in its own Octo workspace (#127, decision 0021): the registry creates the workspace, and a chat
// for that business (its config, resume session, desk turn and traces) runs there while the shared workspace gains
// nothing. Octo is faked at fetch: each workspace is its own Postgres (PGlite), reached only with the right key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../api.ts';
import type { SpanSpec } from '../tracing.ts';
import { SiteConfigs, newSiteKey } from '../../../copilot-engine/src/site-config.ts';
import { createWorkspace, octoSql } from '../../../copilot-engine/src/octo-workspaces.ts';
import type { Sql } from '../../../copilot-engine/src/octo-store.ts';
import { pgSql } from '../../../copilot-engine/tests/pg-sql.ts';
import { CallVault } from '../../../copilot-engine/src/call-vault.ts';
import { FakeTransit } from '../../../copilot-engine/tests/fake-transit.ts';

const SHARED = 'aaaaaaaa-0000-4000-8000-000000000000', SHARED_KEY = 'octo_live_ws_shared', ACCOUNT_KEY = 'octo_live_acc_test';
const BASE = 'http://octo.test/api', DESK = 'http://desk.test/v1';
const dbs = new Map<string, Sql>([[SHARED, (await pgSql()).sql]]);
const created: string[] = [];

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input), method = init?.method ?? 'GET', auth = new Headers(init?.headers).get('authorization');
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
  if (url === `${DESK}/chat/completions`) return reply({ model: 'lfm3', choices: [{ message: { content: 'Hello, how can I help with your appointment?' } }] });
  if (url === `${BASE}/workspaces` && method === 'POST') {
    if (auth !== `Bearer ${ACCOUNT_KEY}`) return reply({ error: 'FORBIDDEN' }, 403);
    const id = `bbbbbbbb-0000-4000-8000-${String(dbs.size).padStart(12, '0')}`;
    dbs.set(id, (await pgSql()).sql); created.push(body.slug);
    return reply({ workspace: { id, slug: body.slug }, rawSecret: 'octo_live_ws_new' }, 201);
  }
  const q = url.match(/^http:\/\/octo\.test\/api\/workspaces\/([\w-]+)\/query$/);
  if (q) {
    const db = dbs.get(q[1]);
    // the shared workspace's own key reaches only it; a business workspace needs the account-wide key
    if (!db || auth !== `Bearer ${q[1] === SHARED ? SHARED_KEY : ACCOUNT_KEY}`) return reply({ error: 'FORBIDDEN' }, 403);
    try { return reply({ rows: await db(body.sql, body.params) }); } catch (e) { return reply({ error: (e as Error).message }, 400); }
  }
  return reply({ rows: [] });
}) as typeof fetch;

// Everything in a workspace, table by table, to show what a chat left behind.
async function dump(ws: string): Promise<Record<string, unknown[]>> {
  const sql = dbs.get(ws)!;
  const out: Record<string, unknown[]> = {};
  for (const { table_name } of await sql(`select table_name from information_schema.tables where table_schema = 'public' order by 1`) as { table_name: string }[])
    out[table_name] = await sql(`select * from ${table_name} order by 1`);
  return out;
}

const KEY = newSiteKey(), ORIGIN = 'https://www.clinic.test';
const registry = new SiteConfigs(octoSql({ base: BASE, key: SHARED_KEY }, SHARED), {
  workspaces: { sqlFor: ws => octoSql({ base: BASE, key: ACCOUNT_KEY }, ws), create: b => createWorkspace({ base: BASE, key: ACCOUNT_KEY }, b) } });
await registry.put('clinic-test', { workspace: {}, site: { key: KEY, origins: [ORIGIN] }, desk: { greeting: 'Welcome to the clinic' }, voice: { stacks: ['default'] } });
await registry.put('demo-shop', { desk: { greeting: 'A demo' } });
const clinicWs = (await registry.get('clinic-test'))?.workspace?.id ?? '';

const env = { OPENROUTER_JEV_KEY: 'k', OCTO_KEY: SHARED_KEY, OCTO_WORKSPACE: SHARED, OCTO_ACCOUNT_KEY: ACCOUNT_KEY, OCTO_BASE: BASE, DESK_URL: DESK, SIGNING_SECRET: 's', SITE_ORIGINS: 'https://copilot.test' };
const traced: { name: string; session: string | null | undefined; ws: string | undefined; spec: SpanSpec }[] = [];
const transit = new FakeTransit();
const api = createApi(env, { vault: new CallVault(transit), trace: (s: SpanSpec, session, ws) => { traced.push({ name: s.name, session, ws, spec: s }); } });
const fromClinic = { origin: ORIGIN, 'x-site-key': KEY };
const post = (path: string, body: unknown, headers: Record<string, string> = fromClinic, a = api) =>
  a.handle(new Request(`https://copilot.test${path}`, { method: 'POST', headers: { ...headers, 'x-session-id': 'call-0001-abcdef' }, body: JSON.stringify(body) }), '1.2.3.4');

test('adding the business made one workspace for it and recorded its id', () => {
  assert.deepEqual(created, ['copilot-clinic-test']);
  assert.ok(dbs.has(clinicWs));
});

test('a test business runs a chat end to end in its own workspace, and the shared workspace gains no rows for it', async () => {
  const before = await dump(SHARED);
  const cfg = await api.handle(new Request(`https://copilot.test/api/copilot/config?business=clinic-test`, { headers: fromClinic }), '1.2.3.4');
  assert.equal(cfg.status, 200);
  const { config } = await cfg.json() as { config: Record<string, any> };
  assert.equal(config.desk.greeting, 'Welcome to the clinic', 'its config is read from its own workspace');
  assert.equal(config.workspace, undefined, 'the page is not told where the data lives');

  const snapshot = { v: 1, flow: 'booking', values: { name: 'Ana' }, log: [{ who: 'user', text: 'I need an appointment for my baby' }] };
  assert.equal((await post('/api/session', { op: 'set', business: 'clinic-test', id: 'session-0001-abcdef', snapshot })).status, 200);
  const desk = await post('/api/desk', { business: 'clinic-test', stack: 'default', messages: [{ role: 'system', content: 'You are the front desk.' }, { role: 'user', content: 'I need an appointment for my baby' }], tools: [{ type: 'function', function: { name: 'answer_question', parameters: {} } }] });
  assert.equal(desk.status, 200, await desk.clone().text());
  assert.match((await desk.json() as { content: string }).content, /appointment/);
  const now = Date.now();
  assert.equal((await post('/api/trace', { business: 'clinic-test', spans: [{ name: 'turn', start: now - 1000, end: now, input: 'I need an appointment' }] })).status, 200);
  const back = await post('/api/session', { op: 'get', business: 'clinic-test', id: 'session-0001-abcdef' });
  assert.equal((await back.json() as { snapshot: { values: Record<string, string> } }).snapshot.values.name, 'Ana', 'the session comes back');
  await new Promise(r => setTimeout(r, 20)); // the desk span is written after the reply

  const own = await dump(clinicWs);
  const row = (own.copilot_kv as { k: string; v: Record<string, unknown> }[]).find(r => r.k === 'sess:clinic-test:session-0001-abcdef');
  assert.ok(row, 'the session is in its workspace');
  assert.equal(row.v.sealed, 'a256gcm.v1', 'locked by its own key (#128)');
  assert.doesNotMatch(JSON.stringify(own.copilot_kv), /Ana|baby|booking/, 'no call text is readable in Octo');
  assert.deepEqual(traced.map(t => [t.name, t.ws]).sort(), [['desk', clinicWs], ['turn', clinicWs]], 'its traces go to its workspace');
  assert.doesNotMatch(JSON.stringify(traced.map(t => t.spec)), /appointment|baby|Ana/, 'no call text reaches a trace (#129)');
  const turn = traced.find(t => t.name === 'turn')!.spec.attributes!;
  assert.match(String(turn['call.record']), /^call-record\/clinic-test\/call-0001-abcdef\/[0-9a-f]{18}$/, 'the turn span points at its record');
  assert.doesNotMatch(JSON.stringify(own.copilot_call_turns), /appointment|baby/, 'the record is locked in its workspace');
  const record = await api.callRecord('clinic-test', 'call-0001-abcdef');
  assert.ok(record.some(r => r.entry.span === 'turn' && r.entry['input.value'] === 'I need an appointment'), 'and opens for its business');
  assert.ok(record.some(r => r.entry.span === 'desk' && /baby/.test(r.entry['input.value'] ?? '')), 'the desk turn is in it too');
  assert.deepEqual(await dump(SHARED), before, 'the shared workspace is exactly as it was');
  assert.doesNotMatch(JSON.stringify(before), /Welcome to the clinic|appointment/, 'and held only the registry entry for it');
});

test('demo businesses keep working on the shared workspace with their prefix', async () => {
  traced.length = 0;
  const own = await post('/api/session', { op: 'set', business: 'demo-shop', id: 'session-0002-abcdef', snapshot: { v: 1, flow: 'f', values: {}, log: [] } }, {});
  assert.equal(own.status, 200);
  assert.ok(((await dump(SHARED)).copilot_kv as { k: string }[]).some(r => r.k === 'sess:demo-shop:session-0002-abcdef'));
  assert.equal(((await dump(clinicWs)).copilot_kv as { k: string }[]).some(r => r.k.includes('demo-shop')), false);
  const now = Date.now();
  await post('/api/trace', { business: 'demo-shop', spans: [{ name: 'call', start: now - 10, end: now }] }, {});
  assert.deepEqual(traced.map(t => t.ws), [undefined], 'its traces go to the shared workspace');
});

test('without the account-wide key a business with its own workspace is refused, never served from the shared one', async () => {
  const before = await dump(SHARED);
  const keyless = createApi({ ...env, OCTO_ACCOUNT_KEY: undefined });
  const r = await post('/api/session', { op: 'set', business: 'clinic-test', id: 'session-0003-abcdef', snapshot: { v: 1, flow: 'f', values: {}, log: [] } }, fromClinic, keyless);
  assert.equal(r.status, 502);
  assert.deepEqual(await dump(SHARED), before);
});

test("a call record locked for one business can't be opened as another's", async () => {
  await registry.put('other-clinic', { desk: { greeting: 'Another' } });
  const row = ((await dump(clinicWs)).copilot_kv as { k: string; v: unknown }[]).find(r => r.k === 'sess:clinic-test:session-0001-abcdef')!;
  await dbs.get(SHARED)!(`insert into copilot_kv (k, v) values ($1, $2::jsonb)`, ['sess:other-clinic:session-0001-abcdef', JSON.stringify(row.v)]);
  const r = await post('/api/session', { op: 'get', business: 'other-clinic', id: 'session-0001-abcdef' }, {});
  assert.equal((await r.json() as { snapshot: unknown }).snapshot, null, 'the copied record does not open with the other business key');
});

test('a live server without OpenBao refuses to save a call record rather than store it readable', async () => {
  const before = await dump(clinicWs);
  const noKeys = createApi(env);
  const r = await post('/api/session', { op: 'set', business: 'clinic-test', id: 'session-0004-abcdef', snapshot: { v: 1, flow: 'f', values: { name: 'Sam' }, log: [] } }, fromClinic, noKeys);
  assert.equal(r.status, 503);
  assert.deepEqual(await dump(clinicWs), before);
});

test('call-record entries past the business retention are not read and the sweep deletes them (#129)', async () => {
  const sql = dbs.get(clinicWs)!;
  await sql(`update copilot_call_turns set at = now() - interval '31 days' where call = 'call-0001-abcdef' and sealed->>'iv' = (select sealed->>'iv' from copilot_call_turns where call = 'call-0001-abcdef' order by at, id limit 1)`);
  const kept = (await sql(`select count(*)::int n from copilot_call_turns`) as { n: number }[])[0].n;
  const read = await api.callRecord('clinic-test', 'call-0001-abcdef');
  assert.equal(read.length, kept - 1, 'the 31-day-old entry is not read under the 30-day default');
  assert.deepEqual(await api.sweepRecords(), { 'clinic-test': 1 });
  assert.equal((await sql(`select count(*)::int n from copilot_call_turns`) as { n: number }[])[0].n, kept - 1);

  await registry.put('clinic-test', { ...(await registry.get('clinic-test'))!, retention: { days: 1 } });
  await sql(`update copilot_call_turns set at = now() - interval '2 days'`);
  const fresh = createApi(env, { vault: new CallVault(transit) }); // the first one holds the config for a minute
  assert.deepEqual(await fresh.callRecord('clinic-test', 'call-0001-abcdef'), [], 'a business that keeps one day sees nothing older');
  assert.deepEqual(await fresh.sweepRecords(), { 'clinic-test': kept - 1 });
});
