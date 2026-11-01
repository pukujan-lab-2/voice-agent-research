// Memory features of the desk: call resume and opt-in returning-customer details. Scripted model, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Desk, type ChatModel, type ToolCall } from '../src/desk.ts';
import { MemoryStore, JsonFileStore, customerKey, SESSION_TTL_MS } from '../src/memory.ts';
import { brookside } from '../src/flows/brookside.ts';

function stub(script: (said: string) => { content?: string; calls?: ToolCall[] } = () => ({})): ChatModel {
  return { name: 'stub', async chat(messages) { const last = String(messages[messages.length - 1].content).split('\n\n[Form state')[0]; const r = script(last); return { content: r.content ?? '', calls: r.calls ?? [], ms: 1, model: 'stub' }; } };
}
const call = (name: string, args: Record<string, unknown> = {}): ToolCall => ({ name, args });
const clock = () => { let t = 1_000_000; return { now: () => t, add: (ms: number) => { t += ms; } }; };

test('a dropped call resumes with its state; a waiting read-back is asked again, never filled', async () => {
  const c = clock(); const sessions = new MemoryStore(c.now);
  const model = stub(s => /Maya/.test(s) ? { calls: [call('propose_value', { field: 'child_name', value: 'Maya Chen' })] } : /shots/.test(s) ? { calls: [call('propose_value', { field: 'visit_type', value: 'Vaccination' })] } : {});
  // Choices default to a risk said in passing (decision 0011); this one is set to be read back, so it can wait on resume.
  const careful = { ...brookside, fields: brookside.fields.map(f => f.kind === 'choice' ? { ...f, risk: 40 } : f) };
  const d1 = new Desk(careful, { model, sessions });
  d1.start();
  await d1.turn("it's Maya Chen");
  await d1.turn('yes');
  await d1.turn("it's for her shots");
  assert.equal(d1.pending?.field, 'visit_type');
  const sid = d1.sessionId!;
  assert.ok(sid && sid.length >= 20, 'opaque random id');

  const d2 = new Desk(careful, { model, sessions });
  const w = await d2.restore(sid);
  assert.match(w, /Welcome back/);
  assert.match(w, /child's full name/i);
  assert.ok(w.includes(d2.pending!.text), 'the read-back is asked again');
  assert.equal(d2.values.child_name, 'Maya Chen');
  assert.equal(d2.values.visit_type, undefined, 'not filled on resume');
  await d2.turn('yes');
  assert.equal(d2.values.visit_type, 'Vaccination');
});

test('expired or unknown session ids start fresh', async () => {
  const c = clock(); const sessions = new MemoryStore(c.now);
  const d1 = new Desk(brookside, { model: stub(() => ({ calls: [call('propose_value', { field: 'child_name', value: 'Maya Chen' })] })), sessions });
  d1.start(); await d1.turn('Maya Chen'); await d1.turn('yes');
  c.add(SESSION_TTL_MS + 1000);
  const d2 = new Desk(brookside, { model: stub(), sessions });
  const w = await d2.restore(d1.sessionId!);
  assert.doesNotMatch(w, /Welcome back/);
  assert.deepEqual(d2.values, {});
  const d3 = new Desk(brookside, { model: stub(), sessions });
  assert.match(await d3.restore('no-such-id'), /thanks for calling Brookside/i);
});

test('JSON file store keeps sessions across processes and honours the TTL', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'desk-')), 'store.json');
  const c = clock();
  const a = new JsonFileStore(file, c.now);
  await a.set('k', { x: 1 }, 1000);
  assert.deepEqual(await new JsonFileStore(file, c.now).get('k'), { x: 1 });
  c.add(2000);
  assert.equal(await new JsonFileStore(file, c.now).get('k'), undefined);
});

// A desk with everything filled except the email, which is waiting for a yes.
function nearlyDone(customers: MemoryStore) {
  const d = new Desk(brookside, { model: stub(), customers });
  d.start();
  Object.assign(d.values, { child_name: 'Maya Chen', visit_type: 'Sick visit', preferred_day: 'Monday', preferred_time: 'Morning', parent_name: 'Lucia Chen', phone: '555-210-4433' });
  d.current = 'email';
  return d;
}

