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
