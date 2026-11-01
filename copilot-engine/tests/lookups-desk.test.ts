// The desk with declared lookups: the model names a lookup, code runs it for the caller the host says is verified.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { Desk, type ChatModel, type ToolCall } from '../src/desk.ts';
import { Lookups, type BusinessLookups, type Caller, type Sql } from '../src/lookups.ts';

const db = new DatabaseSync(':memory:');
db.exec(`create table orders (order_number text, business_id text, customer_id text, status text, eta text, note text);
  insert into orders values ('A-1001','acme','c1','shipped','2026-11-04','VIP'), ('A-1002','acme','c2','packing','2026-11-06','late');`);
const ran: { text: string; params: unknown[] }[] = [];
const sql: Sql = async (text, params) => { ran.push({ text, params }); return { rows: db.prepare(text.replace(/\$(\d+)/g, '?$1')).all(...(params as never[])) as Record<string, unknown>[] }; };
const spec = (risk?: number): BusinessLookups => ({ business: 'acme', businessColumn: 'business_id', lookups: [{
  id: 'order_status', description: 'Status of an order by its number.', table: 'orders', about: 'person', ownerColumn: 'customer_id', ...(risk ? { risk } : {}),
  params: [{ name: 'order_number', column: 'order_number', type: 'string', pattern: '[A-Za-z0-9-]{4,16}', upper: true }],
  fields: [{ column: 'status', label: 'Status' }, { column: 'eta', label: 'Expected' }], say: 'Order {Status}, expected {Expected}.' }] });
const flow = { id: 'acme-desk', business: 'Acme', scope: "Acme's site", intro: 'Hi, how can I help?', doneMessage: '', fields: [] };
const call = (name: string, args: Record<string, unknown> = {}): ToolCall => ({ name, args });
function model(script: (said: string, n: number) => { content?: string; calls?: ToolCall[] }) {
  const m: ChatModel & { n: number; tools: unknown[][] } = { name: 'stub', n: 0, tools: [], async chat(messages, tools) {
    this.n++; this.tools.push(tools);
    const r = script(String(messages[messages.length - 1].content), this.n);
    return { content: r.content ?? '', calls: r.calls ?? [], ms: 1, model: 'stub' };
  } };
  return m;
}
const names = (m: { tools: unknown[][] }) => (m.tools[0] as { function: { name: string } }[]).map(t => t.function.name);

test('a declared lookup becomes a tool, and an unverified caller is asked to verify first', async () => {
  ran.length = 0;
  const m = model(() => ({ calls: [call('lookup_order_status', { order_number: 'A-1001' })] }));
  const d = new Desk(flow, { model: m, lookups: new Lookups(spec(), sql), caller: () => ({ verified: false }) });
  d.start();
  const reply = await d.turn("where's order A-1001?");
  assert.ok(names(m).includes('lookup_order_status'));
  assert.match(reply, /checked who you are/);
  assert.ok(!/shipped|2026/.test(reply));
  assert.equal(ran.length, 0);
  assert.ok(d.events.some(e => e.type === 'lookup' && /needs_verification/.test(e.detail ?? '')));
});

test("a verified caller hears the declared fields in code's words, for their own order only", async () => {
  ran.length = 0;
  let who: Caller = { verified: true, clientId: 'c1' };
  const m = model(s => ({ calls: [call('lookup_order_status', { order_number: /1002/.test(s) ? 'A-1002' : 'A-1001' })], content: 'It has shipped, the note says VIP.' }));
  const d = new Desk(flow, { model: m, lookups: new Lookups(spec(), sql), caller: () => who });
  d.start();
  const mine = await d.turn("where's order A-1001?");
  assert.ok(mine.includes('Order shipped, expected 2026-11-04.'), mine);
  assert.ok(!/VIP/.test(mine), 'what the model said alongside is not what is spoken from the record');
  assert.match(await d.turn("and order A-1002?"), /couldn't find a record/);
  who = { verified: false };
  assert.match(await d.turn("where's order A-1001?"), /checked who you are/);
  assert.deepEqual(ran.map(r => r.params), [['A-1001', 'acme', 'c1'], ['A-1002', 'acme', 'c1']]);
  assert.ok(d.events.filter(e => e.type === 'lookup').every(e => !/A-100|VIP|shipped/.test(e.detail ?? '')), 'events carry no values');
});

test('a lookup scored 56 or more waits for a yes; the yes runs it without asking the model', async () => {
  ran.length = 0;
  const m = model(said => (/order/i.test(said) ? { calls: [call('lookup_order_status', { order_number: 'A-1001' })] } : { content: 'Okay.' }));
  const d = new Desk(flow, { model: m, lookups: new Lookups(spec(60), sql), caller: () => ({ verified: true, clientId: 'c1' }) });
  d.start();
  assert.match(await d.turn("where's order A-1001?"), /Shall I look that up/);
  assert.equal(ran.length, 0);
  const trips = m.n;
  assert.ok((await d.turn('yes please')).includes('Order shipped'));
  assert.equal(m.n, trips, 'no model call for the yes');
  assert.equal(ran.length, 1);
  // a no, or anything else, drops it
  assert.match(await d.turn("where's order A-1001?"), /Shall I look that up/);
  await d.turn('actually never mind');
  assert.equal(ran.length, 1);
  assert.match(await d.turn('yes'), /^(?!.*Order shipped)/);
  assert.equal(ran.length, 1, 'a late yes does not run the old lookup');
});

test('without lookups the desk has no lookup tools', async () => {
  const m = model(() => ({ content: 'Hello.' }));
  const d = new Desk(flow, { model: m });
  d.start();
  await d.turn('hi');
  assert.ok(!names(m).some(n => n.startsWith('lookup_')));
});
