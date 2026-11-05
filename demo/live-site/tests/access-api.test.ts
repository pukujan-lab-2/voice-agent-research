// The business's own access page's backend (#131): Octo sign-in, the live membership check on every request, grants,
// and opening a raw call through the log. Octo's OAuth server is stood in for; the tables are real Postgres (PGlite).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccess } from '../access-api.ts';
import { OctoError, OctoSignIn } from '../../../copilot-engine/src/octo-signin.ts';
import { pgSql } from '../../../copilot-engine/tests/pg-sql.ts';

const SITE = 'https://copilot.example';
const people: Record<string, { principal: string; email: string; workspace: string | null; role: string | null }> = {
  'tok-owner': { principal: 'p1', email: 'owner@biz.example', workspace: 'ws-biz', role: 'owner' },
  'tok-reader': { principal: 'p2', email: 'reader@biz.example', workspace: 'ws-biz', role: 'member' },
  'tok-elsewhere': { principal: 'p3', email: 'x@other.example', workspace: 'ws-other', role: 'owner' },
};

async function setup() {
  const { sql } = await pgSql();
  const opened: string[] = [], scopes: string[] = [], changes: unknown[] = [];
  const codes = new Set<string>();
  const octo = {
    async start(state: string, scope = 'read') { scopes.push(scope); return { url: `https://octo.example/oauth/authorize?state=${state}`, verifier: 'v' }; },
    async finish(code: string) { return { token: code, until: Date.now() + 3_600_000 }; },
    async me(token: string) { const p = people[token]; if (!p) throw new Error('octo /api/me: 401'); return { ...p }; },
    async members() { return { members: [{ email: 'owner@biz.example', role: 'owner' }], pending: [] }; },
    // Octo's one-time code: good once (octo-database#86)
    async memberCode() { const code = `C${codes.size}X`; codes.add(code); return { code, expiresAt: new Date(Date.now() + 600_000).toISOString(), mfaRequired: false }; },
    async changeMember(_t: string, ws: string, op: string, m: { email: string; role?: string; code: string }) {
      if (!codes.delete(m.code)) throw new OctoError(403, 'octo /api/workspaces/:id/members: 403 bad code');
      if (op === 'remove' && m.email !== 'reader@biz.example') throw new OctoError(404, 'octo /api/workspaces/:id/members: 404 MEMBER_NOT_FOUND');
      changes.push({ ws, op, ...m });
      return op === 'add' ? { status: 'pending' } : { removed: true };
    },
  } as unknown as OctoSignIn;
  const access = createAccess({
    octo: 'https://octo.example', own: [SITE], host: () => 'copilot.example', clients: { get: async () => undefined, set: async () => {} },
    workspaceOf: async b => (b === 'biz' ? 'ws-biz' : undefined), sqlAt: () => sql, log: () => {}, signIn: () => octo,
    record: async (_b, call) => { opened.push(call); return [{ entry: { said: 'hello' } }]; },
    audio: async () => null,
  });
  // Signs a person in through the whole redirect dance and returns their cookie.
  const signIn = async (token: string, manage = false) => {
    const login = await access.handle(new Request(`http://local/api/access/login?business=biz${manage ? '&manage=1' : ''}`));
    assert.equal(login.status, 302);
    const state = new URL(login.headers.get('location')!).searchParams.get('state')!;
    const back = await access.handle(new Request(`http://local/api/access/callback?state=${state}&code=${token}`));
    assert.equal(back.status, 302);
    return back.headers.get('set-cookie')?.split(';')[0] ?? '';
  };
  const post = (cookie: string, path: string, body: unknown, headers: Record<string, string> = { 'x-access': '1' }) =>
    access.handle(new Request(`http://local/api/access/${path}`, { method: 'POST', headers: { cookie, ...headers }, body: JSON.stringify({ business: 'biz', ...body as object }) }));
  const state = (cookie: string) => access.handle(new Request('http://local/api/access/state?business=biz', { headers: { cookie } }));
  return { signIn, post, state, opened, scopes, changes };
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

test('the owner adds and removes members with Octo\'s one-time code, and each try is logged', async () => {
  const { signIn, post, state, scopes, changes } = await setup();
  const reading = await signIn('tok-owner');
  assert.deepEqual(scopes, ['read']);
  assert.equal((await (await state(reading)).json()).canManage, false);
  const r = await post(reading, 'member-code', {});
  assert.equal(r.status, 401);
  assert.equal((await r.json()).manage, true);

  const owner = await signIn('tok-owner', true);
  assert.equal(scopes[1], 'read write delete');
  assert.equal((await (await state(owner)).json()).canManage, true);
  const { code } = await (await post(owner, 'member-code', {})).json();
  const add = await post(owner, 'member', { op: 'add', email: 'New@Biz.example', role: 'operator', code });
  assert.equal(add.status, 200);
  assert.deepEqual(changes, [{ ws: 'ws-biz', op: 'add', email: 'new@biz.example', role: 'operator', code, mfaCode: undefined }]);
  // a code is good once
  assert.equal((await post(owner, 'member', { op: 'add', email: 'again@biz.example', code })).status, 403);
  const c2 = (await (await post(owner, 'member-code', {})).json()).code;
  assert.equal((await post(owner, 'member', { op: 'remove', email: 'nobody@biz.example', code: c2 })).status, 404);
  const c3 = (await (await post(owner, 'member-code', {})).json()).code;
  assert.equal((await post(owner, 'member', { op: 'remove', email: 'reader@biz.example', code: c3 })).status, 200);
  assert.equal((await post(owner, 'member', { op: 'add', email: 'x@biz.example', role: 'owner', code: 'C9X' })).status, 400);

  const log = (await (await state(owner)).json()).log.filter((e: { action: string }) => e.action.startsWith('member'));
  assert.deepEqual(log.map((e: { action: string; email: string; reason: string; ok: boolean }) => [e.action, e.email, e.reason, e.ok]), [
    ['member remove', 'owner@biz.example', 'reader@biz.example', true],
    ['member remove', 'owner@biz.example', 'nobody@biz.example: refused by Octo (404)', false],
    ['member add', 'owner@biz.example', 'again@biz.example as member: refused by Octo (403)', false],
    ['member add', 'owner@biz.example', 'new@biz.example as operator (pending)', true],
  ]);
});

test('a plain member never gets a code, even signed in to manage', async () => {
  const { signIn, post, changes } = await setup();
  const reader = await signIn('tok-reader', true);
  assert.equal((await post(reader, 'member-code', {})).status, 403);
  assert.equal((await post(reader, 'member', { op: 'remove', email: 'owner@biz.example', code: 'C0X' })).status, 403);
  assert.deepEqual(changes, []);
});

test('the Octo client asks for the manage scope and sends the code as confirmSecret', async () => {
  const sent: { url: string; method: string; body?: string; auth?: string }[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    sent.push({ url: String(url), method: init.method ?? 'GET', body: init.body ? String(init.body) : undefined, auth: (init.headers as Record<string, string> | undefined)?.authorization });
    const u = new URL(String(url));
    const body = u.pathname === '/.well-known/oauth-protected-resource' ? { resource: 'https://octo.example/mcp' }
      : u.pathname === '/oauth/register' ? { client_id: 'client-1' }
      : u.pathname.endsWith('/confirm-challenge') ? { code: 'ABC123', expiresAt: '2026-11-05T01:00:00Z', mfaRequired: true }
      : { status: 'added' };
    return new Response(JSON.stringify(body), { status: u.pathname.endsWith('/members') ? 201 : 200 });
  }) as typeof fetch;
  try {
    const o = new OctoSignIn({ octo: 'https://octo.example/api', redirect: `${SITE}/api/access/callback`, store: { get: async () => undefined, set: async () => {} } });
    const { url } = await o.start('st', 'read write delete');
    assert.equal(new URL(url).searchParams.get('scope'), 'read write delete');
    assert.deepEqual(await o.memberCode('tok', 'ws 1'), { code: 'ABC123', expiresAt: '2026-11-05T01:00:00Z', mfaRequired: true });
    await o.changeMember('tok', 'ws 1', 'add', { email: 'a@b.example', role: 'admin', code: 'ABC123', mfaCode: '123456' });
    await o.changeMember('tok', 'ws 1', 'remove', { email: 'a@b.example', role: 'admin', code: 'XYZ789' });
    const [challenge, add, remove] = sent.slice(-3);
    assert.deepEqual([challenge.method, challenge.url, challenge.auth], ['POST', 'https://octo.example/api/workspaces/ws%201/members/confirm-challenge', 'Bearer tok']);
    assert.deepEqual([add.method, JSON.parse(add.body!)], ['POST', { email: 'a@b.example', role: 'admin', confirmSecret: 'ABC123', mfaCode: '123456' }]);
    assert.deepEqual([remove.method, JSON.parse(remove.body!)], ['DELETE', { email: 'a@b.example', confirmSecret: 'XYZ789' }]);
  } finally { globalThis.fetch = real; }
});
