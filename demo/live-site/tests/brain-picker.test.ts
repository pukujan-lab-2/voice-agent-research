// The Brain picker on the live backend (#97): the options list is built per request scope (a visitor sees the local model
// only), the pick rides on /api/desk, the server enforces scope (a picked smart brain without scope falls back to the local
// model, which answers), and the desk span records the pick. Nothing leaves the machine: the models are stubbed at fetch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, type ApiEnv } from '../api.ts';
import type { SpanSpec } from '../tracing.ts';

type Seen = { url: string; body: Record<string, any> };
let seen: Seen[] = [];
let gateway: (init: RequestInit) => Promise<Response> = async () => reply('cb/deepseek-v4.1-flash');
const reply = (model: string, content = 'smart says hi') => new Response(JSON.stringify({ model, choices: [{ message: { content } }] }), { status: 200 });
globalThis.fetch = (async (url: string | URL, init: RequestInit = {}) => {
  const u = String(url);
  if (u.startsWith('http://llm.test') || u.startsWith('http://gw.test')) {
    seen.push({ url: u, body: JSON.parse(String(init.body)) });
    if (u.startsWith('http://llm.test')) return reply('lfm3', 'local says hi');
    return gateway(init);
  }
  return new Response(JSON.stringify({ rows: [] }), { status: 200 });
}) as typeof fetch;

const BASE: ApiEnv = { OPENROUTER_JEV_KEY: 'k', OCTO_KEY: 'k', OCTO_WORKSPACE: 'ws', OCTO_BASE: 'http://octo.test/api', SIGNING_SECRET: 's', STATE_STORE: 'memory', RATE_PER_MIN: '1000',
  DESK_URL: 'http://llm.test/v1' };
