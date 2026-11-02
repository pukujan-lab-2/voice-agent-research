// Smart model slots on the live backend (#79): a hosted model may answer a hard desk turn only for a development host or the owner,
// under a daily cap, with a timeout that leaves the local answer in place, and never under a model name the product may not use.
// The local model and the hosted gateway are stubbed at fetch; nothing leaves the machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, type ApiEnv } from '../api.ts';
import type { SpanSpec } from '../tracing.ts';

type Seen = { url: string; auth: string | null; body: Record<string, any> };
let seen: Seen[] = [];
let gateway: (init: RequestInit) => Promise<Response> = async () => reply('ih/ali/deepseek-v4.1-flash');
const reply = (model: string, content = 'smart says hi') => new Response(JSON.stringify({ model, choices: [{ message: { content } }] }), { status: 200 });
globalThis.fetch = (async (url: string | URL, init: RequestInit = {}) => {
  const u = String(url);
  if (u.startsWith('http://llm.test') || u.startsWith('http://gw.test')) {
    seen.push({ url: u, auth: new Headers(init.headers).get('authorization'), body: JSON.parse(String(init.body)) });
    if (u.startsWith('http://llm.test')) return reply('lfm3', 'local says hi');
    return gateway(init);
  }
  return new Response(JSON.stringify({ rows: [] }), { status: 200 });
}) as typeof fetch;

const BASE: ApiEnv = { OPENROUTER_JEV_KEY: 'k', OCTO_KEY: 'k', OCTO_WORKSPACE: 'ws', OCTO_BASE: 'http://octo.test/api', SIGNING_SECRET: 's', STATE_STORE: 'memory', RATE_PER_MIN: '1000',
  DESK_URL: 'http://llm.test/v1' };
