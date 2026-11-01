import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanFilter, OctoHttp, SiteRetriever } from '../src/site-search.ts';
import { FakeSiteOcto, type SeedPassage } from './fakes/site-octo.ts';
import http from 'node:http';

const P = (business: string, language: string, pageType: string, section: string, text: string, title = 'Page'): SeedPassage =>
  ({ business, language, pageType, section, text, title, url: `https://${business}.test/${pageType}/${section.replace(/\W+/g, '-')}` });

function world() {
  const o = new FakeSiteOcto();
  o.seed([
    P('acme', 'en', 'policy', 'Refunds', 'Refunds are paid back to the original card within five days.', 'Returns'),
    P('acme', 'en', 'policy', 'Exchanges', 'Exchanges ship the new size when the parcel arrives back with us.', 'Returns'),
    P('acme', 'en', 'faq', 'Gift wrap', 'Gift wrap costs three dollars and refunds do not include the wrap.', 'FAQ'),
    P('acme', 'fr', 'policy', 'Remboursements', 'Les remboursements sont versés sous cinq jours sur la carte.', 'Retours'),
    P('globex', 'en', 'policy', 'Refunds', 'Globex refunds take thirty days and need a manager signature.', 'Globex returns'),
  ]);
  return o;
}
const mk = (o: FakeSiteOcto, extra: object = {}) => new SiteRetriever({ octo: o, business: 'acme', ...extra });
const sections = (ps: { section?: string }[]) => ps.map(p => p.section);

test('no filter: the business prefix alone, with the citation address from the table', async () => {
  const o = world();
  const r = await mk(o).search('refunds card', 5);
  assert.deepEqual(o.ragCalls[0].filter, { titlePrefix: 'acme/' });
  assert.ok(r.length >= 2 && r.every(p => p.id.startsWith('acme/')));
  assert.equal(r[0].cite?.title, 'Returns, Refunds');
  assert.match(r[0].cite!.url, /^https:\/\/acme\.test\//);
});

test('language narrows by prefix, and page type inside it', async () => {
  const o = world();
  const fr = await mk(o).search('remboursements', 5, { language: 'fr' });
  assert.equal(o.ragCalls[0].filter?.titlePrefix, 'acme/fr/');
  assert.deepEqual(sections(fr), ['Remboursements']);
  const faq = await mk(o).search('refunds', 5, { language: 'en', pageType: 'faq' });
  assert.equal(o.ragCalls[1].filter?.titlePrefix, 'acme/en/faq/');
  assert.deepEqual(sections(faq), ['Gift wrap']);
});

test('a page type without a language is applied to the results, with more asked for', async () => {
  const o = world();
  const r = await mk(o).search('refunds', 2, { pageType: 'faq' });
  assert.equal(o.ragCalls[0].filter?.titlePrefix, 'acme/');
  assert.equal(o.ragCalls[0].limit, 10);
  assert.deepEqual(sections(r), ['Gift wrap']);
});

test('a section narrows through the ids of the passages under it (exact, before the limit)', async () => {
  const o = world();
  const r = await mk(o).search('refunds parcel', 5, { section: 'exchang' });
  assert.deepEqual(sections(r), ['Exchanges']);
  assert.deepEqual(o.ragCalls[0].filter?.documentIds, ['doc-1']);
  assert.deepEqual(await mk(o).search('refunds', 5, { section: 'nonexistent' }), []);
});

test('a section too broad for an id list falls back to checking the results', async () => {
  const o = world();
  const r = await mk(o, { maxSectionIds: 1 }).search('refunds', 5, { section: 'e' }); // matches 3 of acme's sections
  assert.equal(o.ragCalls[0].filter?.documentIds, undefined);
  assert.ok(r.length >= 1 && r.every(p => p.section!.toLowerCase().includes('e')));
});

test('a filter never returns a passage outside it (every combination)', async () => {
  const o = world();
  const r = mk(o);
  for (const language of [undefined, 'en', 'fr', 'de']) for (const pageType of [undefined, 'policy', 'faq', 'blog']) for (const section of [undefined, 'refund', 'wrap']) {
    for (const p of await r.search('refunds remboursements wrap exchanges', 10, { language, pageType, section })) {
      assert.ok(!language || p.language === language, 'language');
      assert.ok(!pageType || p.pageType === pageType, 'page type');
      assert.ok(!section || p.section!.toLowerCase().includes(section), 'section');
      assert.ok(p.id.startsWith('acme/'), 'business');
    }
  }
});

test("another business's passages never come back, even if Octo ignores the prefix", async () => {
  const o = world();
  o.leaky = true;
  const r = await mk(o).search('refunds manager signature thirty', 10);
  assert.ok(r.every(p => p.id.startsWith('acme/')));
  assert.ok(!r.some(p => /Globex/.test(p.text)));
});

test('filter values are checked: odd page types and languages are dropped, section is a parameter', async () => {
  assert.deepEqual(cleanFilter({ language: "en/../globex", pageType: "faq' or 1=1", section: '  Refunds  ' }), { section: 'Refunds' });
  assert.deepEqual(cleanFilter({ language: ' EN ', pageType: 'Policy' }), { language: 'en', pageType: 'policy' });
  const o = world();
  await mk(o).search('refunds', 5, { section: "x'; drop table site_passages; --" });
  assert.ok(o.sqlCalls[0].params.includes("%x'; drop table site\\_passages; --%"));
  assert.ok(!o.sqlCalls[0].text.includes('drop'));
  assert.equal(o.db.prepare('select count(*) n from site_passages').get()!.n, 5);
  // % and _ in a section are literal
  assert.deepEqual(await mk(o).search('refunds', 5, { section: '%' }), []);
  assert.throws(() => new SiteRetriever({ octo: o, business: 'ac/me' }));
});

test('a search document with no table row is not cited', async () => {
  const o = world();
  o.docs.push({ documentId: 'orphan', title: 'acme/en/policy/orphan', content: 'refunds refunds refunds orphan' });
  const r = await mk(o).search('refunds', 10);
  assert.ok(!r.some(p => p.id.endsWith('orphan')));
});

test('OctoHttp sends the workspace, the bearer key and the body', async () => {
  const seen: { path?: string; auth?: string; body?: any }[] = [];
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', c => { b += c; });
    req.on('end', () => { seen.push({ path: req.url, auth: req.headers.authorization, body: JSON.parse(b) }); res.setHeader('content-type', 'application/json'); res.end('{"matches":[],"rows":[]}'); });
  });
  await new Promise<void>(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(srv.address() as any).port}/api`;
  const c = new OctoHttp({ base, key: 'k1', workspaceId: 'w1' });
  await c.rag({ query: 'x', limit: 2 });
  await c.sql('select 1', [7]);
  srv.close();
  assert.deepEqual(seen.map(s => s.path), ['/api/rag/query', '/api/workspaces/w1/query']);
  assert.equal(seen[0].auth, 'Bearer k1');
  assert.deepEqual(seen[0].body, { workspaceId: 'w1', query: 'x', limit: 2 });
  assert.deepEqual(seen[1].body, { sql: 'select 1', params: [7] });
});
