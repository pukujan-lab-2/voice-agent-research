// The judge endpoint keeps the right passage when Jev's pick clearly beats "none" (call 7d689fcd, 17:12:08), and the judge
// span in Phoenix records Jev's probabilities and any error. A fake Jev stands in for typesafe/jev-1.14; the passages are
// signed the way /api/search signs them (SIGNING_SECRET is fixed here), so the real handler code runs.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { test } from 'node:test';
import { createApi } from '../api.ts';
import type { SpanSpec } from '../tracing.ts';

const SECRET = 'test-secret';
const sign = (p: { id: string; text: string }) => crypto.createHmac('sha256', SECRET).update(`${p.id}\n\n${p.text}\n\n\n\n`).digest('hex');
const passage = (id: string, text: string) => ({ id, text, sig: sign({ id, text }) });
const four = [
  passage('b8590d3c', 'Yes, you can file an original Form 1040 series tax return electronically using any filing status.'),
  passage('238112ad', 'You may want to file your return electronically instead of mailing it, to receive your refund faster.'),
  passage('f8abe0cd', 'Free options for tax preparation. Your options for preparing and filing your return online include the following.'),
  passage('dd8cd173', 'If your legal residence is outside the United States, use the following address.'),
];

async function withApi(jev: (n: number) => { status: number; body: unknown }, fn: (post: (body: unknown) => Promise<any>, spans: SpanSpec[]) => Promise<void>) {
  let n = 0;
  const server = http.createServer((req, res) => { req.resume(); req.on('end', () => { const r = jev(n++); res.writeHead(r.status, { 'content-type': 'application/json' }); res.end(JSON.stringify(r.body)); }); });
  await new Promise<void>(ok => server.listen(0, '127.0.0.1', ok));
  const spans: SpanSpec[] = [];
  const api = createApi({ OPENROUTER_JEV_KEY: 'k', OCTO_KEY: 'k', OCTO_WORKSPACE: 'w', OCTO_BASE: 'http://127.0.0.1:9', SIGNING_SECRET: SECRET, RATE_PER_MIN: '1000',
    JEV_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}/` }, { trace: s => { spans.push(s); } });
  try {
    await fn(async body => (await api.handle(new Request('http://x/api/judge', { method: 'POST', body: JSON.stringify(body), headers: { 'x-session-id': 'test-session-1' } }))).json(), spans);
  } finally { server.close(); }
}
const jevSays = (probabilities: Record<string, number>, choice: string) => ({ status: 200, body: { answers: { source: { choice, probabilities } }, usage: { cost: 0 } } });
const settle = () => new Promise(r => setTimeout(r, 50));

test('p0 0.70 against none 0.26 picks the FAQ passage, and the judge span records the probabilities', async () => {
  await withApi(() => jevSays({ none: 0.26, p0: 0.70, p1: 0.02, p2: 0.01, p3: 0.01 }, 'p0'), async (post, spans) => {
    const r = await post({ question: 'Can I file my tax return from here?', passages: four });
    assert.equal(r.id, 'b8590d3c');
    assert.equal(r.rule, 'ahead');
    assert.equal(r.probs.none, 0.26);
    await settle();
    const span = spans.find(s => s.name === 'judge')!;
    assert.equal(span.attributes!['judge.rule'], 'ahead');
    assert.deepEqual(JSON.parse(String(span.attributes!['judge.probabilities'])).p0, 0.70);
    assert.equal(span.attributes!['judge.picked'], 'b8590d3c');
    assert.equal(span.attributes!['judge.error'], undefined);
  });
});

test('a pick that does not clearly beat none is still thrown away, and the span says why', async () => {
  await withApi(() => jevSays({ none: 0.30, p0: 0.60, p1: 0.05, p2: 0.03, p3: 0.02 }, 'p0'), async (post, spans) => {
    const r = await post({ question: 'tax filing rules for married couples in california?', passages: four });
    assert.equal(r.id, '');
    assert.equal(r.rule, 'none');
    await settle();
    assert.equal(spans.find(s => s.name === 'judge')!.attributes!['judge.rule'], 'none');
  });
});

test('a failed Jev call is traced as an error with its reason and the word-overlap fallback, not as "none"', async () => {
  await withApi(() => ({ status: 403, body: { error: 'forbidden' } }), async (post, spans) => {
    const r = await post({ question: 'Can I file my tax return electronically?', passages: four });
    assert.equal(r.error, 'jev 403');
    assert.equal(r.fallback, true);
    assert.equal(r.id, 'b8590d3c', 'the word-overlap judge stands in');
    await settle();
    const a = spans.find(s => s.name === 'judge')!.attributes!;
    assert.equal(a['judge.error'], 'jev 403');
    assert.equal(a['judge.fallback'], 'word overlap');
  });
});
