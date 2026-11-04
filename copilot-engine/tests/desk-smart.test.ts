// The desk's hosted-model escalation (#79): used only on a hard turn, only when the hosted model says it may answer, and an
// unavailable one changes nothing for the visitor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Desk, type ChatModel, type ChatResult, type ToolCall } from '../src/desk.ts';
import { brookside } from '../src/flows/brookside.ts';

const call = (name: string, args: Record<string, unknown> = {}): ToolCall => ({ name, args });
type Counted = ChatModel & { n: number };
const model = (name: string, answer: (n: number) => ToolCall[], open?: () => boolean): Counted => ({
  name, n: 0,
  ...(open ? { unavailable: () => !open() } : {}),
  async chat(): Promise<ChatResult> { this.n++; return { content: '', calls: answer(this.n), ms: 1, model: name }; },
});
const wrongField = [call('propose_value', { field: 'no_such_field', value: 'x' })];
const rightName = [call('propose_value', { field: 'child_name', value: 'Maya Chen' })];

test('a hard turn (the local model proposes a field that does not exist) goes to the hosted model, whose answer is used', async () => {
  const local = model('lfm3', () => wrongField), smart = model('smart', () => rightName, () => true);
  const d = new Desk(brookside, { model: local, heavy: smart, hybrid: true, route: () => false });
  d.start();
  await d.turn("it's Maya Chen");
  assert.equal(local.n, 1); assert.equal(smart.n, 1);
  assert.equal(d.pending?.value, 'Maya Chen');
  assert.equal(d.turns.at(-1)?.model, 'lfm3>smart', 'the turn log names both models');
});

test('a turn the local model got right never reaches the hosted model, whatever the question or length', async () => {
  const local = model('lfm3', () => rightName), smart = model('smart', () => rightName, () => true);
  const d = new Desk(brookside, { model: local, heavy: smart, hybrid: true, route: () => false });
  d.start();
  await d.turn("it's Maya Chen, and can you tell me how long a checkup takes and what I should bring with me to the visit please");
  assert.equal(smart.n, 0);
});

test('a hosted model that is unavailable is never asked, on a hard turn or on the reminder; the visitor gets the local path', async () => {
  const local = model('lfm3', n => (n === 1 ? [] : rightName)), smart = model('smart', () => rightName, () => false);
  const d = new Desk(brookside, { model: local, heavy: smart, hybrid: true, route: () => false });
  d.start();
  await d.turn("my child's name is Maya Chen"); // no tool call: the reminder goes to the local model, not the hosted one
  assert.equal(smart.n, 0);
  assert.equal(local.n, 2);
  assert.equal(d.pending?.value, 'Maya Chen');
  assert.equal(d.turns.at(-1)?.model, 'lfm3+nudge');
});

test('without the hybrid switch a hosted model is ignored', async () => {
  const local = model('lfm3', () => wrongField), smart = model('smart', () => rightName, () => true);
  const d = new Desk(brookside, { model: local, heavy: smart });
  d.start();
  await d.turn("it's Maya Chen");
  assert.equal(smart.n, 0);
});

test('a hosted model that fails leaves the local answer in place', async () => {
  const local = model('lfm3', () => wrongField);
  const smart: ChatModel = { name: 'smart', unavailable: () => false, async chat() { throw new Error('timeout'); } };
  const d = new Desk(brookside, { model: local, heavy: smart, hybrid: true, route: () => false });
  d.start();
  const r = await d.turn("it's Maya Chen");
  assert.ok(r.length > 0);
  assert.equal(d.turns.at(-1)?.model, 'lfm3');
});
