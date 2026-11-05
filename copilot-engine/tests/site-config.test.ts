// A business's config in Octo (#103): stored by business, loaded on demand through a small cache, never crossing businesses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SiteConfigs, newSiteKey, SITE_KEY, type Workspaces } from '../src/site-config.ts';
import { createWorkspace, workspaceSlug } from '../src/octo-workspaces.ts';
import type { Sql } from '../src/octo-store.ts';
import { pgSql } from './pg-sql.ts';

const { sql, db } = await pgSql();
const clock = () => { let t = 1_000_000; return { now: () => t, add: (ms: number) => { t += ms; } }; };

test('a config is stored and read back by business; an unknown business has none', async () => {
  const s = new SiteConfigs(sql, { table: 'sites_basic' });
  assert.equal(await s.get('acme'), null);
  await s.put('acme', { business: 'acme', voice: { stacks: ['default', 'multilingual'], default: 'default' }, pages: [{ path: '/', title: 'Home' }] });
  assert.deepEqual((await s.get('acme'))?.voice, { stacks: ['default', 'multilingual'], default: 'default' });
  await s.put('acme', { voice: { stacks: ['default'] } });
  assert.deepEqual((await s.get('acme'))?.voice?.stacks, ['default'], 'a put replaces it at once on the instance that wrote it');
  await s.remove('acme');
  assert.equal(await s.get('acme'), null);
});

test('two businesses with the same page paths, form ids and stacks never read each other\'s config', async () => {
  const s = new SiteConfigs(sql, { table: 'sites_iso' });
  const shared = { pages: [{ path: '/apply', title: 'Apply', form: true }] };
  await s.put('acme', { ...shared, desk: { greeting: 'Hello from Acme' } });
  await s.put('acme-two', { ...shared, desk: { greeting: 'Hello from Acme Two' } });
  assert.deepEqual((await s.get('acme'))?.desk, { greeting: 'Hello from Acme' });
  assert.deepEqual((await s.get('acme-two'))?.desk, { greeting: 'Hello from Acme Two' });
  assert.equal(await s.get('acm'), null, 'a prefix of a business id is not that business');
  assert.equal(await s.get('%'), null);
  assert.equal(await s.get("acme' or '1'='1"), null, 'an odd id is refused before it reaches SQL');
  await s.remove('acme');
  assert.ok(await s.get('acme-two'), 'removing one leaves the other');
  await assert.rejects(s.put('acme', { business: 'acme-two' }), /is not "acme"/, 'a config cannot claim another business');
  assert.equal((await new SiteConfigs(sql, { table: 'sites_iso' }).get('acme-two'))?.desk !== undefined, true, 'a second instance sees what the first wrote');
});

test('bad configs and bad ids are refused and nothing is written', async () => {
  const s = new SiteConfigs(sql, { table: 'sites_bad' });
  await assert.rejects(s.put('Acme', {}), /lower-case/);
  await assert.rejects(s.put('a'.repeat(41), {}), /lower-case/);
  await assert.rejects(s.put('acme', [] as never), /JSON object/);
  await assert.rejects(s.put('acme', { blob: 'x'.repeat(260_000) }), /limit is/);
  await assert.rejects(s.put('acme', { voice: { stacks: ['a', 5 as never] } }), /voice.stacks/);
  await assert.rejects(s.put('acme', { voice: { stacks: ['a'], default: 'b' } }), /voice.default/);
  for (const days of [0, 3651, 1.5, '30']) await assert.rejects(s.put('acme', { retention: { days } as never }), /retention/, `retention ${days}`);
  await s.put('acme-keeps', { retention: { days: 365 } });
  for (const recording of [{}, { audio: 'no' }, { audio: false, video: true }, false]) await assert.rejects(s.put('acme', { recording } as never), /recording/);
  await s.put('acme-quiet', { recording: { audio: false } });
  const offer = { when: 'payment plan', href: '/plan', label: 'the payment plan request', say: 'I can open it with you. Want me to?' };
  for (const [bad, why] of [[{ ...offer, when: '(' }, /valid regular/], [{ ...offer, href: 'https://evil.example' }, /path on the site/], [{ ...offer, href: '//evil.example' }, /path on the site/],
    [{ ...offer, say: ' ' }, /say must/], [{ ...offer, label: undefined }, /label must/]] as const)
    await assert.rejects(s.put('acme', { desk: { offers: [bad] } } as never), why, `offer ${JSON.stringify(bad)}`);
  await s.put('acme-offers', { desk: { offers: [offer] } });
  assert.equal(await s.get('acme'), null);
});

