// The 2026-11-01 call (session 7d689fcd) replayed through the new conversation code: the Dialogue, the Guide and the
// judge rule, on the search results the live system returned (eval/tests/fixtures/call-7d689fcd.json). The models are not
// asked anything: the question the desk model chose to look up is the one it chose in the call, and Jev's pick is
// replayed as probabilities through the real pickRule. This is the widget's turn order (demo/live-site/widget/sdk.ts),
// minus the page: before(), then clarify() on the model's lookup, then the Guide, then phrase().
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { Dialogue, type Offer } from '../../copilot-engine/src/dialogue.ts';
import { Guide, pickRule, type Judge, type Passage } from '../../copilot-engine/src/guide.ts';
import { isUnknown, OFFERS } from '../lib/rules.ts';

type Span = { name: string; start_time: string; attributes: Record<string, any> };
const spans: Span[] = (JSON.parse(fs.readFileSync(new URL('./fixtures/call-7d689fcd.json', import.meta.url), 'utf8')) as Span[]).sort((a, b) => a.start_time.localeCompare(b.start_time));
const TITLES: Record<string, string> = { '6334042d': 'irs/publications-p570 #347' }; // the search span keeps ids and text; this one's document is Publication 570 (US possessions)
const searches = new Map<string, Passage[]>();
for (const s of spans.filter(s => s.name === 'search')) {
  const ps: Passage[] = [];
  for (let i = 0; i < 6; i++) {
    const id = s.attributes[`retrieval.documents.${i}.document.id`], text = s.attributes[`retrieval.documents.${i}.document.content`];
    if (id && text) ps.push({ id, text, title: TITLES[id.slice(0, 8)] ?? `irs/recorded #${i}`, cite: { title: `IRS ${TITLES[id.slice(0, 8)] ? 'Pub 570' : 'FAQ'}, ${text.slice(0, 40)}`, url: '#' } });
  }
  searches.set(s.attributes['input.value'], ps);
}
const find = (q: string) => searches.get(q) ?? assert.fail(`no recorded search for ${q}`);

// Jev, replayed: per lookup question, which passage it favoured and how sure it was.
const JEV: Record<string, { pick: string; p: number; none: number }> = {
  'How long does it take to find the amount you owe the irs?': { pick: '435750e3', p: 0.9, none: 0.05 },
  'How do I find the amount I owe the IRS?': { pick: '435750e3', p: 0.9, none: 0.05 },
  'How do I file my tax return?': { pick: 'b8590d3c', p: 0.8, none: 0.1 },
  'How do I fill out Form 1040?': { pick: '1f6b0e5c', p: 0.9, none: 0.05 },
  'Can I file my tax return from here?': { pick: 'b8590d3c', p: 0.70, none: 0.26 }, // verified by replaying the call to typesafe/jev-1.14
  'Is there a form to start filing my tax return?': { pick: '6334042d', p: 0.9, none: 0.05 },
};
const shown: string[][] = [];
const judge: Judge = {
  lastProbs: undefined as Record<string, number> | undefined,
  async pick(q, ps) {
    shown.push(ps.map(p => p.id.slice(0, 8)));
    const j = JEV[q] ?? assert.fail(`no recorded judge for ${q}`);
    const i = ps.findIndex(p => p.id.startsWith(j.pick));
    this.lastProbs = i < 0 ? { none: 0.9 } : { none: j.none, [`p${i}`]: j.p };
    return i >= 0 && pickRule(this.lastProbs, i) !== 'none' ? ps[i].id : '';
  },
};

const offers: Offer[] = [{ when: 'how (do|can|should|to)\\b.*\\b(file|fill|prepare|e-?file|start)\\b|can (i|we)\\b.*\\b(file|e-?file|prepare)\\b', href: '/tax/start', label: 'the new-client form',
  say: "I can't file it for you on this page, but I can open the new-client form and go through it with you, so a preparer takes it from there. Want me to?" }];

