// The conversation around answers (src/dialogue.ts): vague questions asked back, "yeah" and "is it gonna take long?",
// the wording of an answer with one follow-up, and the form offer. Plain code checks; no model is asked anything.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Dialogue, topicOf, type Offer } from '../src/dialogue.ts';

const newClient: Offer = { when: 'how (do|can|should|to)\\b.*\\b(file|fill|prepare)\\b|can (i|we)\\b.*\\b(file|e-?file)\\b', href: '/tax/start', label: 'the new-client form',
  say: "I can't file it for you on this page, but I can open the new-client form and go through it with you. Want me to?" };
const book = { text: 'Book a consultation', href: '/tax/book' };
const make = () => new Dialogue({ offers: [newClient], book });
const said = (src: string, quote: string, question: string, extra: Partial<Parameters<Dialogue['phrase']>[0]> = {}) =>
  ({ src, where: '', quote, found: true, repeated: false, question, ...extra });
const questions = (s: string) => (s.match(/\?/g) ?? []).length;

test('"How do I find my taxes?" is asked back, with one question, instead of quoted (call 7d689fcd, turn 1)', () => {
  const d = make();
  const ask = d.clarify('How do I find my taxes?');
  assert.ok(ask, 'a clarifying question');
  assert.equal(questions(ask), 1);
  assert.match(ask, /your own tax return.*what you owe.*form/);
});

test('the answer to a clarifying question is looked up as the question the visitor meant', () => {
  const d = make();
  d.clarify('How do I find my taxes?');
  assert.deepEqual(d.before('I mean what I owe'), { ask: 'How do I find the amount I owe the IRS?' });
  assert.equal(d.clarify('How do I find the amount I owe the IRS?'), null, 'the lookup after an answer is not asked back again');
});

test('a free-text answer to a clarifying question is joined to the original; a new question is not taken as the answer', () => {
  const d = make();
  d.clarify('what is the limit?');
  assert.equal(d.before('home office deduction')?.ask, 'what is the limit: home office deduction');
  const e = make();
  e.clarify('How do I find my taxes?');
  assert.equal(e.before('Can I file my tax return from here?')?.ask, undefined, 'a new question is not taken as the answer to ours');
  const f = make();
  f.clarify('How do I find my taxes?');
  assert.equal(f.before('What is the deadline to file an extension for my tax return?'), null, 'goes on to the model as a new question');
});

test('"yeah" to an either-or question asks which one, and keeps waiting for it', () => {
  const d = make();
  d.clarify('How do I find my taxes?');
  assert.equal(d.before('Yeah.')?.reply, 'Which of those do you mean?');
  assert.deepEqual(d.before('the form'), { ask: 'How do I find the right tax form?' });
});

test('questions that name what they are about are not asked back', () => {
  const d = make();
  for (const q of ['Can I file my tax return from here?', 'What goes on line 14 of Form 8615?', 'When is the deadline to file an extension?', 'How do I fill out Form 1040?', 'Where do I report my 1099-A?']) {
    assert.equal(make().clarify(q), null, q);
  }
  assert.equal(d.clarify('what is the standard deduction'), null);
});

test('"Yeah." with nothing open points at the last topic or asks what is meant, and offers nothing (turn 3)', () => {
  const none = make().before('Yeah.')!;
  assert.match(none.reply!, /What would you like to know\?/);
  const d = make();
  d.note('How do I file my tax return?', 'IRS Publication 17', 'q');
  const r = d.before('Yeah.')!.reply!;
  assert.match(r, /file your tax return/);
  assert.doesNotMatch(r, /verif|check on your return|just say the word|proceed/i);
  assert.equal(questions(r), 1);
});

test('"Is it gonna take long?" is tied to the last topic and confirmed before anything is looked up (turn 2)', () => {
  const d = make();
  d.note('How do I file my tax return?', 'IRS Publication 17', 'q');
  const r = d.before('Is it gonna take long?')!;
  assert.match(r.reply!, /how long it takes to file your tax return/);
  assert.doesNotMatch(r.reply!, /verif|great question/i);
  assert.equal(r.ask, undefined);
  assert.deepEqual(d.before('Yeah'), { ask: 'How long does it take to file your tax return?' });
  // with no topic yet there is nothing to tie it to: the model asks what is meant
  assert.equal(make().before('Is it gonna take long?'), null);
});

