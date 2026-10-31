import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarios } from './scenarios.ts';
import { RuleModel } from '../src/models.ts';
import { grounded, isFiller, parseName, spokenToSerial, validSerial, yesNo } from '../src/guard.ts';

for (const s of scenarios) {
  test(s.name, async () => {
    const r = await s.run(new RuleModel());
    assert.ok(r.pass, r.detail);
  });
}

test('spoken serials', () => {
  assert.equal(spokenToSerial("It's one three three four, five nine two, C, L as in Lima, S, D, three"), '1334592CLSD3');
  assert.equal(spokenToSerial('1334 592C LSD3'), '1334592CLSD3');
  assert.equal(spokenToSerial('one three three four five nine two charlie lima sierra delta three'), '1334592CLSD3');
  assert.equal(spokenToSerial('1334 592 C, L as in Lima, X-ray, D, 3'), '1334592CLXD3');
  assert.ok(!validSerial('1334'));
});

test('yes/no never treats hedges as yes', () => {
  for (const t of ['maybe', "I'm not sure", 'hmm', '']) assert.equal(yesNo(t), 'unclear', t);
  assert.equal(yesNo('wait, not yet'), 'no');
  assert.equal(yesNo('yes go ahead'), 'yes');
  assert.equal(yesNo('no, wait'), 'no');
  assert.equal(yesNo('go for it'), 'yes');
  for (const t of ['wrong', 'not right', "that's not correct", 'nah', 'no, not right']) assert.equal(yesNo(t), 'no', t);
  assert.equal(yesNo('sure, how much does it cost?'), 'unclear');
  assert.equal(yesNo('yes I think the right price for this repair would be about two hundred dollars is that fine'), 'unclear');
  assert.equal(yesNo('not really'), 'no');
});

test('names are parsed from natural phrasing and nothing else', () => {
  assert.equal(parseName('um, my name is Priya Rossi'), 'Priya Rossi');
  assert.equal(parseName("sorry, it's Amira, not Marcus"), 'Amira');
  assert.equal(parseName('actually change my name to Amira'), 'Amira');
  assert.equal(parseName('Yuki Khan here'), 'Yuki Khan');
  assert.equal(parseName('sorry, my name is actually Amira'), 'Amira');
  for (const t of ['thanks', 'hello?', 'how much does it cost', 'Can they do cosmetic services?', 'my card is blocked', 'sorry', 'okay', 'I need help with my card', '']) assert.equal(parseName(t), '', t);
});

test('filler and silence are never answers', () => {
  for (const t of ['', '  ', 'thanks', 'hello?', 'are you there', 'one second', 'um...', "I'm not sure", 'maybe']) assert.ok(isFiller(t), t);
  assert.ok(!isFiller('it shows error E24'));
});

test('model values must be grounded in what the customer said', () => {
  assert.ok(grounded('shows E24', "it shows E24 and there's water"));
  assert.ok(!grounded('Halvorsen Home', 'thanks'));
});

test('a yes with a condition attached never submits; asking for a person is not an answer', async () => {
  const { Copilot } = await import('../src/engine.ts');
  const { halvorsen } = await import('../src/flows/halvorsen.ts');
  const S = 'four four one zero, seven two, B as in bravo, K, nine, X, one, one';
  for (const said of ['yes but change the time', 'yes, except the problem is wrong', 'yes wait', 'yeah though the name is off', 'yes if it is free', 'yes as long as it is covered']) {
    let n = 0;
    const c = new Copilot(halvorsen, new RuleModel(), { submit: () => { n++; } });
    c.start();
    for (const s of ['Priya', S, 'yes', 'the oven door will not close', 'morning']) await c.turn(s);
    await c.turn(said);
    assert.equal(n, 0, said);
  }
  const c = new Copilot(halvorsen, new RuleModel(), { submit: () => {} });
  c.start();
  for (const s of ['Priya', S, 'yes']) await c.turn(s);
  const r = await c.turn('can I talk to a real person');
  assert.equal(c.values.problem, undefined);
  assert.match(r, /can't transfer/);
});

test('declining a name and ruling out an option are not answers', async () => {
  for (const t of ["I'd rather not say", 'prefer not to', "I don't want to give it"]) assert.equal(parseName(t), '', t);
  const { Copilot } = await import('../src/engine.ts');
  const { halvorsen } = await import('../src/flows/halvorsen.ts');
  const c = new Copilot(halvorsen, new RuleModel(), { submit: () => {} });
  c.start();
  for (const s of ['Dmitri', '77H2 01NP 55A8', 'yes', 'no heat']) await c.turn(s);
  await c.turn('not the morning');
  assert.equal(c.values.visit_time, undefined);
});

test('a choice that fits two options asks between just those', async () => {
  const { Copilot } = await import('../src/engine.ts');
  const flow = { id: 'day', title: 'Day', scope: 'Only the day.', submitLabel: 'Send', fields: [
    { name: 'day', label: 'day', kind: 'choice' as const, question: 'Which day?', options: ['Tuesday, November 3', 'Wednesday, November 4', 'Tuesday, November 10'] }] };
  const c = new Copilot(flow as any, new RuleModel(), { submit: () => {} });
  c.start();
  assert.equal(await c.turn('Tuesday'), 'Which one: Tuesday, November 3 or Tuesday, November 10?');
  assert.equal(c.values.day, undefined);
  assert.match(await c.turn('Tuesday, November 10'), /November 10/);
});

test('future dates: a month and day mean the next one; past dates are refused', async () => {
  const { spokenToDate } = await import('../src/guard.ts');
  const now = new Date(2026, 9, 31); // Oct 31, 2026
  const f = { future: true };
  assert.equal(spokenToDate('November 16', now, f), '2026-11-16');
  assert.equal(spokenToDate('January fifth', now, f), '2027-01-05');
  assert.equal(spokenToDate('the 3rd of March 2027', now, f), '2027-03-03');
  assert.equal(spokenToDate('October 1 2026', now, f), '');
  assert.equal(spokenToDate('March 3 1985', now, f), '');
  // without the option, nothing changes: past dates only, a year is needed
  assert.equal(spokenToDate('March third, nineteen eighty five', now), '1985-03-03');
  assert.equal(spokenToDate('November 16', now), '');
  assert.equal(spokenToDate('November 16 2026', now), '');
});