const SMART: ApiEnv = { ...BASE, DESK_HYBRID: '1', SLOT_DESK_PROVIDER: 'litellm', SLOT_DESK_MODEL: 'ih/ali/deepseek-v4.1-flash', LITELLM_URL: 'http://gw.test/v1', LITELLM_COPILOT_KEY: 'virtual-key-for-test' };
const messages = [{ role: 'system', content: 'You are the desk.' }, { role: 'user', content: 'hello there' }];
const VISITOR = 'https://copilot.example.com', DEV = 'http://localhost:8787';
const spans: SpanSpec[] = [];
const make = (env: ApiEnv) => createApi(env, { trace: s => { spans.push(s); } });
// biome-ignore lint/suspicious/noExplicitAny: a reply is whatever JSON the endpoint sent
type Reply = { status: number; headers: Headers } & Record<string, any>;
const desk = async (api: ReturnType<typeof make>, origin: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Promise<Reply> => {
  const r = await api.handle(new Request(`${origin}/api/desk`, { method: 'POST', headers, body: JSON.stringify({ messages, tools: [], ...extra }) }), '1.2.3.4');
  return { status: r.status, headers: r.headers, ...(await r.json() as object) };
};
const gatewayCalls = () => seen.filter(s => s.url.startsWith('http://gw.test'));
const reset = () => { seen = []; spans.length = 0; gateway = async () => reply('ih/ali/deepseek-v4.1-flash'); };

test('defaults change nothing: the local model answers, no smart model is on offer and none can be asked', async () => {
  reset();
  const api = make(BASE);
  const a = await desk(api, DEV);
  assert.equal(a.content, 'local says hi'); assert.equal(a.smart, false); assert.equal(a.provider, 'local'); assert.equal(a.slot, 'desk');
  const b = await desk(api, DEV, { smart: true });
  assert.equal(b.status, 409); assert.equal(b.reason, 'off');
  assert.equal(gatewayCalls().length, 0);
});

test('DESK_KEY reaches the local model as its bearer key', async () => {
  reset();
  await desk(make({ ...BASE, DESK_KEY: 'desk-key-for-test' }), VISITOR);
  assert.equal(seen[0].auth, 'Bearer desk-key-for-test');
  reset();
  await desk(make(BASE), VISITOR);
  assert.equal(seen[0].auth, null);
});

test('an ordinary visitor never gets a smart model, even when one is configured and asked for', async () => {
  reset();
  const api = make(SMART);
  const a = await desk(api, VISITOR);
  assert.equal(a.smart, false, 'the page is told not to ask');
  const b = await desk(api, VISITOR, { smart: true });
  assert.equal(b.status, 409); assert.equal(b.reason, 'scope');
  // a visitor claiming a development host from behind a proxy, or sending a wrong token, is still a visitor
  assert.equal((await desk(api, DEV, { smart: true }, { 'cf-connecting-ip': '8.8.8.8' })).reason, 'scope');
  assert.equal((await desk(api, VISITOR, { smart: true }, { 'x-owner-token': 'guess' })).reason, 'scope');
  assert.equal(gatewayCalls().length, 0, 'nothing reached the gateway');
});

test('a development host gets the smart model for a hard turn, with the slot key, and the answer says which model it was', async () => {
  reset();
  const api = make(SMART);
  const a = await desk(api, DEV);
  assert.equal(a.smart, true, 'the page may ask');
  const b = await desk(api, DEV, { smart: true });
  assert.equal(b.status, 200); assert.equal(b.content, 'smart says hi'); assert.equal(b.model, 'ih/ali/deepseek-v4.1-flash'); assert.equal(b.provider, 'litellm');
  const g = gatewayCalls();
  assert.equal(g.length, 1); assert.equal(g[0].auth, 'Bearer virtual-key-for-test'); assert.equal(g[0].body.model, 'ih/ali/deepseek-v4.1-flash');
  assert.equal(g[0].body.chat_template_kwargs, undefined, 'a hosted model is not sent the local template switch');
  for (const h of ['localhost', '127.0.0.1', 'copilot.test', 'x.localhost']) assert.equal((await desk(api, `http://${h}:1`)).smart, true, h);
  assert.equal((await desk(make({ ...SMART, SMART_DEV_HOSTS: 'dev.lan' }), 'http://dev.lan')).smart, true, 'SMART_DEV_HOSTS adds a host');
});

test('DESK_HYBRID off or a missing key turns the smart model off even on a development host', async () => {
  reset();
  assert.equal((await desk(make({ ...SMART, DESK_HYBRID: '' }), DEV, { smart: true })).reason, 'off');
  assert.equal((await desk(make({ ...SMART, LITELLM_COPILOT_KEY: '' }), DEV, { smart: true })).reason, 'no-key');
  assert.equal(gatewayCalls().length, 0);
});

test('the owner: a token in a header or the cookie, only with the owner switch on, set by /api/owner', async () => {
  reset();
  const OWN: ApiEnv = { ...SMART, SMART_OWNER: '1', OWNER_TOKEN: 'owner-secret-for-test' };
  const api = make(OWN);
  assert.equal((await desk(api, VISITOR, { smart: true }, { 'x-owner-token': 'owner-secret-for-test' })).status, 200);
  assert.equal((await desk(api, VISITOR, { smart: true }, { cookie: 'a=b; copilot_owner=owner-secret-for-test' })).status, 200);
  assert.equal((await desk(api, VISITOR, { smart: true }, { cookie: 'copilot_owner=wrong' })).reason, 'scope');
  // the switch is off (or no token is set): the right token means nothing, and /api/owner does not exist
  const off = make({ ...SMART, OWNER_TOKEN: 'owner-secret-for-test' });
  assert.equal((await desk(off, VISITOR, { smart: true }, { 'x-owner-token': 'owner-secret-for-test' })).reason, 'scope');
  const post = (a: ReturnType<typeof make>, token: unknown) => a.handle(new Request(`${VISITOR}/api/owner`, { method: 'POST', body: JSON.stringify({ token }) }), '7.7.7.7');
  assert.equal((await post(off, 'owner-secret-for-test')).status, 404);
  const ok = await post(api, 'owner-secret-for-test');
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('set-cookie')!;
  assert.match(cookie, /^copilot_owner=owner-secret-for-test; /); assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Lax/);
  assert.equal((await post(api, 'wrong')).status, 403);
  assert.match((await post(api, '')).headers.get('set-cookie')!, /Max-Age=0/);
});

