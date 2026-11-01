// The passage-pick rule and what the Guide does around it: the right answer is kept when Jev's own pick clearly beats
// "none" (call 7d689fcd, turn 4), Jev's probabilities and errors are reported, a guide for a narrow audience is not the
// general answer, and the same passage is not passed off as a new answer.
import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { Guide, JevJudge, isNiche, pickRule, withoutNiche, type Judge, type Passage, type Retriever } from '../src/guide.ts';

// The four passages the live search returned for "Can I file my tax return from here?", and Jev's answer replayed on them
// (typesafe/jev-1.14: p0 0.70, none 0.26).
const FAQ = 'Yes, you can file an original Form 1040 series tax return electronically using any filing status. Filing your return electronically is faster, safer, and more accurate than filing a paper return.';
const four: Passage[] = [
  { id: 'b8590d3c', text: FAQ, title: 'irs/faqs-electronic-filing-e-file-q3 #0' },
  { id: '238112ad', text: 'You may want to file your return electronically instead of mailing it, to receive your refund faster.', title: 'irs/taxtopics-tc301 #7' },
  { id: 'f8abe0cd', text: 'Free options for tax preparation. Your options for preparing and filing your return online or in your local community, if you qualify, include the following.', title: 'irs/taxtopics-tc872 #1' },
  { id: 'dd8cd173', text: 'If your legal residence or principal place of business is outside the United States, use the following address.', title: 'irs/instructions-i1040gi #2' },
];
const live = { none: 0.26, p0: 0.70, p1: 0.02, p2: 0.01, p3: 0.01 };

test('a pick that clearly beats "none" stands; a thin or off-topic one does not', () => {
  assert.equal(pickRule(live, 0), 'ahead');
  assert.equal(pickRule({ none: 0.05, p0: 0.9 }, 0), 'sure');
  assert.equal(pickRule({ none: 0.25, p0: 0.7 }, 0), 'sure', 'the original gate is unchanged');
  // held-out cases from eval/out/irs/judge-rule.json that must stay "don't know" or unchanged
  assert.equal(pickRule({ none: 0.26, p3: 0.64 }, 3), 'none', 'a made-up answer on an unanswerable question');
  assert.equal(pickRule({ none: 0.29, p2: 0.6 }, 2), 'none');
  assert.equal(pickRule({ none: 0.5, p0: 0.45 }, 0), 'none');
  assert.equal(pickRule({ none: 0.98, p0: 0.01 }, 0), 'none');
  assert.equal(pickRule({}, 0), 'none', 'no probabilities: no pick');
  assert.equal(pickRule(live, -1), 'none', 'Jev chose "none"');
});

// A fake Jev, so the real JevJudge code runs end to end.
async function withJev(reply: (n: number) => { status: number; body: unknown }, fn: (judge: JevJudge, calls: () => number) => Promise<void>) {
  let n = 0;
  const server = http.createServer((req, res) => { req.resume(); req.on('end', () => { const r = reply(n++); res.writeHead(r.status, { 'content-type': 'application/json' }); res.end(JSON.stringify(r.body)); }); });
  await new Promise<void>(ok => server.listen(0, '127.0.0.1', ok));
  try { await fn(new JevJudge({ key: 'test', url: `http://127.0.0.1:${(server.address() as { port: number }).port}/` }), () => n); } finally { server.close(); }
}
const answer = (probabilities: Record<string, number>, choice: string) => ({ status: 200, body: { answers: { source: { choice, probabilities } }, usage: { cost: 0 } } });

test('JevJudge keeps the 0.70 vs 0.26 pick and reports the probabilities and the rule (turn 4)', async () => {
  await withJev(() => answer(live, 'p0'), async j => {
    const r = await j.choose('Can I file my tax return from here?', four);
    assert.equal(r.id, 'b8590d3c');
    assert.equal(r.rule, 'ahead');
    assert.equal(r.probs.none, 0.26);
    assert.equal(r.error, '');
    assert.equal(await j.pick('Can I file my tax return from here?', four), 'b8590d3c');
  });
});

