// Code guards of the v2 desk, tested with a scripted stand-in model (no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Desk, clearYes, normalizeName, normalizeSerial, normalizePhone, normalizeEmail, readback, joinSpelled, docsFrom, textToolCalls, type ChatModel, type ToolCall } from '../src/desk.ts';
import { brookside, brooksideDocs } from '../src/flows/brookside.ts';
import { halvorsen } from '../src/flows/halvorsen.ts';

// Each call returns the next scripted answer; a function gets the user's last words.
function stub(script: (said: string) => { content?: string; calls?: ToolCall[] } | 'fail'): ChatModel & { n: number } {
  return {
    name: 'stub', n: 0,
    async chat(messages) {
      this.n++;
      const last = (messages[messages.length - 1].content ?? '').split('\n\n[Form state')[0];
      const r = script(last);
      if (r === 'fail') throw new Error('model down');
      return { content: r.content ?? '', calls: r.calls ?? [], ms: 1, model: 'stub' };
    },
  };
}
const call = (name: string, args: Record<string, unknown> = {}): ToolCall => ({ name, args });

test('nothing is filled without a read-back and a clear yes', async () => {
  const d = new Desk(brookside, { model: stub(s => /yes/i.test(s) ? { calls: [call('confirm_pending')] } : { content: 'Lovely, thank you!', calls: [call('propose_value', { field: 'child_name', value: 'Maya Chen' }), call('confirm_pending')] }) });
  d.start();
  const r1 = await d.turn("it's Maya Chen");
  assert.equal(d.values.child_name, undefined, 'confirm in the same turn as the proposal must be refused');
  assert.match(r1, /M-A-Y-A, C-H-E-N/);
  assert.equal(d.pending?.value, 'Maya Chen');
  const r2 = await d.turn('yes');
  assert.equal(d.values.child_name, 'Maya Chen');
  assert.ok(r1.includes(d.fills[0].readback));
  assert.match(r2, /well-child checkup, a sick visit, or a vaccination/);
});

test('a hedged or conditional yes is not a yes', async () => {
  for (const said of ['yes but change the time', 'hmm maybe', 'yeah, wait', 'yes, actually no', 'yes?', 'I guess', 'sure, how much is it?', 'right, except the last name']) {
    assert.equal(clearYes(said), false, said);
    const d = new Desk(brookside, { model: stub(() => ({ calls: [call('confirm_pending')] })) });
    d.start();
    d.pending = { field: 'child_name', value: 'Maya Chen', text: readback(brookside.fields[0], 'Maya Chen') };
    await d.turn(said);
    assert.equal(d.values.child_name, undefined, said);
  }
  for (const said of ['yes', 'Yep, that is right', "that's correct", 'yes, and my number is 555 123 4567', 'perfect', 'mm-hmm', "Yeah, that's right. Can we speed this up?"]) assert.equal(clearYes(said), true, said);
});

test('an invalid serial gets a specific problem, not a repeat of the question', async () => {
  const d = new Desk(halvorsen, { model: stub(() => ({ calls: [call('propose_value', { field: 'serial', value: 'LS 5734SSTD' })] })) });
  d.start(); d.current = 'serial';
  const r = await d.turn('LS 5734SSTD');
  assert.match(r, /10 characters/);
  assert.match(r, /12/);
  assert.match(r, /1334-592C-LSD3/);
  assert.equal(d.pending, null);
  assert.equal(normalizeSerial('one three three four five nine two C L S D three').value, '1334592CLSD3');
});

test('names: doubled by speech recognition, spelled letter by letter', () => {
  assert.equal(normalizeName('Pooja Bajracharya PUJANBAJRACHARYA').value, 'Pooja Bajracharya');
  assert.equal(normalizeName('Pooja Pooja Bajracharya').value, 'Pooja Bajracharya');
  assert.equal(normalizeName('pooja bajracharya pooja bajracharya').value, 'Pooja Bajracharya');
  assert.equal(normalizeName('P O O J A Bajracharya').value, 'Pooja Bajracharya');
  assert.equal(normalizeName("my name is mary o'brien").value, "Mary O'Brien");
  assert.equal(joinSpelled('pee oh oh jay ay'), 'pooja');
  assert.equal(joinSpelled('K-I-M'), 'kim');
  assert.ok(normalizeName('Maya').problem, 'a full name is needed');
  assert.equal(normalizePhone('five five five, one two three, four five six seven').value, '555-123-4567');
  assert.equal(normalizeEmail('maya dot chen at gmail dot com').value, 'maya.chen@gmail.com');
  assert.match(readback(brookside.fields[5], '555-123-4567'), /5 5 5, 1 2 3, 4 5 6 7/);
  assert.equal(readback(brookside.fields[0], 'Maya Chen', 0, true), 'Maya Chen, M-A-Y-A, C-H-E-N, right?');
  assert.match(readback(brookside.fields[6], 'maya.chen@gmail.com', 1, true), /^maya\.chen@gmail\.com, M-A-Y-A dot C-H-E-N, at gmail dot com, right\?$/);
});

