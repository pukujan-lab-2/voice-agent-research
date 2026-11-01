// The prompt budget (#101): a big form or a long call keeps the model's prompt one size, and code keeps every value.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Desk } from '../src/desk.ts';
import { brookside } from '../src/flows/brookside.ts';
import { answerFor, bigFlow, fillAll, scripted } from './scale-flow.ts';

// The budget for one model request, in characters of JSON (messages plus tool schema): about 2,500 tokens.
const BUDGET = 10_000;

test('a small form is listed to the model in full, as before', async () => {
  const model = scripted(brookside);
  const d = new Desk(brookside, { model });
  d.start();
  await d.turn('hello');
  const sys = String(model.last[0].content);
  const note = String(model.last[model.last.length - 1].content);
  for (const f of brookside.fields) {
    assert.ok(sys.includes(`- ${f.name}: ${f.label}`), `system prompt lists ${f.name}`);
    assert.ok(note.includes(`${f.name}: empty`), `state note lists ${f.name}`);
  }
  assert.match(sys, /Form fields, in order:/);
  assert.ok(JSON.stringify(model.tools).includes('"enum"'), 'tools name the fields');
});

test('a 300-field form: every prompt stays under the budget and all 300 answers land in the right fields', async () => {
  const flow = bigFlow(300);
  const { desk, model } = await fillAll(flow);
  assert.ok(desk.allFilled(), 'the whole form was filled');
  for (const f of flow.fields) assert.equal(desk.values[f.name], f.kind === 'choice' ? f.options![7] : answerFor(f).replace('it is ', ''), `${f.name} holds its own answer`);
  const worst = Math.max(...model.sizes);
  assert.ok(model.sizes.length >= 600, `a call of ${model.sizes.length} turns`);
  assert.ok(worst < BUDGET, `largest prompt ${worst} chars is under ${BUDGET}`);
});

test('the prompt is the same size for 30, 300 and 1000 fields', async () => {
  const worst: number[] = [];
  for (const n of [30, 300, 1000]) {
    const model = scripted(bigFlow(n));
    const d = new Desk(bigFlow(n), { model });
    d.start();
    await d.turn(answerFor(d.field(d.current)!));
    worst.push(model.sizes[0]);
  }
  assert.ok(worst[2] - worst[0] < 600, `1000 fields cost only ${worst[2] - worst[0]} more chars than 30 (${worst.join(', ')})`);
});

test('a field the caller names is shown to the model, filled in its own place, and the open field is left alone', async () => {
  const flow = bigFlow(300);
  const model = scripted(flow, (said, note) => {
    const m = /my (\w+ \d+ note) is (.+)$/.exec(said);
    if (!m) return undefined;
    const f = flow.fields.find(x => x.label === m[1])!;
    return note.includes(`- ${f.name}: ${f.label}`) ? [{ name: 'propose_value', args: { field: f.name, value: m[2] } }] : [];
  });
  const d = new Desk(flow, { model });
  d.start();
  for (let i = 0; i < 6; i++) { await d.turn(answerFor(d.field(d.current)!)); if (d.pending) await d.turn('yes'); }
  const open = d.current;
  const target = flow.fields[250];
  await d.turn(`my ${target.label} is teal`);
  assert.equal(d.pending?.field, target.name, 'it was read back under its own name');
  await d.turn('yes');
  assert.equal(d.values[target.name], 'teal');
  assert.equal(d.values[open], undefined, 'the open field was not touched');
  assert.equal(d.current, open, 'and it is still the one being asked');
});

test('a value proposed for a field the model was not shown, from words nobody said, is ignored', async () => {
  const flow = bigFlow(300);
  const model = scripted(flow, said => (/^it is /.test(said) ? [{ name: 'propose_value', args: { field: 'f250', value: 'secret nonsense' } }] : undefined));
  const d = new Desk(flow, { model });
  d.start();
  await d.turn(answerFor(d.field(d.current)!));
  assert.equal(d.values.f250, undefined);
  assert.notEqual(d.pending?.field, 'f250');
  assert.equal(d.pending?.field, 'f0', 'the open field still gets the answer that was said for it');
});

test('a 100-turn call: the prompt does not grow, the log stays short, and no value is lost', async () => {
  const model = scripted(brookside);
  const d = new Desk(brookside, { model });
  const opening = d.start();
  await d.turn('it is Maya Chen');
  await d.turn('yes');
  assert.equal(d.values.child_name, 'Maya Chen');
  for (let i = 0; i < 100; i++) await d.turn(i % 2 ? 'Thanks, one moment please.' : "Sorry, it's been a crazy morning.");
  const sizes = model.sizes;
  assert.ok(sizes.length >= 100);
  assert.ok(Math.max(...sizes) < BUDGET, `largest prompt ${Math.max(...sizes)} < ${BUDGET}`);
  assert.ok(sizes[sizes.length - 1] <= sizes[20] + 300, `turn 100 (${sizes[sizes.length - 1]}) is no bigger than turn 20 (${sizes[20]})`);
  assert.ok(d.log.length <= 80, `log holds ${d.log.length} entries`);
  assert.equal(d.log[0].text, opening, 'the opening line is kept');
  assert.equal(d.values.child_name, 'Maya Chen', 'nothing collected is lost');
});