// One call: what the visitor said, and (when the desk model called answer_question) the question it chose.
function site() {
  const dlg = new Dialogue({ offers, book: { text: 'Book a consultation', href: '/tax/book' } });
  let recorded = '';
  const guide = new Guide({ id: 'irs', title: 'the tax guides', business: 'Brindlewick', steps: [], passages: [], unknown: "I don't know. I couldn't find that in the tax guides." },
    { async search(q) { return find(recorded || q); } }, judge);
  const lookup = async (q: string, searchKey: string): Promise<string> => {
    const c = dlg.clarify(q);
    if (c) return c;
    recorded = searchKey;
    const reply = await guide.lookup(q);
    if (!guide.last) return reply;
    const quote = reply.slice(reply.indexOf('says: ') + 6);
    dlg.note(q, 'IRS source', quote);
    return dlg.phrase({ src: guide.last.cite!.title.split(', ')[0], where: '', quote, found: true, repeated: guide.lastRepeat, question: q });
  };
  return { dlg, guide, turn: async (said: string, modelQ?: string, searchKey = modelQ ?? said): Promise<{ reply: string; go?: string; model?: boolean }> => {
    const t = dlg.before(said);
    if (t?.ask) return { reply: await lookup(t.ask, searchKey) };
    if (t) return { reply: t.reply ?? '', go: t.go };
    if (!modelQ) return { reply: '', model: true }; // the desk model answers this one itself
    return { reply: await lookup(modelQ, searchKey) };
  } };
}
const questions = (s: string) => (s.replace(/"[^"]*"/g, '').match(/\?/g) ?? []).length;

test('turn 1: "How do I find my taxes?" is asked back, not answered with the Publication 970 line', async () => {
  const { turn } = site();
  const r = await turn('How do I find my taxes?', 'How do I find my taxes?');
  assert.equal(questions(r.reply), 1);
  assert.doesNotMatch(r.reply, /breakdown by tax year|IRS/);
  assert.ok(!isUnknown(r.reply));
});

test('turns 1-3: the visitor says what they meant, then "Yeah." and "Is it gonna take long?" refer to that topic', async () => {
  const s = site();
  await s.turn('How do I find my taxes?', 'How do I find my taxes?');
  const a = await s.turn('What I owe', undefined, 'How do I find my taxes?');
  assert.match(a.reply, /Publication 970|IRS Pub 970|IRS FAQ/);
  assert.match(a.reply, /View the amount you owe/);
  const yeah = await s.turn('Yeah.');
  assert.ok(!OFFERS.some(r => r.test(yeah.reply)), yeah.reply);
  assert.doesNotMatch(yeah.reply, /verif/i);
  const long = await s.turn('Is it gonna take long?');
  assert.match(long.reply, /how long it takes to find the amount you owe the irs/i);
  assert.doesNotMatch(long.reply, /verif|great question/i);
  assert.equal(questions(long.reply), 1);
});

test('turn 4: "Can I file my tax return from here?" is answered from the FAQ passage Jev picked at 0.70, not "I don\'t know"', async () => {
  const { turn, guide } = site();
  const r = await turn('You guide me how to file it. Can I file it from here?', 'Can I file my tax return from here?');
  assert.ok(!isUnknown(r.reply));
  assert.match(r.reply, /Yes, you can file an original Form 1040 series tax return electronically/);
  assert.equal(guide.last?.id.slice(0, 8), 'b8590d3c');
});

test('turn 5: the answer offers the new-client form, and a yes opens it', async () => {
  const s = site();
  const r = await s.turn('You guide me how to file it. Can I file it from here?', 'Can I file my tax return from here?');
  assert.match(r.reply, /new-client form/);
  assert.equal(questions(r.reply), 1, 'one follow-up');
  const yes = await s.turn('Yeah, go ahead');
  assert.equal(yes.go, '/tax/start');
});

test('turns 4 and 6: Publication 570, written for US possessions, is not offered to the judge for a general filing question', async () => {
  shown.length = 0;
  const { turn, guide } = site();
  const r = await turn('So how do I file it?', 'How do I file my tax return?');
  assert.ok(shown.flat().length > 0 && shown.flat().every(id => id !== '6334042d'), `the judge saw ${shown.flat()}`);
  assert.notEqual(guide.last?.id.slice(0, 8), '6334042d');
  assert.doesNotMatch(r.reply, /Pub 570/);
});

test('the same passage for a different question says so instead of repeating the quote', async () => {
  const s = site();
  await s.turn('So how do I file it?', 'How do I file my tax return?');
  // Jev favours the same FAQ passage for a rephrased question and there is no other candidate in the results
  const again = await s.turn('Can I file it from here?', 'Can I file my tax return from here?', 'How do I file my tax return?');
  assert.match(again.reply, /same part of IRS FAQ I showed you before/);
  assert.doesNotMatch(again.reply, /Yes, you can file an original/);
});

test('"Yeah" to "do you mean how long it takes…?" looks that up; it does not start a flow', async () => {
  const s = site();
  await s.turn('How do I find my taxes?', 'How do I find my taxes?');
  await s.turn('What I owe', undefined, 'How do I find my taxes?');
  await s.turn('Is it gonna take long?');
  const r = await s.turn('Yeah', undefined, 'How do I find my taxes?');
  // the search finds the same passage again: the reply says so instead of quoting it a second time
  assert.match(r.reply, /same part of IRS FAQ I showed you before/);
  assert.ok(!OFFERS.some(re => re.test(r.reply)), r.reply);
});

test('the replayed call has no invented offer anywhere in the code-written replies', async () => {
  const s = site();
  const replies = [
    (await s.turn('How do I find my taxes?', 'How do I find my taxes?')).reply,
    (await s.turn('What I owe', undefined, 'How do I find my taxes?')).reply,
    (await s.turn('Yeah.')).reply,
    (await s.turn('Is it gonna take long?')).reply,
  ];
  for (const r of replies) assert.ok(!OFFERS.some(re => re.test(r)), r);
});

test('on the eval sets the rules alone ask back at least 25 of 100 vague questions and at most 3 of 200 clear ones (before the judge\'s split check)', () => {
  const sets = JSON.parse(fs.readFileSync(new URL('../out/irs/sets.json', import.meta.url), 'utf8')).sets;
  const asked = (kind: string) => (sets[kind] as { turns: string[] }[]).filter(x => new Dialogue().clarify(x.turns[0])).length;
  assert.ok(asked('vague') >= 25, `asked back ${asked('vague')} of 100 vague questions`);
  assert.ok(asked('casual') + asked('chain') <= 3, `asked back ${asked('casual') + asked('chain')} of 200 clear questions`);
  assert.equal(asked('unanswerable'), 0);
});