test('an answer is worded like a person, quotes once, and ends with one follow-up', () => {
  const d = make();
  const out = d.phrase(said('IRS Publication 17', '"Everyone can file Form 1040."', 'What form do I use?', { where: 'page 110' }));
  assert.match(out, /IRS Publication 17, page 110/);
  assert.equal(out.split('Everyone can file Form 1040.').length, 2, 'the quote appears once');
  assert.doesNotMatch(out, /I've opened|The highlighted part says/);
  assert.match(out, /Does that cover it, or should I look at a different part\?$/);
  assert.equal(questions(out), 1);
});

test('the lead-in changes from one answer to the next', () => {
  const d = make();
  const leads = [1, 2, 3].map(i => d.phrase(said('IRS FAQ', `"Quote ${i}."`, `Question ${i}?`)).split(' ').slice(0, 3).join(' '));
  assert.equal(new Set(leads).size, 3);
});

test('a question about doing something offers the site\'s form; yes opens it (turns 4 and 5)', () => {
  const d = make();
  const out = d.phrase(said('IRS FAQ', '"Yes, you can file an original Form 1040 series tax return electronically using any filing status."', 'Can I file my tax return from here?'));
  assert.match(out, /Yes, you can file an original Form 1040/);
  assert.match(out, /new-client form/);
  assert.equal(questions(out), 1, 'one follow-up');
  const go = d.before('Yeah, let\'s do it')!;
  assert.equal(go.go, '/tax/start');
  assert.match(go.reply!, /opening the new-client form/);
});

test('no to the offer drops it; a doing question without a matching form offers a consultation', () => {
  const d = make();
  d.phrase(said('IRS FAQ', '"x"', 'How do I file my tax return?'));
  assert.match(d.before('no thanks')!.reply!, /What else/);
  const e = make();
  const out = e.phrase(said('IRS Pub 17', '"x"', 'How do I request an installment agreement?'));
  assert.match(out, /a preparer can/);
  assert.equal(e.before('yes please')!.go, '/tax/book');
});

test('the same passage for another question says so instead of repeating itself (turn 6)', () => {
  const d = make();
  const out = d.phrase(said('IRS Publication 570', '"If you must file a U.S. income tax return…"', 'Is there a form to start filing my tax return?', { repeated: true }));
  assert.match(out, /same part of IRS Publication 570 I showed you before/);
  assert.doesNotMatch(out, /If you must file/);
});

test('after two answers it can sum up what it found, and says so before it opens a form', () => {
  const d = make();
  d.note('How do I file my tax return?', 'IRS FAQ', 'Yes, you can file electronically.');
  d.note('Can I file it from here?', 'IRS Tax Topic 301', 'You may want to file electronically.');
  assert.match(d.before('can you sum up what we found?')!.reply!, /2 passages.*IRS FAQ and IRS Tax Topic 301/);
  d.phrase(said('IRS FAQ', '"x"', 'How do I file my tax return?'));
  assert.match(d.before('yes')!.reply!, /^Quick recap: .*Okay, opening the new-client form/);
});

test('topicOf strips the question words and turns first person into second', () => {
  assert.equal(topicOf('How do I file my tax return?'), 'file your tax return');
  assert.equal(topicOf('Can I file my tax return from here?'), 'file your tax return');
});

test('a short question with no topic is asked back; one with a topic or a form is not', () => {
  const d = make();
  assert.match(d.clarify('what records do I need?') ?? '', /tell me a bit more/);
  assert.equal(make().clarify('what records do I need for depreciation on my car?'), null, 'long enough to look up');
  assert.equal(make().clarify('How do I file my tax return?'), null);
  assert.equal(make().clarify("What's the limit for my 401k contribution in 2024?"), null);
});

test('two passages nearly as likely to answer a short question: ask which, naming both, then look up the one chosen', () => {
  const a = { id: 'a', text: 'Home office deduction. You can deduct expenses for the part of your home used regularly and exclusively for business.', cite: { title: 'IRS Pub 587, 2. Home Office Deduction', url: '#' } };
  const b = { id: 'b', text: 'Simplified method. Multiply the area by five dollars, up to 300 square feet.', cite: { title: 'IRS Pub 587, 3. Simplified Method', url: '#' } };
  const d = make();
  const ask = d.splitAsk('what is the home office limit?', { a, b })!;
  assert.match(ask, /Are you asking about Home Office Deduction, or Simplified Method\?/);
  assert.equal(questions(ask), 1);
  assert.deepEqual(d.before('the second one'), { ask: 'what is the home office limit: Simplified Method' });
  // a clear question is not split
  assert.equal(make().splitAsk('How much can I deduct for a home office in a rented apartment under the simplified method?', { a, b }), null);
  // and the answer to the split is not asked about again
  const e = make();
  e.splitAsk('what is the home office limit?', { a, b });
  e.before('simplified');
  assert.equal(e.splitAsk('what is the home office limit: Simplified Method', { a, b }), null);
});

test('"Can I file it from here?" is answered with the site\'s form, and a yes opens it (live replay of call 7d689fcd)', () => {
  const d = make();
  const r = d.before('You guide me how to file it. Can I file it from here?')!;
  assert.match(r.reply!, /new-client form/);
  assert.equal(questions(r.reply!), 1);
  assert.equal(d.before('Yeah, go ahead')?.go, '/tax/start');
  // not for a plain question about filing
  assert.equal(make().before('How do I file an extension?'), null);
});

test('a date question gets no booking offer; a how-do-I-do-it question still does (live replay of call 75aeb0b4)', () => {
  const d = make();
  assert.doesNotMatch(d.phrase(said('IRS Topic 301', '"The due date is April 15."', 'What is the best month to file taxes?')), /booking form/);
  assert.doesNotMatch(d.phrase(said('IRS Topic 301', '"The due date is April 15."', 'When should I file my return?')), /booking form/);
  assert.match(make().phrase(said('IRS Pub 17', '"x"', 'How do I request an installment agreement?')), /booking form/);
});

test('a topic the site has a form for is not vague: "can I get a payment plan?" is looked up', () => {
  const pay: Offer = { when: 'payment plan|installment', href: '/tax/payment-plan', label: 'the payment plan request', say: 'I can open the payment plan request. Want me to?' };
  assert.equal(new Dialogue({ offers: [pay] }).clarify('Can I get a payment plan?'), null);
  assert.notEqual(new Dialogue().clarify('Can I get a plan?'), null, 'without a form for it, a short question with no topic is still asked back');
});
