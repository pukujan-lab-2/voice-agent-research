// Model slots (#78, #89): LFM3 is every slot's default, a bad slot stops the start with a message naming it, InferHub is limited to
// DeepSeek V4.1 Flash and its vendor routes, and no model the product may not use (Claude, Gemma, OpenRouter's router) gets through
// by file, env or reported name.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bannedModelReason, loadSlots, reportedModelOk, SLOT_NAMES, SlotsError } from '../src/slots.ts';

const file = (slots: Record<string, unknown>) => ({ version: 1, slots });
const bad = (f: unknown, env: Record<string, string> = {}, re: RegExp) => assert.throws(() => loadSlots(f, env), (e: Error) => e instanceof SlotsError && re.test(e.message));
const VENDOR_ORDER = ['cb', 'cbcn', 'ali', 'cp/cline-pass', 'ocg'];

test('no file and no env: every slot is the local model and none is smart', () => {
  const s = loadSlots(undefined, {});
  for (const n of SLOT_NAMES) { assert.equal(s[n].provider, 'local'); assert.equal(s[n].smart, false); assert.equal(s[n].model, 'lfm3'); assert.equal(s[n].url, undefined); assert.deepEqual(s[n].routes, ['lfm3']); }
});

test('the shipped model-slots.json is valid and changes nothing (all slots local)', () => {
  const s = loadSlots(JSON.parse(fs.readFileSync(new URL('../../demo/live-site/model-slots.json', import.meta.url), 'utf8')), {});
  assert.deepEqual(SLOT_NAMES.map(n => s[n].provider), SLOT_NAMES.map(() => 'local'));
});

test('a file names a hosted model per slot; the key is only named, never held', () => {
  const s = loadSlots(file({ desk: { provider: 'inferhub', model: 'deepseek-v4.1-flash' }, eval: { provider: 'workbuddy', model: 'deepseek-v4.1-flash' }, rewrite: { provider: 'openrouter-free', model: 'qwen/qwen3-next-80b-a3b-instruct:free' } }), {});
  assert.equal(s.desk.smart, true); assert.equal(s.desk.keyName, 'INFERHUB_API_KEY');
  assert.equal(s.eval.keyName, 'WORKBUDDY_KEY'); assert.equal(s.eval.stream, true);
  assert.equal(s.rewrite.keyName, 'OPENROUTER_FREE_KEY'); assert.equal(s.reply.provider, 'local');
  assert.ok(!JSON.stringify(s).includes('Bearer'));
});

test('inferhub is reached through the vault proxy by default (its key is a lease), and INFERHUB_BASE_URL overrides that', () => {
  const f = file({ desk: { provider: 'inferhub', model: 'deepseek-v4.1-flash' } });
  assert.equal(loadSlots(f, {}).desk.url, 'https://octodb.design-bakery.com/api/vault/proxy/https://api.inferhub.dev/v1');
  assert.equal(loadSlots(f, { INFERHUB_BASE_URL: 'https://api.inferhub.dev/v1/' }).desk.url, 'https://api.inferhub.dev/v1');
});

test('inferhub takes exactly deepseek-v4.1-flash or one of its vendor routes, and nothing else', () => {
  const ok = (model: string) => loadSlots(file({ desk: { provider: 'inferhub', model } }), {}).desk;
  assert.equal(ok('deepseek-v4.1-flash').model, 'deepseek-v4.1-flash');
  for (const v of VENDOR_ORDER) assert.equal(ok(`${v}/deepseek-v4.1-flash`).model, `${v}/deepseek-v4.1-flash`);
  for (const m of ['qwen3.8-flash', 'ocg/qwen3.8-flash', 'ali/qwen3.8-max', 'deepseek-v4-pro', 'ali/deepseek-v4-pro-0813', 'cbcn/deepseek-v4-flash', 'deepseek-v4.1-flash-fast', 'deepseek-v4.1-flash-1017',
    'cmc/deepseek/deepseek-v4.1-flash', 'cb/gpt-5.6-luna', 'evil/cb/deepseek-v4.1-flash', 'cb/deepseek-v4.1-flash/x', 'ih/ali/deepseek-v4.1-flash'])
    bad(file({ desk: { provider: 'inferhub', model: m } }), {}, /"desk".*inferhub takes only deepseek-v4\.1-flash/);
  bad(file({ desk: { provider: 'inferhub', model: 'cb/claude-sonnet-5-5' } }), {}, /"desk".*not allowed/);
  bad(file({ desk: { provider: 'inferhub' } }), {}, /"desk".*needs a model/);
});

