// A business's config in Octo (#103): stored by business, loaded on demand through a small cache, never crossing businesses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SiteConfigs } from '../src/site-config.ts';
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
