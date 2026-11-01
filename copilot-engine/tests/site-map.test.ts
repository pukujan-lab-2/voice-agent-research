// A large site's map in Octo (#104): 200 forms found by search, one flow loaded per lookup, never crossing businesses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SiteMap, type MapEntry } from '../src/site-map.ts';
import type { Flow } from '../src/types.ts';
import { pgSql } from './pg-sql.ts';

const { sql } = await pgSql();

const TOPICS = ['mortgage', 'passport', 'warranty', 'refund', 'enrollment', 'permit', 'claim', 'booking', 'complaint', 'rebate', 'transfer', 'renewal', 'appeal', 'quote', 'registration', 'scholarship', 'pension', 'subsidy', 'license', 'exemption'];
const KINDS = ['standard', 'urgent', 'student', 'business', 'senior', 'overseas', 'joint', 'minor', 'corporate', 'veteran'];

function flowOf(id: string, title: string): Flow {
  return { id, business: 'Big Co', intro: `Hi, this is the ${title}.`, scope: 'this form', doneMessage: 'Done.',
    fields: [{ name: 'name', label: 'Full name', question: 'Your name?', kind: 'name' }, { name: 'ref', label: `${title} reference number`, question: 'The reference?', kind: 'text' }] };
}
// 200 forms: every pairing of 20 topics and 10 kinds, each at its own path with its own title.
const forms: MapEntry[] = TOPICS.flatMap((t, i) => KINDS.map((k, j): MapEntry => {
  const id = `${t}-${k}`, title = `${k[0].toUpperCase()}${k.slice(1)} ${t} application`;
  return { id, kind: 'form', path: `/services/${t}/${k}`, title, keywords: [`${t} ${k}`], flow: flowOf(id, title) };
}));

async function load(table: string, business: string) {
  const map = new SiteMap(sql, { table });
  for (const f of forms) await map.put(business, f);
  return map;
}

test('a site of 200 forms: 30 requests in a visitor\'s words find the right form, and one flow is loaded each', async () => {
  const calls: { text: string; rows: number }[] = [];
  const counting = async (text: string, params?: unknown[]) => { const rows = await sql(text, params); calls.push({ text, rows: rows.length }); return rows; };
  await load('map_big', 'bigco');
  const map = new SiteMap(counting, { table: 'map_big' });
  let right = 0;
  for (let n = 0; n < 30; n++) {
    const t = TOPICS[(n * 7) % 20], k = KINDS[(n * 3) % 10];
    const asked = [`I need to do the ${k} ${t} thing`, `where can I apply for a ${t}, the ${k} one`, `${k} ${t}`][n % 3];
    calls.length = 0;
    const refs = await map.find('bigco', asked);
    const flow = refs[0] ? await map.load('bigco', refs[0].id) : null;
    if (refs[0]?.id === `${t}-${k}` && flow?.id === `${t}-${k}`) right++;
    const flowQueries = calls.filter(c => /select flow/.test(c.text));
    assert.equal(flowQueries.length, 1, 'one flow query per lookup');
    assert.equal(flowQueries[0].rows, 1, 'which returns one flow');
    assert.ok(calls.filter(c => !/select flow/.test(c.text)).every(c => c.rows <= 3), 'a search returns at most 3 references');
  }
  assert.equal(right, 30, 'all 30 found the right form');
  assert.equal(Object.keys(map).sort().join(), 'ready,sql,table', 'the index holds no forms in memory');
});

test('a request that names a field, or only part of a title, still finds the form; nonsense finds nothing', async () => {
  const map = await load('map_words', 'bigco');
  assert.equal((await map.find('bigco', 'where do I put my veteran pension reference number'))[0].id, 'pension-veteran');
  assert.equal((await map.find('bigco', 'urgent passport'))[0].id, 'passport-urgent');
  assert.equal((await map.find('bigco', 'I would like to appeal'))[0].path.startsWith('/services/appeal/'), true);
  assert.deepEqual(await map.find('bigco', 'zzzzzz qqqqq'), []);
  assert.deepEqual(await map.find('bigco', 'the a of to'), [], 'only filler words');
  assert.deepEqual(await map.find('bigco', "'; drop table x; --"), []);
  assert.equal((await map.find('bigco', 'mortgage', { k: 50 })).length, 10, 'the number of results is capped');
});

test('the form for the page a visitor is on is found by its path', async () => {
  const map = await load('map_path', 'bigco');
  assert.deepEqual((await map.forPage('bigco', '/services/permit/joint/')).map(r => r.id), ['permit-joint']);
  assert.deepEqual((await map.forPage('bigco', '/services/permit/joint?utm=x#top')).map(r => r.id), ['permit-joint']);
  assert.deepEqual(await map.forPage('bigco', '/services/permit'), []);
});

test('pages and forms share the map; a page has no flow to load', async () => {
  const map = new SiteMap(sql, { table: 'map_pages' });
  await map.put('bigco', { id: 'home', kind: 'page', path: '/', title: 'Welcome home', keywords: ['start', 'overview'] });
  await map.put('bigco', forms[0]);
  assert.equal((await map.find('bigco', 'welcome'))[0].kind, 'page');
  assert.deepEqual((await map.find('bigco', 'mortgage', { kind: 'page' })), []);
  assert.equal(await map.load('bigco', 'home'), null);
  assert.equal((await map.forPage('bigco', '/'))[0].id, 'home');
});

test('one business never finds, loads or replaces another\'s forms, even with the same ids and paths', async () => {
  const map = new SiteMap(sql, { table: 'map_iso' });
  await map.put('acme', { id: 'apply', kind: 'form', path: '/apply', title: 'Acme loan application', flow: flowOf('apply', 'Acme loan application') });
  await map.put('acme-two', { id: 'apply', kind: 'form', path: '/apply', title: 'Acme Two grant application', flow: flowOf('apply', 'Acme Two grant application') });
  assert.equal((await map.find('acme', 'loan'))[0].title, 'Acme loan application');
  assert.deepEqual(await map.find('acme', 'grant'), [], 'acme has no grant form');
  assert.equal((await map.find('acme-two', 'grant'))[0].title, 'Acme Two grant application');
  assert.equal((await map.load('acme', 'apply'))?.intro, 'Hi, this is the Acme loan application.');
  assert.equal((await map.load('acme-two', 'apply'))?.intro, 'Hi, this is the Acme Two grant application.');
  assert.deepEqual((await map.forPage('acme-two', '/apply')).map(r => r.title), ['Acme Two grant application']);
  await map.remove('acme', 'apply');
  assert.equal(await map.load('acme', 'apply'), null);
  assert.ok(await map.load('acme-two', 'apply'), 'removing one leaves the other');
  assert.deepEqual(await map.find("acme' or business like '%", 'loan'), [], 'an odd business id never reaches SQL');
});

test('bad entries are refused', async () => {
  const map = new SiteMap(sql, { table: 'map_bad' });
  const ok = forms[0];
  await assert.rejects(map.put('Bad Id', ok), /business/);
  await assert.rejects(map.put('acme', { ...ok, id: 'Has Space' }), /entry id/);
  await assert.rejects(map.put('acme', { ...ok, kind: 'form', flow: undefined }), /needs its flow/);
  await assert.rejects(map.put('acme', { ...ok, path: 'no-slash' }), /path/);
  await assert.rejects(map.put('acme', { ...ok, flow: { ...ok.flow!, fields: Array.from({ length: 2001 }, (_, i) => ({ name: `f${i}`, label: `F ${i}`, question: '?', kind: 'text' as const })) } }), /2000 fields/);
});
