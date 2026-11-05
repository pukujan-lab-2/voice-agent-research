// The business's own access page's backend (#131): Octo sign-in, the live membership check on every request, grants,
// and opening a raw call through the log. Octo's OAuth server is stood in for; the tables are real Postgres (PGlite).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccess } from '../access-api.ts';
import type { OctoSignIn } from '../../../copilot-engine/src/octo-signin.ts';
import { pgSql } from '../../../copilot-engine/tests/pg-sql.ts';

const SITE = 'https://copilot.example';
const people: Record<string, { principal: string; email: string; workspace: string | null; role: string | null }> = {
  'tok-owner': { principal: 'p1', email: 'owner@biz.example', workspace: 'ws-biz', role: 'owner' },
  'tok-reader': { principal: 'p2', email: 'reader@biz.example', workspace: 'ws-biz', role: 'member' },
  'tok-elsewhere': { principal: 'p3', email: 'x@other.example', workspace: 'ws-other', role: 'owner' },
};

async function setup() {
  const { sql } = await pgSql();
  const opened: string[] = [];
  const octo = {
    async start(state: string) { return { url: `https://octo.example/oauth/authorize?state=${state}`, verifier: 'v' }; },
    async finish(code: string) { return { token: code, until: Date.now() + 3_600_000 }; },
    async me(token: string) { const p = people[token]; if (!p) throw new Error('octo /api/me: 401'); return { ...p }; },
    async members() { return { members: [{ email: 'owner@biz.example', role: 'owner' }], pending: [] }; },
  } as unknown as OctoSignIn;
  const access = createAccess({
    octo: 'https://octo.example', own: [SITE], host: () => 'copilot.example', clients: { get: async () => undefined, set: async () => {} },
    workspaceOf: async b => (b === 'biz' ? 'ws-biz' : undefined), sqlAt: () => sql, log: () => {}, signIn: () => octo,
    record: async (_b, call) => { opened.push(call); return [{ entry: { said: 'hello' } }]; },
    audio: async () => null,
  });
  // Signs a person in through the whole redirect dance and returns their cookie.
  const signIn = async (token: string) => {
    const login = await access.handle(new Request(`http://local/api/access/login?business=biz`));
    assert.equal(login.status, 302);
    const state = new URL(login.headers.get('location')!).searchParams.get('state')!;
    const back = await access.handle(new Request(`http://local/api/access/callback?state=${state}&code=${token}`));
    assert.equal(back.status, 302);
    return back.headers.get('set-cookie')?.split(';')[0] ?? '';
  };
  const post = (cookie: string, path: string, body: unknown, headers: Record<string, string> = { 'x-access': '1' }) =>
    access.handle(new Request(`http://local/api/access/${path}`, { method: 'POST', headers: { cookie, ...headers }, body: JSON.stringify({ business: 'biz', ...body as object }) }));
  const state = (cookie: string) => access.handle(new Request('http://local/api/access/state?business=biz', { headers: { cookie } }));
  return { signIn, post, state, opened };
}

test('a member opens a call only with a grant, and the business sees it in the log', async () => {
  const { signIn, post, state, opened } = await setup();
  const owner = await signIn('tok-owner'), reader = await signIn('tok-reader');
  assert.ok(owner.startsWith('copilot_access=') && owner !== reader);
  assert.equal((await post(reader, 'open', { call: 'call-1' })).status, 403);
  assert.equal((await post(reader, 'grant', { email: 'reader@biz.example', calls: null, purpose: 'self', until: new Date(Date.now() + 86_400_000) })).status, 403);
  const g = await post(owner, 'grant', { email: 'reader@biz.example', calls: ['call-1'], purpose: 'complaint review', until: new Date(Date.now() + 86_400_000) });
  assert.equal(g.status, 200);
  const r = await post(reader, 'open', { call: 'call-1' });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).entries, [{ entry: { said: 'hello' } }]);
  assert.deepEqual(opened, ['call-1']);
  const s = await (await state(owner)).json();
  assert.deepEqual(s.members.members.map((m: { email: string }) => m.email), ['owner@biz.example']);
  assert.deepEqual(s.log.map((e: { action: string; email: string; ok: boolean }) => [e.action, e.email, e.ok]),
    [['read record', 'reader@biz.example', true], ['grant', 'owner@biz.example', true], ['read record', 'reader@biz.example', false]]);
  // a reader sees their own grants, not the members or the log
  const mine = await (await state(reader)).json();
  assert.equal(mine.members, null); assert.equal(mine.log, null); assert.equal(mine.grants.length, 1);
});

test('someone removed from the workspace is out at once; another workspace never gets in', async () => {
  const { signIn, post } = await setup();
  const reader = await signIn('tok-reader'), owner = await signIn('tok-owner');
  await post(owner, 'grant', { email: 'reader@biz.example', calls: null, purpose: 'audit', until: new Date(Date.now() + 86_400_000) });
  assert.equal((await post(reader, 'open', { call: 'call-2' })).status, 200);
  people['tok-reader'].role = null;  // Octo: removed from the workspace
  try { assert.equal((await post(reader, 'open', { call: 'call-2' })).status, 403); } finally { people['tok-reader'].role = 'member'; }
  const elsewhere = await signIn('tok-elsewhere');
  assert.equal(elsewhere, '');  // picked another workspace: no session
});

test('POSTs need the x-access header and a session; other hosts are refused', async () => {
  const { signIn, post } = await setup();
  const owner = await signIn('tok-owner');
  assert.equal((await post(owner, 'open', { call: 'call-1' }, {})).status, 403);
  assert.equal((await post('copilot_access=nope', 'open', { call: 'call-1' })).status, 401);
  const other = createAccess({ octo: 'https://octo.example', own: [SITE], host: () => 'evil.example', clients: { get: async () => undefined, set: async () => {} },
    workspaceOf: async () => 'ws-biz', sqlAt: () => { throw new Error('unused'); }, log: () => {}, record: async () => [], audio: async () => null });
  assert.equal((await other.handle(new Request('http://local/api/access/login?business=biz'))).status, 403);
});
