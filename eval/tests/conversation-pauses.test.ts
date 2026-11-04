// The owner's second call (session 75aeb0b4, 2026-11-01 23:27-23:29 UTC) replayed through the conversation code: a thinking
// pause that splits a question, the same refusal three times, a tied passage refused, a rewrite that lost the date words.
// Search results are the ones the live system returned (eval/tests/fixtures/call-75aeb0b4.json); Jev's answers are replayed
// as probabilities through the real pickRule. No model is asked anything.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { Dialogue, isFragment, ownQuestion, stripFillers, WAIT_SET } from '../../copilot-engine/src/dialogue.ts';
import { Guide, pickRule, shortQuote, type Judge, type Passage } from '../../copilot-engine/src/guide.ts';

type Span = { name: string; attributes: Record<string, any> };
const spans: Span[] = JSON.parse(fs.readFileSync(new URL('./fixtures/call-75aeb0b4.json', import.meta.url), 'utf8'));
const recorded = new Map<string, Passage[]>();
for (const s of spans.filter(s => s.name === 'search')) {
  const ps: Passage[] = [];
  for (let i = 0; i < 6; i++) {
    const id = s.attributes[`retrieval.documents.${i}.document.id`], text = s.attributes[`retrieval.documents.${i}.document.content`];
    if (id && text) ps.push({ id, text, cite: { title: `IRS source ${id.slice(0, 4)}`, url: '#' } });
  }
  recorded.set(s.attributes['input.value'], ps);
}
const DUE = 'ae129542';
const searches: string[] = [];
// The live index: a search finds the due-date passages when the query names the due date (the probes of 2026-11-01), else what the call recorded.
const retriever = { async search(q: string): Promise<Passage[]> {
  searches.push(q);
  if (/due date to file federal income tax return/.test(q)) return recorded.get('when should I What month do I file taxes up to?')!;
  return recorded.get(q) ?? recorded.get(q.replace(/ for each year\?$/, '?').replace(/\?$/, '').replace(/^/, '') + '?') ?? [];
} };
const TIE = { none: 0.35, p0: 0.34, p1: 0.26, p2: 0.03, p3: 0.02 };
const judge: Judge = {
  lastProbs: undefined as Record<string, number> | undefined, lastRule: undefined as string | undefined,
  async pick(_q, ps) {
    const i = ps.findIndex(p => p.id.startsWith(DUE));
    this.lastProbs = i < 0 ? { none: 0.48, p0: 0.3 } : TIE;
    this.lastRule = i < 0 ? 'none' : pickRule(TIE, i);
    return i >= 0 ? ps[i].id : '';
  },
  async sentences() { return [0]; }, // Jev's sentence pick: the first sentence of the due-date passage
};
const book = { id: 'irs', title: 'the tax guides', business: 'Brindlewick', steps: [], passages: [], unknown: "I don't know. I couldn't find that in the tax guides I answer from, and I only answer from them. A preparer can look into it with you at a consultation." };
const UNKNOWN = book.unknown;

// The widget's turn for a question the desk model chose to look up (demo/live-site/widget/sdk.ts, answerFor).
function site() {
  const dlg = new Dialogue({ book: { text: 'Book a consultation', href: '/tax/book' } });
  const guide = new Guide(book, retriever, judge);
  return { dlg, guide, lookup: async (said: string, modelQ: string): Promise<string> => {
    const q = dlg.resolve(modelQ);
    const ask = dlg.clarify(q);
    if (ask) return ask;
    guide.also = ownQuestion(said);
    const reply = await guide.lookup(q);
    if (!guide.last) {
      const near = guide.lastNearest;
      return dlg.refusal(q, near && { src: near.cite?.title.split(', ')[0] ?? 'the guides', quote: shortQuote(near.text, q) }) ?? reply;
    }
    const quote = reply.slice(reply.indexOf('says: ') + 6);
    dlg.note(q, 'IRS Tax Topic 301', quote);
    return dlg.phrase({ src: 'IRS Tax Topic 301', where: '', quote, found: true, repeated: guide.lastRepeat, question: q, closest: guide.lastClosest });
  } };
}

test('1. leading fillers are not part of the question, and "what happens?" is never searched alone', () => {
  const said = "Hmm. Uh can you consult on Filing taxes, what happens? Like, what's the best month to file taxes?";
  assert.equal(stripFillers(said), 'can you consult on Filing taxes, what happens? Like, what\'s the best month to file taxes?');
  assert.equal(ownQuestion(said), "what's the best month to file taxes?");
  assert.equal(new Dialogue().before('Hmm.')?.reply, '', '"Hmm." alone is not a turn');
  assert.equal(new Dialogue().before('Um, uh…')?.reply, '');
});