test('the routes are the model, then the other vendor routes in the old gateway order', () => {
  const routes = (model: string) => loadSlots(file({ desk: { provider: 'inferhub', model } }), {}).desk.routes;
  assert.deepEqual(routes('deepseek-v4.1-flash'), ['deepseek-v4.1-flash', ...VENDOR_ORDER.map(v => `${v}/deepseek-v4.1-flash`)]);
  assert.deepEqual(routes('cbcn/deepseek-v4.1-flash'), ['cbcn/deepseek-v4.1-flash', ...['cb', 'ali', 'cp/cline-pass', 'ocg'].map(v => `${v}/deepseek-v4.1-flash`)]);
  assert.deepEqual(loadSlots(file({ desk: { provider: 'openrouter-free', model: 'a/b:free' } }), {}).desk.routes, ['a/b:free']);
});

test('litellm is gone', () => {
  bad(file({ desk: { provider: 'litellm', model: 'ih/ali/deepseek-v4.1-flash' } }), {}, /"desk".*unknown provider "litellm"/);
});

test('env overrides the file, and is validated by the same rules', () => {
  const f = file({ desk: { provider: 'inferhub', model: 'deepseek-v4.1-flash' } });
  assert.equal(loadSlots(f, { SLOT_DESK_MODEL: 'ocg/deepseek-v4.1-flash' }).desk.model, 'ocg/deepseek-v4.1-flash');
  assert.equal(loadSlots(f, { SLOT_DESK_PROVIDER: 'local' }).desk.smart, false);
  bad(f, { SLOT_DESK_MODEL: 'ih/anthropic/claude-sonnet' }, /desk.*claude/i);
  bad(f, { SLOT_DESK_MODEL: 'qwen3.8-flash' }, /"desk".*inferhub takes only/);
  bad(f, { SLOT_DESK_PROVIDER: 'openai' }, /desk.*unknown provider/);
  // switching the provider does not carry the old provider's model along
  bad(f, { SLOT_DESK_PROVIDER: 'workbuddy' }, /desk.*needs a model/);
  assert.equal(loadSlots(undefined, { SLOT_EVAL_PROVIDER: 'workbuddy', SLOT_EVAL_MODEL: 'deepseek-v4.1-flash' }).eval.provider, 'workbuddy');
});

test('an empty env value counts as unset', () => {
  assert.equal(loadSlots(file({ desk: { provider: 'local' } }), { SLOT_DESK_PROVIDER: '', SLOT_DESK_MODEL: ' ' }).desk.provider, 'local');
});

test('a bad file stops the start with a message that names the slot', () => {
  bad(file({ desk: { provider: 'nope', model: 'x' } }), {}, /"desk".*unknown provider "nope"/);
  bad(file({ reply: { provider: 'inferhub' } }), {}, /"reply".*needs a model/);
  bad(file({ speak: { provider: 'local' } }), {}, /"speak".*unknown slot/);
  bad(file({ desk: { provider: 'local', modle: 'x' } }), {}, /"desk".*unknown key "modle"/);
  bad(file({ judge2: 'inferhub' }), {}, /"judge2".*must be an object/);
  bad({ version: 2, slots: {} }, {}, /expected/);
  bad({ version: 1, slots: {}, extra: 1 }, {}, /unknown key "extra"/);
  bad(file({ desk: { provider: 'local', timeoutMs: 10 } }), {}, /"desk".*timeoutMs/);
  bad(file({ desk: { provider: 'local', dailyCap: -1 } }), {}, /"desk".*dailyCap/);
});

test('the allow-list rejects claude, gemma and the router name, in any case and from any provider', () => {
  for (const m of ['claude-sonnet-5-5', 'ih/ali/Claude-Opus', 'google/gemma-3-27b-it:free', 'Gemma-2', 'openrouter/free', 'x/openrouter/free:free']) {
    assert.ok(bannedModelReason(m), m);
    for (const provider of ['inferhub', 'openrouter-free', 'workbuddy']) bad(file({ desk: { provider, model: m } }), {}, /"desk".*not allowed/);
    bad(file({ desk: { provider: 'local', model: m } }), {}, /"desk".*not allowed/);
  }
  for (const m of ['deepseek-v4.1-flash', 'cb/deepseek-v4.1-flash', 'lfm3', 'qwen/qwen3-next:free']) assert.equal(bannedModelReason(m), null, m);
});

test('openrouter-free takes only a named :free model', () => {
  bad(file({ desk: { provider: 'openrouter-free', model: 'qwen/qwen3-next' } }), {}, /":free"/);
});

test('the daily cap defaults to 300, follows SMART_DAILY_CAP, and a slot can set its own', () => {
  assert.equal(loadSlots(undefined, {}).desk.dailyCap, 300);
  assert.equal(loadSlots(undefined, { SMART_DAILY_CAP: '50' }).desk.dailyCap, 50);
  assert.equal(loadSlots(file({ desk: { provider: 'local', dailyCap: 7 } }), { SMART_DAILY_CAP: '50' }).desk.dailyCap, 7);
});

test('a model name a gateway reports back is checked too', () => {
  assert.equal(reportedModelOk('cb/deepseek-v4.1-flash'), true);
  assert.equal(reportedModelOk('claude-sonnet-5'), false);
  assert.equal(reportedModelOk('google/gemma-3'), false);
});