test('loading is on demand and bounded: a cache with a size cap and a time limit', async () => {
  const c = clock();
  const s = new SiteConfigs(sql, { table: 'sites_cache', cacheMax: 5, ttlMs: 60_000, now: c.now });
  for (let i = 0; i < 40; i++) await s.put(`biz-${i}`, { n: i });
  for (let i = 0; i < 40; i++) assert.equal((await s.get(`biz-${i}`))?.n, i);
  assert.ok(s.cached <= 5, `holds ${s.cached} configs in memory`);
  // another instance changes a config; this one serves its cached copy until the time limit, then sees the change
  await s.get('biz-39');
  await new SiteConfigs(sql, { table: 'sites_cache' }).put('biz-39', { n: 'new' });
  assert.equal((await s.get('biz-39'))?.n, 39);
  c.add(61_000);
  assert.equal((await s.get('biz-39'))?.n, 'new');
  await db.exec('select 1');
});

test('a site block holds one public key and the exact origins allowed to use it (#125)', async () => {
  const s = new SiteConfigs(sql, { table: 'sites_key' });
  const key = newSiteKey();
  assert.match(key, SITE_KEY);
  assert.notEqual(key, newSiteKey(), 'each key is new');
  await assert.rejects(s.put('acme', { site: { key: 'abc', origins: ['https://acme.test'] } }), /key/);
  await assert.rejects(s.put('acme', { site: { key, origins: [] } }), /origins/);
  await assert.rejects(s.put('acme', { site: { key, origins: ['https://acme.test/page'] } }), /origin/, 'an origin, not a page');
  await assert.rejects(s.put('acme', { site: { key, origins: ['http://acme.test'] } }), /origin/, 'plain http only for localhost');
  await assert.rejects(s.put('acme', { site: { key, origins: Array.from({ length: 21 }, (_, i) => `https://s${i}.test`) } }), /origins/);
  await s.put('acme', { site: { key, origins: ['https://www.acme.test', 'http://localhost:5173'] } });
  assert.equal((await s.byKey(key))?.business, 'acme');
  assert.equal(await s.byKey(newSiteKey()), null, 'an unknown key');
  assert.equal(await s.byKey("' or 1=1 --"), null, 'an odd key is refused before it reaches SQL');
  assert.equal(await s.knowsOrigin('https://www.acme.test'), true);
  assert.equal(await s.knowsOrigin('https://evil.test'), false);
  await assert.rejects(s.put('harbor', { site: { key, origins: ['https://harbor.test'] } }), /another business/, 'one key, one business');
  const next = newSiteKey();
  await s.put('acme', { site: { key: next, origins: ['https://www.acme.test'] } });
  assert.equal(await s.byKey(key), null, 'a replaced key stops working at once on the instance that wrote it');
  assert.equal((await s.byKey(next))?.business, 'acme');
});

// A business's own workspace (#127): each one a separate Postgres, made by `create` the way Octo's POST /workspaces would.
async function ownWorkspaces() {
  const dbs = new Map<string, Sql>();
  const made: string[] = [];
  let fail = '';
  const ws: Workspaces = {
    sqlFor: id => { const s = dbs.get(id); if (!s) throw new Error(`no workspace ${id}`); return s; },
    create: async business => {
      if (fail) throw new Error(fail);
      const id = `00000000-0000-4000-8000-${String(dbs.size + 1).padStart(12, '0')}`;
      dbs.set(id, (await pgSql()).sql); made.push(business);
      return id;
    },
  };
  return { ws, made, dbs, failNext: (m: string) => { fail = m; } };
}

