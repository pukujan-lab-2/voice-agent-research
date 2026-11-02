// Model slots (#78): LFM3 is every slot's default, a bad slot stops the start with a message naming it, and no model
// the product may not use (Claude, Gemma, OpenRouter's router) gets through by file, env or reported name.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bannedModelReason, loadSlots, reportedModelOk, SLOT_NAMES, SlotsError } from '../src/slots.ts';

const file = (slots: Record<string, unknown>) => ({ version: 1, slots });
const bad = (f: unknown, env: Record<string, string> = {}, re: RegExp) => assert.throws(() => loadSlots(f, env), (e: Error) => e instanceof SlotsError && re.test(e.message));

test('no file and no env: every slot is the local model and none is smart', () => {
  const s = loadSlots(undefined, {});
  for (const n of SLOT_NAMES) { assert.equal(s[n].provider, 'local'); assert.equal(s[n].smart, false); assert.equal(s[n].model, 'lfm3'); assert.equal(s[n].url, undefined); }
});

test('the shipped model-slots.json is valid and changes nothing (all slots local)', () => {
  const s = loadSlots(JSON.parse(fs.readFileSync(new URL('../../demo/live-site/model-slots.json', import.meta.url), 'utf8')), {});
  assert.deepEqual(SLOT_NAMES.map(n => s[n].provider), SLOT_NAMES.map(() => 'local'));
});

test('a file names a hosted model per slot; the key is only named, never held', () => {
  const s = loadSlots(file({ desk: { provider: 'litellm', model: 'ih/ali/deepseek-v4.1-flash' }, eval: { provider: 'workbuddy', model: 'deepseek-v4.1-flash' }, rewrite: { provider: 'openrouter-free', model: 'qwen/qwen3-next-80b-a3b-instruct:free' } }), {});
  assert.equal(s.desk.smart, true); assert.equal(s.desk.keyName, 'LITELLM_COPILOT_KEY'); assert.match(s.desk.url!, /:4001\/v1$/);
  assert.equal(s.eval.keyName, 'WORKBUDDY_KEY'); assert.equal(s.eval.stream, true);
  assert.equal(s.rewrite.keyName, 'OPENROUTER_FREE_KEY'); assert.equal(s.reply.provider, 'local');
  assert.ok(!JSON.stringify(s).includes('Bearer'));
});

test('the gateway URL can be overridden by env', () => {
  assert.equal(loadSlots(file({ desk: { provider: 'litellm', model: 'ih/ali/qwen3.8-flash' } }), { LITELLM_URL: 'http://127.0.0.1:4001/v1/' }).desk.url, 'http://127.0.0.1:4001/v1');
});

test('env overrides the file, and is validated by the same rules', () => {
  const f = file({ desk: { provider: 'litellm', model: 'ih/ali/qwen3.8-flash' } });
  assert.equal(loadSlots(f, { SLOT_DESK_MODEL: 'ih/ali/qwen3.8-max' }).desk.model, 'ih/ali/qwen3.8-max');
  assert.equal(loadSlots(f, { SLOT_DESK_PROVIDER: 'local' }).desk.smart, false);
  bad(f, { SLOT_DESK_MODEL: 'ih/anthropic/claude-sonnet' }, /desk.*claude/i);
  bad(f, { SLOT_DESK_PROVIDER: 'openai' }, /desk.*unknown provider/);
  // switching the provider does not carry the old provider's model along
  bad(f, { SLOT_DESK_PROVIDER: 'workbuddy' }, /desk.*needs a model/);
  assert.equal(loadSlots(undefined, { SLOT_EVAL_PROVIDER: 'workbuddy', SLOT_EVAL_MODEL: 'qwen3.8-max' }).eval.provider, 'workbuddy');
});

test('an empty env value counts as unset', () => {
  assert.equal(loadSlots(file({ desk: { provider: 'local' } }), { SLOT_DESK_PROVIDER: '', SLOT_DESK_MODEL: ' ' }).desk.provider, 'local');
});

test('a bad file stops the start with a message that names the slot', () => {
  bad(file({ desk: { provider: 'nope', model: 'x' } }), {}, /"desk".*unknown provider "nope"/);
  bad(file({ reply: { provider: 'litellm' } }), {}, /"reply".*needs a model/);
  bad(file({ speak: { provider: 'local' } }), {}, /"speak".*unknown slot/);
  bad(file({ desk: { provider: 'local', modle: 'x' } }), {}, /"desk".*unknown key "modle"/);
  bad(file({ judge2: 'litellm' }), {}, /"judge2".*must be an object/);
  bad({ version: 2, slots: {} }, {}, /expected/);
  bad({ version: 1, slots: {}, extra: 1 }, {}, /unknown key "extra"/);
  bad(file({ desk: { provider: 'local', timeoutMs: 10 } }), {}, /"desk".*timeoutMs/);
  bad(file({ desk: { provider: 'local', dailyCap: -1 } }), {}, /"desk".*dailyCap/);
});

test('the allow-list rejects claude, gemma and the router name, in any case and from any provider', () => {
  for (const m of ['claude-sonnet-5-5', 'ih/ali/Claude-Opus', 'google/gemma-3-27b-it:free', 'Gemma-2', 'openrouter/free', 'x/openrouter/free:free']) {
    assert.ok(bannedModelReason(m), m);
    for (const provider of ['litellm', 'openrouter-free', 'workbuddy']) bad(file({ desk: { provider, model: m } }), {}, /"desk".*not allowed/);
    bad(file({ desk: { provider: 'local', model: m } }), {}, /"desk".*not allowed/);
  }
  for (const m of ['ih/ali/deepseek-v4.1-flash', 'ih/ali/qwen3.8-max', 'lfm3', 'qwen/qwen3-next:free']) assert.equal(bannedModelReason(m), null, m);
});

test('openrouter-free takes only a named :free model; litellm only a gateway "ih/" name', () => {
  bad(file({ desk: { provider: 'openrouter-free', model: 'qwen/qwen3-next' } }), {}, /":free"/);
  bad(file({ desk: { provider: 'litellm', model: 'sonnet' } }), {}, /"ih\/"/);
  bad(file({ desk: { provider: 'litellm', model: 'opus' } }), {}, /"ih\/"/);
});

test('the daily cap defaults to 300, follows SMART_DAILY_CAP, and a slot can set its own', () => {
  assert.equal(loadSlots(undefined, {}).desk.dailyCap, 300);
  assert.equal(loadSlots(undefined, { SMART_DAILY_CAP: '50' }).desk.dailyCap, 50);
  assert.equal(loadSlots(file({ desk: { provider: 'local', dailyCap: 7 } }), { SMART_DAILY_CAP: '50' }).desk.dailyCap, 7);
});

test('a model name a gateway reports back is checked too', () => {
  assert.equal(reportedModelOk('ih/ali/deepseek-v4.1-flash'), true);
  assert.equal(reportedModelOk('claude-sonnet-5'), false);
  assert.equal(reportedModelOk('google/gemma-3'), false);
});