test('model text cannot state facts or claim saving; questions go to the docs', async () => {
  const d = new Desk(brookside, { model: stub(s => /hours/.test(s) ? { content: "We're open 9 to 5 every day." } : /parking/.test(s) ? { calls: [call('answer_question', { question: 'is there parking?' })] } : { calls: [call('answer_question', { question: s })] }), docs: docsFrom(brooksideDocs) });
  d.start();
  const r1 = await d.turn('what are your hours?');
  assert.doesNotMatch(r1, /9 to 5/);
  const r2 = await d.turn('is there parking?');
  assert.match(r2, /parking/i);
  assert.match(r2, /child's full name/);
  const r3 = await d.turn('who won the football game last night?');
  assert.match(r3, /don't have that information/);
});

test('a value nobody said is not proposed', async () => {
  const d = new Desk(brookside, { model: stub(() => ({ calls: [call('propose_value', { field: 'child_name', value: 'Sarah Johnson' })] })) });
  d.start();
  await d.turn('my kid, she is three');
  assert.equal(d.pending, null);
});

test('go back to an earlier field, fix it, and return', async () => {
  let step = 0;
  const d = new Desk(brookside, { model: stub(() => {
    step++;
    if (step === 1) return { calls: [call('propose_value', { field: 'child_name', value: 'Maya Maya Chen' })] };
    if (step === 2) return { calls: [call('confirm_pending')] };
    if (step === 3) return { calls: [call('go_to_field', { field: 'child_name' })] };
    if (step === 4) return { calls: [call('propose_value', { field: 'child_name', value: 'Maia Chen' })] };
    return { calls: [call('confirm_pending')] };
  }) });
  d.start();
  await d.turn('Maya Maya Chen');
  assert.equal(d.pending?.value, 'Maya Chen');
  await d.turn('yes');
  assert.equal(d.current, 'visit_type');
  const r = await d.turn('go back to the name please');
  assert.match(r, /Maya Chen/);
  await d.turn('M A I A Chen');
  await d.turn('yes');
  assert.equal(d.values.child_name, 'Maia Chen');
  assert.equal(d.current, 'visit_type');
});

test('going back and giving the same value again keeps it and moves on', async () => {
  let step = 0;
  const d = new Desk(halvorsen, { model: stub(() => {
    step++;
    if (step === 1) return { calls: [call('go_to_field', { field: 'serial' })] };
    if (step === 2) return { calls: [call('propose_value', { field: 'serial', value: 'ZC61P6ZAERQ1' })] };
    return { content: 'Sure.' };
  }) });
  d.start();
  d.values = { name: 'Elena Tanaka', serial: 'ZC61P6ZAERQ1', problem: 'cloudy dishes' };
  d.current = 'visit_time';
  await d.turn('wait, can we go back to the serial number?');
  assert.equal(d.current, 'serial');
  const r = await d.turn('Z C 6 1 P 6 Z A E R Q 1, that is the correct one, leave it as is');
  assert.equal(d.current, 'visit_time');
  assert.match(r, /keep the serial/i);
  assert.doesNotMatch(r, /serial number on the inside/);
  d.current = 'serial';
  const r2 = await d.turn("yes that's the same, move on");
  assert.equal(d.current, 'visit_time');
  assert.doesNotMatch(r2, /serial number on the inside/);
});

test('a miscopied value is replaced by what the customer actually said; a question with an answer gets answered', async () => {
  const d = new Desk(halvorsen, { model: stub(() => ({ calls: [call('propose_value', { field: 'serial', value: 'Q4NBBRDTRDF5' })] })) });
  d.start(); d.current = 'serial';
  await d.turn("Okay let me see here, it's Q-4-N-B-B-R-D-T-D-R-F-5. I had to squint at it a little bit.");
  assert.equal(d.pending?.value, 'Q4NBBRDTDRF5');
  assert.equal(clearYes("Yes, that's it, finally! Sorry about all that, I was starting to lose my mind a little."), true);
  assert.equal(clearYes('sorry, I meant B not D'), false);
  const c = new Desk(brookside, { model: stub(() => ({ calls: [call('propose_value', { field: 'child_name', value: 'Maya Chen' })] })), docs: docsFrom(brooksideDocs) });
  c.start();
  const r = await c.turn("It's Maya Chen. Real quick, is there parking?");
  assert.match(r, /parking/i);
  assert.match(r, /M-A-Y-A/);
});

test('a clear yes fills the read-back even when a small model re-proposes instead of confirming', async () => {
  const d = new Desk(brookside, { model: stub(() => ({ content: 'I need to fill parent_name next.', calls: [call('propose_value', { field: 'phone', value: '638-387-0553' })] })) });
  d.start(); d.current = 'phone';
  await d.turn('638 387 0553');
  const r = await d.turn("Yep, that's right.");
  assert.equal(d.values.phone, '638-387-0553');
  assert.doesNotMatch(r, /parent_name|fill/);
  assert.ok(normalizeName("Yep that's right").problem);
});

test('a yes counts only for the read-back the agent just said, not for an older one still waiting', async () => {
  const d = new Desk(brookside, { model: stub(() => ({ calls: [call('confirm_pending')] })) });
  d.start(); d.current = 'preferred_day';
  d.pending = { field: 'preferred_day', value: 'Friday', text: readback(brookside.fields[2], 'Friday') };
  d.log.push({ who: 'agent', text: 'Sure. Which day works best for you?' });
  await d.turn('Yeah I already said Friday, come on.');
  assert.equal(d.values.preferred_day, undefined);
  const r = await d.turn('yes');
  assert.ok(r.includes(d.pending?.text ?? '###') || d.values.preferred_day === 'Friday');
  assert.equal(clearYes("Yeah, Friday, can we keep moving?"), true);
});

test('two choices at once are read back together and one yes fills both', async () => {
  let step = 0;
  const d = new Desk(brookside, { model: stub(() => (++step === 1 ? { calls: [call('propose_value', { field: 'visit_type', value: 'vaccination' }), call('propose_value', { field: 'preferred_time', value: 'morning' })] } : { calls: [call('confirm_pending')] })) });
  d.start(); d.current = 'visit_type';
  await d.turn("it's for her shots, mornings are best");
  assert.equal(d.pending?.value, 'Vaccination');
  const r = await d.turn('yes');
  assert.equal(d.values.visit_type, 'Vaccination');
  assert.equal(d.values.preferred_time, 'Morning', 'one yes covers choices read back together');
  assert.match(r, /child's full name/);
});

test('model failure falls back to the v1 rules for that turn; nothing is ever submitted', async () => {
  let submits = 0;
  const d = new Desk(brookside, { model: stub(() => 'fail'), hooks: { submit: () => { submits++; } } });
  d.start(); d.current = 'phone';
  const r = await d.turn('five five five one two three four five six seven');
  assert.match(r, /5 5 5, 1 2 3, 4 5 6 7/);
  await d.turn('yes');
  assert.equal(d.values.phone, '555-123-4567');
  assert.equal(d.turns[0].fallback?.includes('model down'), true);
  for (const f of brookside.fields) d.values[f.name] ??= 'x';
  await d.turn('yes submit it now');
  assert.equal(submits, 0);
  assert.equal(d.submitted, 0);
});

test('unknown fields and tools are ignored; text tool calls are parsed', async () => {
  const d = new Desk(brookside, { model: stub(() => ({ calls: [call('propose_value', { field: 'credit_card', value: '4111' }), call('submit_form')] })) });
  d.start();
  await d.turn('hello');
  assert.deepEqual(d.values, {});
  assert.ok(d.events.some(e => e.type === 'bad_field') && d.events.some(e => e.type === 'bad_tool'));
  const t = textToolCalls('Sure! propose_value(field="child_name", value="Maya Chen")');
  assert.deepEqual(t.calls[0], { name: 'propose_value', args: { field: 'child_name', value: 'Maya Chen' } });
});

test('a read-back the customer says no to is dropped when they give a different field instead', async () => {
  let step = 0;
  const d = new Desk(brookside, { model: stub(() => (++step === 1 ? { calls: [call('propose_value', { field: 'child_name', value: 'Mateo Nguyen' })] } : { content: 'I have Mateo Nguyen, that is M-A-T-E-O.', calls: [call('propose_value', { field: 'parent_name', value: 'Michael Nguyen' })] })) });
  d.start(); d.current = 'parent_name';
  await d.turn('Mateo Nguyen');
  const r = await d.turn("No, that's the kid. My name is Michael, M I C H A E L, Nguyen");
  assert.equal(d.pending?.field, 'parent_name');
  assert.equal(d.pending?.value, 'Michael Nguyen');
  assert.doesNotMatch(r, /Mateo/);
});

// The live site's tax desk: no form, only questions. The model decides what goes to the documents.
const taxDesk = { id: 'tax-desk', business: 'Brindlewick Tax', scope: 'tax guides', intro: 'Hi, ask me a tax question.', doneMessage: '', fields: [] };

test('a question desk answers questions about itself without a lookup, and looks up tax questions', async () => {
  const asked: string[] = [];
  const answer = async (q: string) => { asked.push(q); return /amend/i.test(q) ? 'IRS Pub 17 says: "File within 3 years."' : null; };
  const d = new Desk(taxDesk, { answer, unknown: "The guides don't cover that.", model: stub(s => /amend/i.test(s)
    ? { calls: [call('answer_question', { question: s })] }
    : { content: 'Of course, go ahead. What would you like to know?' }) });
  assert.equal(d.start(), 'Hi, ask me a tax question.');
  assert.equal(await d.turn('can I ask you about taxes?'), 'Of course, go ahead. What would you like to know?');
  assert.deepEqual(asked, [], 'a question about the assistant is not searched');
  assert.equal(await d.turn('how long do I have to amend a return?'), 'IRS Pub 17 says: "File within 3 years."');
  assert.equal(d.complete, false);
  assert.equal(d.submitted, 0);
});

test('a question desk never lets the model state a fact itself', async () => {
  const asked: string[] = [];
  const d = new Desk(taxDesk, { answer: async q => { asked.push(q); return null; }, unknown: "The guides don't cover that.",
    model: stub(() => ({ content: 'You can deduct up to $2,500 of student loan interest.' })) });
  d.start();
  const r = await d.turn('can I deduct student loan interest');
  assert.equal(r, "The guides don't cover that.");
  assert.doesNotMatch(r, /2,500/);
  assert.equal(asked.length, 1);
});

test('a question desk falls back to looking up when the model is down', async () => {
  const d = new Desk(taxDesk, { answer: async () => 'IRS FAQ says: "Yes."', model: stub(() => 'fail') });
  d.start();
  assert.equal(await d.turn('is tip income taxable?'), 'IRS FAQ says: "Yes."');
});

// The site's forms: dates, notice codes, the last digits of a number, and optional questions.
const intake = { id: 'intake', business: 'Brindlewick Tax', scope: 'the intake form', intro: 'Hi.', doneMessage: '', fields: [
  { name: 'notice', label: 'notice code', question: "What's the notice code?", kind: 'code' as const, optional: true },
  { name: 'dob', label: 'date of birth', question: "What's your date of birth?", kind: 'date' as const },
  { name: 'last4', label: 'last four', question: 'What are the last four digits?', kind: 'digits' as const, length: 4 },
] };

test('codes, dates and digits are read back their own way, and "none" leaves an optional field blank', async () => {
  const d = new Desk(intake, { model: stub(s => /yes/i.test(s) ? { calls: [call('confirm_pending')] }
    : /march/i.test(s) ? { calls: [call('propose_value', { field: 'dob', value: s })] }
    : /\d/.test(s) ? { calls: [call('propose_value', { field: 'last4', value: s })] }
    : { calls: [call('propose_value', { field: 'notice', value: 'none' })] }) });
  d.start();
  const r1 = await d.turn("I didn't get one");
  assert.equal(d.values.notice, '');
  assert.match(r1, /leave the notice code blank/);
  assert.match(r1, /date of birth/);
  const r2 = await d.turn('March 3rd 1985');
  assert.equal(d.pending?.value, '1985-03-03');
  assert.match(r2, /March 3, 1985/);
  await d.turn('yes');
  const r3 = await d.turn('4 4 1 2');
  assert.match(r3, /4, 4, 1, 2/);
  const r4 = await d.turn('yes');
  assert.equal(d.values.last4, '4412');
  assert.equal(d.complete, true);
  assert.match(r4, /press Submit/);
});

test('a form started from a draft asks the first empty field', () => {
  const d = new Desk(intake, {});
  const r = d.prefill({ notice: 'CP2000' }, 'Back to the form.');
  assert.equal(r, "Back to the form. What's your date of birth?");
  assert.equal(d.values.notice, 'CP2000');
});

test('a first or last name field takes one word; a full name field still wants two', async () => {
  assert.equal(normalizeName('Michael', true).value, 'Michael');
  assert.match(normalizeName('Michael').problem ?? '', /first and last/);
  const flow = { id: 'r17', business: 'Saltmere', scope: 'the form', intro: 'Hi.', doneMessage: '', fields: [{ name: 'bfirst', label: 'beneficiary first name', kind: 'name' as const, question: "What's the beneficiary's first name?" }] };
  const d = new Desk(flow, {});
  d.start();
  assert.match(await d.turn('Michael'), /Michael/);
  assert.equal(d.pending?.value, 'Michael');
});

test('an answer the model ignores ("go to" the open field) is still read back by code', async () => {
  const flow = { id: 'svc', business: 'Halden', scope: 'the form', intro: 'Hi.', doneMessage: '', fields: [
    { name: 'serial', label: 'serial number', kind: 'serial' as const, question: 'Can you read me the serial number?' },
    { name: 'what', label: 'what happened', kind: 'text' as const, question: 'What happened?' },
  ] };
  let open = 'serial';
  const d: Desk = new Desk(flow, { model: stub(s => /^yes$/i.test(s) ? { calls: [call('confirm_pending')] } : { content: 'Sure.', calls: [call('go_to_field', { field: open })] }) });
  d.start();
  assert.match(await d.turn('one three three four five nine two C, I, S, D, three'), /1334-592C-ISD3/);
  assert.equal(d.values.serial, undefined);
  await d.turn('yes');
  assert.equal(d.values.serial, '1334592CISD3');
  open = 'what';
  assert.match(await d.turn('it shows E24 and there is water at the bottom'), /water at the bottom/);
  assert.equal(d.values.what, undefined);
  await d.turn('yes');
  assert.equal(d.values.what, 'it shows E24 and there is water at the bottom');
});

test('a choice the customer never named is not read back; "my email should be …" goes to the email', async () => {
  const flow = { id: 'quote', business: 'Prana', scope: 'the form', intro: 'Hi.', doneMessage: '', fields: [
    { name: 'email', label: 'email', kind: 'email' as const, question: "What's your email?" },
    { name: 'budget', label: 'budget', kind: 'choice' as const, options: ['$1,000 to $3,000', '$3,000 to $7,000'], question: 'Roughly what budget?' },
  ] };
  const d = new Desk(flow, { model: stub(s => /^yes$/i.test(s) ? { calls: [call('confirm_pending')] }
    : /email|example/.test(s) && !/should be/.test(s) ? { calls: [call('propose_value', { field: 'email', value: 'sofia@example.com' })] }
    : { calls: [call('propose_value', { field: 'budget', value: '$3,000 to $7,000' })] }) });
  d.start();
  await d.turn('sofia at example dot com');
  await d.turn('yes');
  assert.equal(d.values.email, 'sofia@example.com');
  const r = await d.turn('Wait, my email should be sofia dot marin at example dot com');
  assert.match(r, /sofia\.marin@example\.com/);
  assert.equal(d.pending?.field, 'email');
  await d.turn('yes');
  assert.equal(d.values.email, 'sofia.marin@example.com');
  assert.equal(d.values.budget, undefined, 'the model\'s made-up budget was never kept');
  await d.turn('I like the weather');
  assert.notEqual(d.pending?.field, 'budget');
});