test('1. "For each year" after a question is part of that question and is not searched alone', async () => {
  const s = site();
  await s.lookup("What's the best month to file taxes?", 'What is the best month to file taxes?');
  assert.deepEqual(new Dialogue().before('For each year'), null, 'with nothing before it, it goes to the desk');
  const joined = s.dlg.before('For each year');
  assert.equal(joined?.ask, 'What is the best month to file taxes for each year?');
  // and the model's own rewrite of it ("For each year?") is joined the same way
  const s2 = site();
  await s2.lookup("What's the best month to file taxes?", 'What is the best month to file taxes?');
  searches.length = 0;
  await s2.lookup('For each year', 'For each year?');
  assert.ok(searches.every(q => /best month to file taxes for each year/.test(q)), `searched: ${searches.join(' | ')}`);
  assert.ok(searches.every(q => !/^For each year/.test(q)));
});

test('what a fragment is: under four words, no question word, no verb', () => {
  for (const f of ['For each year', 'in March', 'April 15', 'for 2024']) assert.ok(isFragment(f), f);
  for (const f of ['What is the deadline', 'file my taxes', 'Yeah', 'no', 'I want to file taxes', 'How much', 'Can I']) assert.ok(!isFragment(f), f);
});

test('3. the tied due-date passage is quoted and called the closest, not refused (turn 1)', async () => {
  const s = site();
  const r = await s.lookup("Hmm. Uh can you consult on Filing taxes, what happens? Like, what's the best month to file taxes?", 'What is the best month to file taxes?');
  assert.notEqual(r, UNKNOWN);
  assert.match(r, /The closest I have to that is IRS Tax Topic 301/);
  assert.match(r, /due date for filing your federal individual income tax return/);
  assert.match(r, /may not answer exactly what you asked/);
  assert.equal(s.guide.lastClosest, true);
});

test('4. "What is the filing deadline for my return?" finds the due-date passage through the date words and the visitor\'s own words', async () => {
  const s = site();
  const said = 'I asked when should I What month do I file taxes up to? What\'s the deadline?';
  const r = await s.lookup(said, 'What is the filing deadline for my return?');
  assert.notEqual(r, UNKNOWN);
  assert.match(r, /due date for filing your federal individual income tax return/);
  assert.ok(searches.some(q => q.startsWith('What is the filing deadline for my return? due date')), 'the rewrite is searched with the date words spelled out');
  assert.ok(searches.some(q => q.includes('What month do I file taxes up to?') && q.includes('due date to file')), 'and so are the visitor\'s own words');
});

test('2. the refusal is never the same line twice in a row, and the third thing it does is not "I don\'t know" again', async () => {
  const s = site();
  const none = new Guide(book, { async search() { return recorded.get('what happens?')!; } }, { async pick() { return ''; } });
  const say = async (q: string) => {
    const reply = await none.lookup(q);
    const near = none.lastNearest;
    return s.dlg.refusal(q, near && { src: 'IRS Pub 969', quote: shortQuote(near.text, q) }) ?? reply;
  };
  const replies = [await say('what happens?'), await say('For each year?'), await say('what happens next?'), await say('and then?')];
  assert.equal(replies[0], UNKNOWN, 'the first refusal is the plain one');
  for (let i = 1; i < replies.length; i++) {
    assert.notEqual(replies[i], replies[i - 1], `reply ${i + 1} repeats reply ${i}`);
    assert.notEqual(replies[i], UNKNOWN, `reply ${i + 1} is the plain refusal again`);
  }
  assert.match(replies[1], /closest thing in the guides is IRS Pub 969/);
  assert.match(replies[2], /tell me the form, the year/);
  assert.match(replies[3], /preparer can look into it with you/);
});

test('an answer resets the refusals: the next refusal is the plain one again', async () => {
  const s = site();
  s.dlg.refusal('x?');
  assert.notEqual(s.dlg.refusal('y?'), null);
  s.dlg.phrase({ src: 'IRS', where: '', quote: '"q"', found: true, repeated: false, question: 'z?' });
  assert.equal(s.dlg.refusal('w?'), null);
});

test('6. the waiting line is never the one before it, names the topic when it is known, and the voice server makes every line ahead', () => {
  const d = new Dialogue();
  let last = '';
  for (let i = 0; i < 60; i++) { const l = d.waitLine(i % 2 ? 'What is the filing deadline for my return?' : 'Tell me about trusts'); assert.notEqual(l, last); last = l; assert.ok(WAIT_SET.includes(l), l); }
  const topic = new Set(Array.from({ length: 80 }, () => new Dialogue().waitLine('What is the filing deadline for my return?')));
  assert.ok(topic.has('Let me look up the filing deadline.'), 'a topic line is among the choices');
  const server = fs.readFileSync(new URL('../../demo/live-site/speech/server.py', import.meta.url), 'utf8');
  const missing = WAIT_SET.filter(l => !server.includes(`'${l}'`) && !server.includes(`"${l}"`));
  assert.deepEqual(missing, [], `speech/server.py COMMON does not make: ${missing.join(' | ')}`);
  assert.ok(WAIT_SET.every(l => !/found|got it|here it is/i.test(l)), 'a waiting line never claims a result');
});
