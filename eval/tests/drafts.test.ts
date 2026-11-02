// The eval slot and the model-written draft expectations (#81). No network: the model is a stub and fetch is stubbed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { loadSlots } from '../../copilot-engine/src/slots.ts';
import type { Case } from '../lib/cases.ts';
import { draftAll, parseDraft, promptFor } from '../lib/drafts.ts';
import { chat, viaSlot } from '../lib/llm.ts';

// the eval slot, set before the first call that reads it
process.env.SLOT_EVAL_PROVIDER = 'litellm';
process.env.SLOT_EVAL_MODEL = 'ih/ali/qwen3.8-flash';
process.env.LITELLM_URL = 'http://gw.test/v1';
process.env.LITELLM_COPILOT_KEY = 'virtual-key-for-test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const snapshotFile = path.join(root, 'eval/cases/snapshot.json');
const cases = JSON.parse(fs.readFileSync(snapshotFile, 'utf8')) as Case[];
const withPassages = cases.find(c => c.recorded.searches.some(s => s.passages.length > 1))!;
const ids = withPassages.recorded.searches.flatMap(s => s.passages.map(p => p.id));
const who = { provider: 'litellm', model: 'ih/ali/qwen3.8-flash' };

test('the prompt carries what the caller said, the passages found and what went wrong', () => {
  const p = promptFor(withPassages);
  assert.ok(p.includes(withPassages.said)); assert.ok(p.includes(withPassages.note)); assert.ok(p.includes(`[${ids[0]}]`));
});

test('a draft is accepted only in the shape expect.ts checks, naming passages the model was shown', () => {
  const reply = (expect: unknown) => JSON.stringify({ expect, reason: 'because' });
  assert.deepEqual(parseDraft(reply({ kind: 'answers-from', ids: [ids[0]] }), withPassages), { expect: { kind: 'answers-from', ids: [ids[0]] }, reason: 'because' });
  assert.deepEqual((parseDraft(`Sure! ${reply({ kind: 'clarifies' })} done`, withPassages) as { expect: unknown }).expect, { kind: 'clarifies' });
  assert.deepEqual((parseDraft(reply({ kind: 'not-passage', id: ids[0] }), withPassages) as { expect: unknown }).expect, { kind: 'not-passage', id: ids[0] });
  assert.deepEqual((parseDraft(reply({ kind: 'no-offer' }), withPassages) as { expect: unknown }).expect, { kind: 'no-offer' });
  for (const bad of [reply({ kind: 'answers-from', ids: ['made-up'] }), reply({ kind: 'answers-from', ids: [] }), reply({ kind: 'not-passage', id: 'made-up' }), reply({ kind: 'invent' }), 'no json here', '{}'])
    assert.equal(typeof parseDraft(bad, withPassages), 'string', bad);
});

test('every draft is labelled model-written with its slot, model and date; a failed call or a bad reply is skipped, and the cases are untouched', async () => {
  const before = JSON.stringify(cases);
  let n = 0;
  const { drafts, skipped } = await draftAll(cases, async () => { n++; if (n === 1) throw new Error('down'); return n === 2 ? 'nonsense' : JSON.stringify({ expect: { kind: 'clarifies' }, reason: 'two readings' }); }, who, '2026-11-01');
  assert.equal(drafts.length + skipped.length, cases.length);
  assert.equal(skipped.length, 2);
  for (const d of drafts) {
    assert.equal(d.source, 'model-written'); assert.equal(d.slot, 'eval'); assert.equal(d.provider, 'litellm'); assert.equal(d.model, 'ih/ali/qwen3.8-flash'); assert.equal(d.date, '2026-11-01');
    assert.deepEqual(d.current, cases.find(c => c.id === d.case)!.expect, 'the case\'s own expectation is shown beside the draft');
    assert.equal(d.agrees, d.current.kind === 'clarifies');
  }
  assert.equal(JSON.stringify(cases), before, 'a draft never replaces a hand-written expectation');
});

test('an answers-from draft agrees with the case when it names the same passages in any order', async () => {
  const c = { ...withPassages, expect: { kind: 'answers-from' as const, ids: [...ids.slice(0, 2)].reverse() } };
  const { drafts } = await draftAll([c], async () => JSON.stringify({ expect: { kind: 'answers-from', ids: ids.slice(0, 2) }, reason: '' }), who);
  assert.equal(drafts[0].agrees, true);
});

test('the script with no model to ask says so, and neither the snapshot nor a drafts file changes', () => {
  const sum = () => createHash('sha1').update(fs.readFileSync(snapshotFile)).digest('hex');
  const before = sum();
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'drafts-')), 'drafts.json');
  const env = { ...process.env }; delete env.LLAMA_URL; env.SLOT_EVAL_PROVIDER = 'local'; delete env.SLOT_EVAL_MODEL;
  const r = spawnSync(process.execPath, [path.join(root, 'eval/draft-expectations.ts'), '--out', out], { env, encoding: 'utf8' });
  assert.equal(r.status, 0); assert.match(r.stdout, /no model to ask/);
  assert.equal(fs.existsSync(out), false); assert.equal(sum(), before);
});

test('the eval slot decides the generator and caller model; with the slot on local the config does', () => {
  const cfg = { provider: 'openrouter-free' as const, model: 'nvidia/nemotron-3.5-super-vl:free', temperature: 0.9 };
  const smart = viaSlot(cfg, loadSlots(undefined, { SLOT_EVAL_PROVIDER: 'litellm', SLOT_EVAL_MODEL: 'ih/ali/deepseek-v4.1-flash', LITELLM_URL: 'http://gw.test/v1' }).eval);
  assert.deepEqual([smart.provider, smart.model, smart.url, smart.temperature], ['litellm', 'ih/ali/deepseek-v4.1-flash', 'http://gw.test/v1', 0.9]);
  assert.equal(viaSlot(cfg, loadSlots(undefined, {}).eval), cfg);
});

test('chat goes to the gateway with the slot\'s model and the named key, and refuses a banned model whatever the config says', async () => {
  const seen: { url: string; auth: string | null; model: string }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen.push({ url: String(url), auth: new Headers(init.headers).get('authorization'), model: JSON.parse(String(init.body)).model });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'hello' } }] }), { status: 200 });
  }) as typeof fetch;
  // the config says an open free model on llama; the slot (litellm) wins
  assert.equal(await chat({ provider: 'llama', model: 'lfm3', url: 'http://llm.test' }, [{ role: 'user', content: 'hi' }], { what: 'test' }), 'hello');
  assert.deepEqual(seen, [{ url: 'http://gw.test/v1/chat/completions', auth: 'Bearer virtual-key-for-test', model: 'ih/ali/qwen3.8-flash' }]);
});

test('a model named claude or gemma in a corpus config is refused too (slot on local)', () => {
  const env = { ...process.env, SLOT_EVAL_PROVIDER: 'local', SLOT_EVAL_MODEL: '' };
  for (const model of ['claude-sonnet-5-5', 'google/gemma-3:free']) {
    const code = `import { chat } from '${path.join(root, 'eval/lib/llm.ts')}';
      chat({ provider: 'llama', model: '${model}', url: 'http://127.0.0.1:9' }, [{ role: 'user', content: 'hi' }], { what: 'x' }).then(() => process.exit(0), e => { console.log(e.message); process.exit(3); });`;
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { env, encoding: 'utf8' });
    assert.equal(r.status, 3, r.stderr); assert.match(r.stdout, /not allowed/);
  }
});