test('adding an outside business creates its own workspace and stores the id; its config lives there, not in the registry (#127)', async () => {
  const { ws, made, dbs } = await ownWorkspaces();
  const s = new SiteConfigs(sql, { table: 'sites_own', workspaces: ws });
  const key = newSiteKey();
  await s.put('clinic', { workspace: {}, site: { key, origins: ['https://clinic.test'] }, desk: { greeting: 'Hello from the clinic' } });
  assert.deepEqual(made, ['clinic'], 'one workspace, for that business');
  const c = await s.get('clinic');
  const id = c?.workspace?.id ?? '';
  assert.ok(dbs.has(id), 'the stored id is the workspace that was made');
  assert.deepEqual(c?.desk, { greeting: 'Hello from the clinic' });
  const shared = (await sql('select config from sites_own where business = $1', ['clinic']))[0]?.config as Record<string, unknown>;
  assert.deepEqual(Object.keys(shared).sort(), ['business', 'site', 'workspace'], 'the shared registry holds only how to reach it');
  const own = (await dbs.get(id)!('select config from sites_own where business = $1', ['clinic']))[0]?.config as Record<string, unknown>;
  assert.deepEqual(own.desk, { greeting: 'Hello from the clinic' }, 'the rest is in its own workspace');
  assert.equal((await s.byKey(key))?.business, 'clinic', 'its site key still finds it');
  // a later put keeps the same workspace, with or without the block
  await s.put('clinic', { desk: { greeting: 'Hi again' } });
  await s.put('clinic', { workspace: { id }, desk: { greeting: 'Hi again' } });
  assert.deepEqual(made, ['clinic'], 'no second workspace');
  assert.equal((await s.get('clinic'))?.workspace?.id, id);
  // demo businesses stay on the shared workspace
  await s.put('demo-shop', { desk: { greeting: 'Demo' } });
  assert.equal((await s.get('demo-shop'))?.workspace, undefined);
  assert.ok(((await sql('select config from sites_own where business = $1', ['demo-shop']))[0]?.config as Record<string, unknown> | undefined)?.desk, 'its whole config stays in the shared registry');
});

test('a put can never point a business at another workspace or move it off its own', async () => {
  const { ws, made, failNext } = await ownWorkspaces();
  const s = new SiteConfigs(sql, { table: 'sites_own_guard', workspaces: ws });
  await s.put('clinic', { workspace: {} });
  await s.put('harbor', { workspace: {} });
  const clinic = (await s.get('clinic'))?.workspace?.id, harbor = (await s.get('harbor'))?.workspace?.id;
  assert.notEqual(clinic, harbor, 'two businesses, two workspaces');
  await assert.rejects(s.put('clinic', { workspace: { id: harbor } }), /cannot be changed/, 'another business\'s workspace');
  await assert.rejects(s.put('newco', { workspace: { id: clinic } }), /set by the registry/, 'a new business naming an existing workspace');
  await assert.rejects(s.put('newco', { workspace: 'own' as never }), /workspace must be/);
  await assert.rejects(s.put('newco', { workspace: { id: clinic, extra: 1 } as never }), /workspace must be/);
  assert.equal(await s.get('newco'), null, 'nothing was written');
  await assert.rejects(new SiteConfigs(sql, { table: 'sites_own_guard' }).put('newco', { workspace: {} }), /account-wide/, 'no key, no workspace');
  await assert.rejects(new SiteConfigs(sql, { table: 'sites_own_guard' }).get('clinic'), /account-wide/, 'a registry that cannot reach the workspace refuses, never serves the shared one');
  failNext('octo down');
  await assert.rejects(s.put('newco', { workspace: {} }), /octo down/);
  assert.equal(await s.get('newco'), null);
  assert.deepEqual(made, ['clinic', 'harbor']);
  await s.remove('clinic');
  assert.equal(await s.get('clinic'), null);
});

test('createWorkspace asks Octo once per business and reuses the one an interrupted add made', async () => {
  const real = globalThis.fetch;
  const calls: { method: string; url: string; body: any }[] = [];
  let answer: { status: number; body: unknown } = { status: 201, body: { workspace: { id: '11111111-2222-4333-8444-555555555555', slug: 'copilot-clinic' }, rawSecret: 'octo_live_ws_secret' } };
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : null });
    if ((init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify({ workspaces: [{ id: '99999999-2222-4333-8444-555555555555', slug: workspaceSlug('clinic') }] }));
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  }) as typeof fetch;
  try {
    const octo = { base: 'http://octo.test/api', key: 'octo_live_acc_test' };
    assert.equal(await createWorkspace(octo, 'clinic'), '11111111-2222-4333-8444-555555555555');
    assert.deepEqual([calls[0].method, calls[0].url, calls[0].body.slug], ['POST', 'http://octo.test/api/workspaces', 'copilot-clinic']);
    answer = { status: 409, body: { error: 'SLUG_TAKEN' } };
    assert.equal(await createWorkspace(octo, 'clinic'), '99999999-2222-4333-8444-555555555555', 'a taken slug is that business\'s workspace');
    answer = { status: 429, body: { error: 'WORKSPACE_DAILY_LIMIT' } };
    await assert.rejects(createWorkspace(octo, 'clinic'), /one new workspace a day/);
    answer = { status: 403, body: { error: 'FORBIDDEN' } };
    await assert.rejects(createWorkspace(octo, 'clinic'), /not account-wide/);
  } finally { globalThis.fetch = real; }
});