test('a Jev failure is an error with its reason, not a quiet "none"', async () => {
  await withJev(() => ({ status: 403, body: {} }), async j => {
    const r = await j.choose('Can I file my tax return from here?', four);
    assert.equal(r.id, '');
    assert.equal(r.rule, 'error');
    assert.equal(r.error, 'jev 403');
    assert.equal(j.lastError, 'jev 403');
  });
  await withJev(() => ({ status: 200, body: 'not an object' }), async j => {
    assert.equal((await j.choose('q', four)).rule === 'error' || (await j.choose('q', four)).id === '', true);
  });
});

test('Guide answers "Can I file my tax return from here?" from the passage Jev picked instead of "I don\'t know"', async () => {
  await withJev(() => answer(live, 'p0'), async j => {
    const retriever: Retriever = { async search() { return four; } };
    const g = new Guide({ id: 'irs', title: 'the tax guides', business: 'Brindlewick', steps: [], passages: [], unknown: "I don't know." }, retriever, j);
    const reply = await g.lookup('Can I file my tax return from here?');
    assert.match(reply, /Yes, you can file an original Form 1040 series tax return electronically/);
    assert.equal(g.last?.id, 'b8590d3c');
  });
});

// ---- narrow-audience guides and repeats ----
const p570: Passage = { id: '6334042d', text: 'If you must file a U.S. income tax return, you may be able to file electronically using IRS.gov/Efile.', title: 'irs/publications-p570 #347' };
const general: Passage = { id: 'b8590d3c', text: FAQ, title: 'irs/faqs-electronic-filing-e-file-q3 #0' };
const book = { id: 'irs', title: 'the tax guides', business: 'Brindlewick', steps: [], passages: [], unknown: "I don't know." };

test('the guide for US possessions is not shown to the judge for a general filing question (turn 4 of the call)', async () => {
  assert.ok(isNiche(p570) && !isNiche(general));
  assert.deepEqual(withoutNiche([p570, general], 'How do I file my tax return?'), [general]);
  assert.deepEqual(withoutNiche([p570, general], 'How do I file in Puerto Rico?'), [p570, general], 'unless the question names that audience');
  assert.deepEqual(withoutNiche([p570], 'How do I file my tax return?'), [p570], 'and it stays when nothing else was found');
  const seen: string[][] = [];
  const judge: Judge = { async pick(_q, ps) { seen.push(ps.map(p => p.id)); return ps[0].id; } };
  const g = new Guide(book, { async search() { return [p570, general]; } }, judge);
  await g.lookup('How do I file my tax return?');
  assert.deepEqual(seen, [['b8590d3c']]);
  assert.equal(g.last?.id, 'b8590d3c');
});

test('the narrow guide is judged after all when nothing general answers', async () => {
  const seen: string[][] = [];
  const judge: Judge = { async pick(_q, ps) { seen.push(ps.map(p => p.id)); return ps.find(p => p.id === '6334042d')?.id ?? ''; } };
  const g = new Guide(book, { async search() { return [p570, general]; } }, judge);
  await g.lookup('How do I e-file?');
  assert.deepEqual(seen, [['b8590d3c'], ['6334042d', 'b8590d3c']]);
  assert.equal(g.last?.id, '6334042d');
});

test('the same passage for a different question is flagged, or swapped for another passage that answers', async () => {
  const other: Passage = { id: '238112ad', text: 'You may want to file your return electronically instead of mailing it.', title: 'irs/taxtopics-tc301 #7' };
  // the judge always prefers `general`, then `other`
  const judge: Judge = { async pick(_q, ps) { return (ps.find(p => p.id === 'b8590d3c') ?? ps[0])?.id ?? ''; } };
  const g = new Guide(book, { async search() { return [general, other]; } }, judge);
  await g.lookup('How do I file my tax return?');
  assert.equal(g.lastRepeat, false);
  await g.lookup('Is there a form to start filing my tax return?');
  assert.equal(g.last?.id, '238112ad', 'another passage that answers is used');
  assert.equal(g.lastRepeat, false);
  // when nothing else is left it is still the same passage, and the guide says so
  const only = new Guide(book, { async search() { return [general]; } }, { async pick(_q, ps) { return ps[0]?.id ?? ''; } });
  await only.lookup('How do I file my tax return?');
  await only.lookup('Is there a form to start filing my tax return?');
  assert.equal(only.last?.id, 'b8590d3c');
  assert.equal(only.lastRepeat, true);
});