test('details are stored only after a clear yes, and only the rememberable fields', async () => {
  const customers = new MemoryStore();
  const d = nearlyDone(customers);
  await d.turn('lucia dot chen at gmail dot com');
  const r = await d.turn('yes');
  assert.match(r, /remember your name and contact details/);
  await d.turn('hmm, maybe later');
  assert.equal(await customers.get(customerKey('phone', '555-210-4433')), undefined, 'no store without a clear yes');

  const d2 = nearlyDone(customers);
  await d2.turn('lucia dot chen at gmail dot com');
  await d2.turn('yes');
  const r2 = await d2.turn('yes please');
  assert.match(r2, /remember them/);
  assert.match(r2, /press Submit/);
  const rec = await customers.get(customerKey('phone', '(555) 210 4433')) as { values: Record<string, string> };
  assert.deepEqual(Object.keys(rec.values).sort(), ['child_name', 'email', 'parent_name', 'phone']);
  assert.ok(await customers.get(customerKey('email', 'Lucia.Chen@gmail.com')), 'also found by email');
  assert.equal(d2.submitted, 0);
});

test('a returning customer: every reused value is read back and needs a yes; one can be changed', async () => {
  const customers = new MemoryStore();
  const rec = { v: 1, flow: brookside.id, savedAt: 0, values: { parent_name: 'Lucia Chen', phone: '555-210-4433', email: 'lucia.chen@gmail.com', child_name: 'Maya Chen' } };
  await customers.set(customerKey('phone', '555-210-4433'), rec);
  const d = new Desk(brookside, { model: stub(s => /@|\bat\b/.test(s) ? { calls: [call('propose_value', { field: 'email', value: 'lucia@newmail.com' })] } : {}), customers });
  d.start();
  const r0 = await d.turn("Hi, I've been there before.");
  assert.equal(d.current, 'phone');
  assert.match(r0, /used last time/);
  await d.turn('555 210 4433');
  const r1 = await d.turn('yes');
  assert.equal(d.values.phone, '555-210-4433');
  assert.equal(d.values.child_name, undefined, 'nothing filled silently');
  assert.equal(d.pending?.field, 'child_name');
  assert.match(r1, /from last time/i);
  assert.match(r1, /M-A-Y-A/);
  await d.turn('yes');
  assert.equal(d.values.child_name, 'Maya Chen');
  await d.turn('yep');
  assert.equal(d.values.parent_name, 'Lucia Chen');
  assert.equal(d.pending?.field, 'email');
  await d.turn("no, it's lucia at newmail dot com now");
  assert.equal(d.values.email, undefined);
  assert.equal(d.pending?.value, 'lucia@newmail.com');
  await d.turn('yes');
  assert.equal(d.values.email, 'lucia@newmail.com');
  assert.equal(d.fills.length, 4);
  for (const f of d.fills) assert.match(f.yes, /^(yes|yep)/i);
});

test('"forget me" deletes the record under every contact it holds', async () => {
  const customers = new MemoryStore();
  const rec = { v: 1, flow: brookside.id, savedAt: 0, values: { parent_name: 'Lucia Chen', phone: '555-210-4433', email: 'lucia.chen@gmail.com' } };
  await customers.set(customerKey('phone', '555-210-4433'), rec);
  await customers.set(customerKey('email', 'lucia.chen@gmail.com'), rec);
  const d = new Desk(brookside, { model: stub(), customers });
  d.start();
  const r = await d.turn('Actually, please forget me, I do not want you keeping my details.');
  assert.equal(d.current, 'phone');
  assert.match(r, /delete/);
  await d.turn('555 210 4433');
  const r2 = await d.turn('yes');
  assert.match(r2, /deleted the details/);
  assert.equal(await customers.get(customerKey('phone', '555-210-4433')), undefined);
  assert.equal(await customers.get(customerKey('email', 'lucia.chen@gmail.com')), undefined);
  assert.equal(d.pending, null, 'nothing offered after forget');
});