test('wrong owner tokens are limited to ten an hour per visitor', async () => {
  reset();
  const api = make({ ...SMART, SMART_OWNER: '1', OWNER_TOKEN: 'owner-secret-for-test' });
  const post = (token: string) => api.handle(new Request(`${VISITOR}/api/owner`, { method: 'POST', body: JSON.stringify({ token }) }), '6.6.6.6');
  for (let i = 0; i < 10; i++) assert.equal((await post(`guess${i}`)).status, 403);
  assert.equal((await post('guess11')).status, 429);
});

test('the daily cap stops smart calls and tells the page to stop asking', async () => {
  reset();
  const api = make({ ...SMART, SLOT_DESK_DAILY_CAP: '2' });
  assert.equal((await desk(api, DEV, { smart: true })).status, 200);
  const second = await desk(api, DEV, { smart: true });
  assert.equal(second.status, 200); assert.equal(second.smart, false, 'the last call under the cap says the next one is refused');
  const third = await desk(api, DEV, { smart: true });
  assert.equal(third.status, 409); assert.equal(third.reason, 'cap');
  assert.equal((await desk(api, DEV)).smart, false);
  assert.equal(gatewayCalls().length, 2);
});

test('a smart model that is too slow loses the turn within its timeout (the local answer stands)', async () => {
  reset();
  gateway = init => new Promise((_, no) => init.signal?.addEventListener('abort', () => no(init.signal!.reason)));
  const api = make({ ...SMART, SLOT_DESK_TIMEOUT_MS: '500' });
  const t0 = Date.now();
  const r = await desk(api, DEV, { smart: true });
  assert.equal(r.status, 409); assert.equal(r.reason, 'timeout');
  assert.ok(Date.now() - t0 < 2000, 'gave up at the timeout, not later');
  assert.equal((await desk(api, DEV)).content, 'local says hi', 'the local model is untouched');
});

test('a smart model that errors is a refusal the page survives, and it is not retried as a different model', async () => {
  reset();
  gateway = async () => new Response('boom', { status: 400 });
  const r = await desk(make(SMART), DEV, { smart: true });
  assert.equal(r.status, 409); assert.equal(r.reason, 'error');
});

test('an answer whose reported model is Claude or Gemma is dropped, whatever the gateway mapped the name to', async () => {
  for (const name of ['claude-sonnet-5', 'google/gemma-3-27b']) {
    reset();
    gateway = async () => reply(name, 'must not be used');
    const r = await desk(make(SMART), DEV, { smart: true });
    assert.equal(r.status, 409); assert.equal(r.reason, 'banned-model'); assert.equal(r.content, undefined);
  }
});

test('a banned or misspelt slot stops the server from starting, naming the slot', () => {
  assert.throws(() => make({ ...SMART, SLOT_DESK_MODEL: 'ih/ali/claude-opus' }), /"desk".*not allowed/);
  assert.throws(() => make({ ...SMART, SLOT_EVAL_PROVIDER: 'nope' }), /"eval".*unknown provider/);
});

test('every desk span carries the slot, provider, scope and model, for local answers and refused or smart escalations alike', async () => {
  reset();
  const api = make(SMART);
  await desk(api, DEV);
  await desk(api, DEV, { smart: true });
  await desk(api, VISITOR, { smart: true });
  await new Promise(r => setTimeout(r, 30));
  const a = spans.filter(s => s.name === 'desk').map(s => s.attributes!);
  assert.equal(a.length, 3);
  assert.deepEqual([a[0]['llm.model_name'], a[0]['copilot.slot'], a[0]['copilot.provider'], a[0]['copilot.scope']], ['lfm3', 'desk', 'local', 'dev-host']);
  assert.deepEqual([a[1]['llm.model_name'], a[1]['copilot.slot'], a[1]['copilot.provider'], a[1]['copilot.escalation']], ['ih/ali/deepseek-v4.1-flash', 'desk', 'litellm', 'smart']);
  assert.deepEqual([a[2]['copilot.smart_refused'], a[2]['copilot.scope']], ['scope', 'visitor']);
});