const SMART: ApiEnv = { ...BASE, DESK_HYBRID: '1', SLOT_DESK_PROVIDER: 'inferhub', SLOT_DESK_MODEL: 'deepseek-v4.1-flash', INFERHUB_BASE_URL: 'http://gw.test/v1', INFERHUB_API_KEY: 'lease-key-for-test' };
const messages = [{ role: 'system', content: 'You are the desk.' }, { role: 'user', content: 'hello there' }];
const VISITOR = 'https://copilot.example.com', DEV = 'http://localhost:8787';
const spans: SpanSpec[] = [];
const make = (env: ApiEnv) => createApi(env, { trace: s => { spans.push(s); } });
type Reply = { status: number; headers: Headers } & Record<string, any>;
const post = async (api: ReturnType<typeof make>, path: string, origin: string, body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<Reply> => {
  const r = await api.handle(new Request(`${origin}${path}`, { method: 'POST', headers, body: JSON.stringify(body) }), '1.2.3.4');
  return { status: r.status, headers: r.headers, ...(await r.json() as object) };
};
const brain = (api: ReturnType<typeof make>, origin: string, body: Record<string, unknown> = {}, headers: Record<string, string> = {}) => post(api, '/api/brain/options', origin, body, headers);
const desk = (api: ReturnType<typeof make>, origin: string, body: Record<string, unknown> = {}, headers: Record<string, string> = {}) => post(api, '/api/desk', origin, { messages, tools: [], ...body }, headers);
const gatewayCalls = () => seen.filter(s => s.url.startsWith('http://gw.test'));
const reset = () => { seen = []; spans.length = 0; gateway = async () => reply('cb/deepseek-v4.1-flash'); };

test('a visitor is offered the local model only; the pick echoes back as local', async () => {
  reset();
  const api = make(SMART);
  const o = await brain(api, VISITOR);
  assert.deepEqual(o.options, [{ id: 'local', label: 'LFM3 (local, default)', smart: false }]);
  assert.equal(o.pick, 'local');
  assert.equal(o.scope, 'visitor');
  // a picked smart brain the scope refuses: the server echoes local (and, below, still answers locally)
  const picked = await brain(api, VISITOR, { brain: 'smart' });
  assert.equal(picked.pick, 'local');
});

test('a development host is offered the smart options, and the owner cookie too', async () => {
  reset();
  const OWN = { ...SMART, SMART_OWNER: '1', OWNER_TOKEN: 'owner-secret-for-test' };
  const api = make(OWN);
  const dev = await brain(api, DEV);
  assert.equal(dev.scope, 'dev-host');
  assert.deepEqual(dev.options.map((o: any) => o.id), ['local', 'smart', 'smart-always']);
  assert.match(dev.options[1].label, /deepseek-v4.1-flash/);
  const owner = await brain(api, VISITOR, {}, { cookie: 'copilot_owner=owner-secret-for-test' });
  assert.equal(owner.scope, 'owner');
  assert.equal(owner.options.length, 3);
  // the switches off: nobody sees a smart option, not even a development host
  const off = await brain(make(BASE), DEV);
  assert.deepEqual(off.options.map((o: any) => o.id), ['local']);
});

test('a picked smart brain answers from the gateway; smart-always too; the span records the pick', async () => {
  reset();
  const api = make(SMART);
  const a = await desk(api, DEV, { brain: 'smart' });
  assert.equal(a.status, 200); assert.equal(a.content, 'smart says hi'); assert.equal(a.provider, 'inferhub');
  assert.equal(gatewayCalls().length, 1);
  const b = await desk(api, DEV, { brain: 'smart-always' });
  assert.equal(b.content, 'smart says hi'); assert.equal(b.provider, 'inferhub');
  assert.equal(gatewayCalls().length, 2);
  await new Promise(r => setTimeout(r, 30));
  const s = spans.filter(s => s.name === 'desk').map(s => s.attributes!);
  assert.equal(s.length, 2);
  assert.equal(s[0]['copilot.brain'], 'smart');
  assert.equal(s[1]['copilot.brain'], 'smart-always');
  assert.equal(s[0]['llm.model_name'], 'cb/deepseek-v4.1-flash');
});

test('a picked smart brain without scope falls back to the local model, which answers, and no 409 is raised', async () => {
  reset();
  const api = make(SMART);
  const r = await desk(api, VISITOR, { brain: 'smart-always' });
  assert.equal(r.status, 200); assert.equal(r.content, 'local says hi'); assert.equal(r.provider, 'local');
  assert.equal(gatewayCalls().length, 0, 'nothing reached the gateway');
  await new Promise(res => setTimeout(res, 30));
  const s = spans.find(s => s.name === 'desk')!.attributes!;
  assert.equal(s['copilot.brain'], 'smart-always', 'the span keeps the pick');
  assert.equal(s['llm.model_name'], 'lfm3', 'and the model that really answered');
});

test('a smart failure with a picked brain falls back to the local answer instead of erroring the turn', async () => {
  reset();
  gateway = async () => new Response('boom', { status: 400 });
  const api = make(SMART);
  const r = await desk(api, DEV, { brain: 'smart' });
  assert.equal(r.status, 200); assert.equal(r.content, 'local says hi'); assert.equal(r.provider, 'local');
});

test('the old smart: true escalation keeps its contract (a 409 the page already handles)', async () => {
  reset();
  const api = make(SMART);
  assert.equal((await desk(api, VISITOR, { smart: true })).status, 409);
  assert.equal((await desk(api, DEV, { smart: true })).content, 'smart says hi');
});

test('the pick changes which model answers with a stub slot file provider, as the acceptance asks', async () => {
  reset();
  // the workbuddy slot, streamed, points at a stub server: the same desk turn, a different provider and answer
  const WORK: ApiEnv = { ...BASE, DESK_HYBRID: '1', SLOT_DESK_PROVIDER: 'workbuddy', SLOT_DESK_MODEL: 'deepseek-v4.1-flash', WORKBUDDY_URL: 'http://gw.test/v2', WORKBUDDY_KEY: 'k', SMART_DEV_HOSTS: '' };
  const api = make(WORK);
  const streamed = async (_init: RequestInit) => new Response(JSON.stringify({ model: 'deepseek-v4.1-flash', choices: [{ delta: { content: 'streamed says hi' } }, { finish_reason: 'stop' }] }), { status: 200 });
  gateway = streamed;
  const local = await desk(api, VISITOR);
  assert.equal(local.provider, 'local');
  const smart = await desk(api, DEV, { brain: 'smart' });
  assert.equal(smart.provider, 'workbuddy');
  assert.notEqual(local.model, smart.model);
});

test('no secret in any response: the options name the model, never the key', async () => {
  reset();
  const api = make(SMART);
  const o = await brain(api, DEV);
  const text = JSON.stringify(o);
  assert.ok(!text.includes('lease-key-for-test'));
  assert.ok(!text.includes('INFERHUB_API_KEY'));
});
