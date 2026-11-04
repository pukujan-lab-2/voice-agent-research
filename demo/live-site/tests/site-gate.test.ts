// Who may use a business's copilot (#125): its own site as before; another site only with that business's public
// site key and from one of the origins its config lists. Octo's SQL is stubbed at fetch; the businesses are in memory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../api.ts';
import { voiceToken, VOICE_TOKEN_S } from '../server.ts';
import type { Sites, SiteConfig } from '../../../copilot-engine/src/site-config.ts';

globalThis.fetch = (async () => new Response(JSON.stringify({ rows: [] }), { status: 200 })) as unknown as typeof fetch;

const KEY_A = 'pk_' + 'a'.repeat(24), KEY_B = 'pk_' + 'b'.repeat(24);
const known: Record<string, SiteConfig> = {
  acme: { site: { key: KEY_A, origins: ['https://www.acme.test'] }, desk: { greeting: 'Hello from Acme' } },
  harbor: { site: { key: KEY_B, origins: ['https://harbor.test'] } },
  plain: {},
};
const sites: Sites = {
  get: async b => known[b] ?? null,
  byKey: async k => { const e = Object.entries(known).find(([, c]) => c.site?.key === k); return e ? { business: e[0], config: e[1] } : null; },
  knowsOrigin: async o => Object.values(known).some(c => c.site?.origins?.includes(o)),
};
const api = createApi({ OPENROUTER_JEV_KEY: 'k', OCTO_KEY: 'k', OCTO_WORKSPACE: 'ws', OCTO_BASE: 'http://octo.test/api', SIGNING_SECRET: 's', SITE_ORIGINS: 'https://copilot.test' }, { sites });
const config = (business: string, headers: Record<string, string> = {}) =>
  api.handle(new Request(`https://copilot.test/api/copilot/config?business=${business}`, { headers }), '9.9.9.9');

test('the copilot\'s own site works as before, with or without an Origin header', async () => {
  assert.equal((await config('acme')).status, 200, 'no Origin (a same-site GET, or a tool)');
  assert.equal((await config('acme', { origin: 'https://copilot.test' })).status, 200, 'one of SITE_ORIGINS');
  const own = await api.handle(new Request('http://localhost:8787/api/copilot/config?business=acme', { headers: { origin: 'http://localhost:8787' } }), '9.9.9.9');
  assert.equal(own.status, 200, 'the request\'s own host');
  assert.equal(own.headers.get('access-control-allow-origin'), null, 'no cross-site headers for its own site');
});

test('another site is refused unless it brings its business\'s key from a listed origin', async () => {
  assert.equal((await config('acme', { origin: 'https://evil.test' })).status, 403, 'unregistered origin, no key');
  assert.equal((await config('acme', { origin: 'https://evil.test', 'x-site-key': KEY_A })).status, 403, 'right key, wrong origin');
  assert.equal((await config('acme', { origin: 'https://www.acme.test' })).status, 403, 'listed origin, no key');
  assert.equal((await config('acme', { origin: 'https://www.acme.test', 'x-site-key': 'pk_' + 'z'.repeat(24) })).status, 403, 'unknown key');
  assert.equal((await config('acme', { origin: 'https://www.acme.test', 'x-site-key': KEY_B })).status, 403, 'another business\'s key');
  const ok = await config('acme', { origin: 'https://www.acme.test', 'x-site-key': KEY_A });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://www.acme.test', 'allowed for that origin only');
  assert.match(ok.headers.get('vary') ?? '', /Origin/);
});

test('a key for one business cannot act for another', async () => {
  const r = await config('harbor', { origin: 'https://www.acme.test', 'x-site-key': KEY_A });
  assert.equal(r.status, 403, 'a query naming another business');
  const s = await api.handle(new Request('https://copilot.test/api/session', { method: 'POST', headers: { origin: 'https://www.acme.test', 'x-site-key': KEY_A },
    body: JSON.stringify({ op: 'get', business: 'harbor', id: 'abcdefgh12' }) }), '9.9.9.9');
  assert.equal(s.status, 403, 'a body naming another business');
});

test('a preflight is answered only for an origin some business lists', async () => {
  const pre = (origin: string) => api.handle(new Request('https://copilot.test/api/desk', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } }), '9.9.9.9');
  const ok = await pre('https://harbor.test');
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://harbor.test');
  assert.match(ok.headers.get('access-control-allow-headers') ?? '', /x-site-key/);
  const no = await pre('https://evil.test');
  assert.equal(no.status, 403);
  assert.equal(no.headers.get('access-control-allow-origin'), null, 'no allow headers for an unregistered origin');
});

test('the socket check: an origin some business lists passes, any other is refused', async () => {
  const sock = (origin: string) => api.gate(new Request('http://local/', { method: 'OPTIONS', headers: { origin } }));
  assert.equal((await sock('https://www.acme.test')).ok, true);
  assert.equal((await sock('https://evil.test')).ok, false);
  assert.equal((await sock('https://copilot.test')).ok, true, 'its own site');
});

test('a voice token can be used to join for ten minutes, by a caller with a random id', () => {
  const a = voiceToken(), b = voiceToken();
  const claims = (t: string) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()) as { exp: number; nbf: number; sub: string };
  const c = claims(a.token);
  assert.equal(VOICE_TOKEN_S, 600);
  assert.ok(c.exp - c.nbf <= VOICE_TOKEN_S + 5, `exp is ${c.exp - c.nbf} s after nbf`);
  assert.notEqual(c.sub, claims(b.token).sub, 'caller ids are random');
});
