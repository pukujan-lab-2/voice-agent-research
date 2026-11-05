// The business's own access to its raw calls (#131), at /api/access/*, for the page /business/access:
//   GET  /api/access/login?business=   sends the person to Octo to sign in and pick the business's workspace
//   GET  /api/access/callback          Octo sends them back here; a session cookie is set, the token stays on the server
//   GET  /api/access/state?business=   who they are, the workspace's members (owner or admin), the grants and the access log
//   POST /api/access/grant             { business, email, calls: [..] | null, purpose, until } (owner or admin)
//   POST /api/access/revoke            { business, id } (owner or admin)
//   POST /api/access/open              { business, call, emergency? } a call's record, through RawAccess.open (logged first)
//   POST /api/access/audio             { business, call, emergency? } a call's recording, the same way
//   POST /api/access/member-code       { business } Octo's one-time code for adding or removing a member (owner or admin)
//   POST /api/access/member            { business, op: add | remove, email, role?, code, mfaCode? } through Octo's member routes
//   POST /api/access/logout
// Every request asks Octo again who the person is and their live role in the business's workspace, so a removed member
// is out at once. Nothing opens before that check and the log entry. Adding and removing members goes to Octo's own member
// routes (octo-database#83) with the owner's or admin's token, signed in for it with `read write delete` (login?manage=1),
// and the one-time code Octo gives that token (#86), typed back by the person. Each try is in the access log.
// POSTs need the header x-access: 1, which another site can't send without a preflight this server never answers.
import { AccessDenied, RawAccess, ROLES, type Role, type Who } from '../../copilot-engine/src/raw-access.ts';
import { OctoError, OctoSignIn, type ClientStore, type MemberRole, type OctoMe } from '../../copilot-engine/src/octo-signin.ts';
import type { Sql } from '../../copilot-engine/src/octo-store.ts';
import { BUSINESS_ID } from '../../copilot-engine/src/site-config.ts';

export type AccessDeps = {
  octo: string;                                    // Octo's origin
  own: string[];                                   // the copilot's own origins; the sign-in returns to one of them
  host: (req: Request) => string;                  // the host the visitor asked for
  workspaceOf: (business: string) => Promise<string | undefined>;
  sqlAt: (workspace: string) => Sql;
  clients: ClientStore;
  record: (business: string, call: string) => Promise<unknown>;
  audio: (business: string, call: string) => Promise<{ audio: Uint8Array; mime: string } | null>;
  log: (msg: string) => void;
  signIn?: (redirect: string) => OctoSignIn;       // tests stand in for Octo here
};

const COOKIE = 'copilot_access';
const SESSION_MS = 3_600_000, PENDING_MS = 600_000, MAX_SESSIONS = 5_000;
const CALL = /^[\w.-]{1,64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEMBER_ROLES: MemberRole[] = ['admin', 'operator', 'member'];
const MANAGE_SCOPE = 'read write delete';
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
const token = () => [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');

// Capped maps with a time limit: state that outlives a request never grows without bound.
class Expiring<T> {
  private m = new Map<string, { v: T; until: number }>();
  private max: number;
  constructor(max: number) { this.max = max; }
  get(k: string): T | undefined { const e = this.m.get(k); if (!e) return; if (e.until < Date.now()) { this.m.delete(k); return; } return e.v; }
  set(k: string, v: T, ms: number) { if (this.m.size >= this.max) this.m.delete(this.m.keys().next().value!); this.m.set(k, { v, until: Date.now() + ms }); }
  take(k: string): T | undefined { const v = this.get(k); this.m.delete(k); return v; }
  delete(k: string) { this.m.delete(k); }
}

export function createAccess(d: AccessDeps) {
  const pending = new Expiring<{ business: string; verifier: string; origin: string; manage: boolean }>(MAX_SESSIONS);
  const sessions = new Expiring<{ token: string; business: string; manage: boolean }>(MAX_SESSIONS);
  const signers = new Map<string, OctoSignIn>();
  const signer = (origin: string) => {
    const redirect = `${origin}/api/access/callback`;
    let s = signers.get(redirect);
    if (!s) signers.set(redirect, s = d.signIn ? d.signIn(redirect) : new OctoSignIn({ octo: d.octo, redirect, store: d.clients }));
    return s;
  };
  const access = new Map<string, RawAccess>();
  const accessAt = (ws: string) => { let a = access.get(ws); if (!a) { if (access.size >= 500) access.delete(access.keys().next().value!); access.set(ws, a = new RawAccess(d.sqlAt(ws))); } return a; };
  // Behind a tunnel the request comes in as http, so the origin is picked from the copilot's own list by host.
  const originOf = (req: Request) => d.own.find(o => new URL(o).host === d.host(req)) ?? null;
  const cookie = (req: Request) => (req.headers.get('cookie') ?? '').split(/;\s*/).find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? '';
  const setCookie = (v: string, ms: number) => `${COOKIE}=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(ms / 1000)}`;
  const back = (business: string, note?: string) => `/business/access?business=${encodeURIComponent(business)}${note ? `&note=${encodeURIComponent(note)}` : ''}`;

  // The signed-in person for this business, checked live with Octo, or why not.
  const whoFor = async (req: Request, business: string, origin: string): Promise<{ who: Who; token: string; ws: string; manage: boolean } | Response> => {
    const s = sessions.get(cookie(req));
    if (!s || s.business !== business) return json({ error: 'sign in', signin: true }, 401);
    const ws = await d.workspaceOf(business);
    if (!ws) return json({ error: 'this business has no workspace of its own' }, 404);
    let me: OctoMe;
    try { me = await signer(origin).me(s.token); } catch { sessions.delete(cookie(req)); return json({ error: 'sign in again', signin: true }, 401); }
    if (me.workspace !== ws || !ROLES.includes(me.role as Role) || !me.principal || !me.email) return json({ error: 'you are not a member of this business’s workspace' }, 403);
    return { who: { principal: me.principal, email: me.email, role: me.role as Role }, token: s.token, ws, manage: s.manage };
  };

  return {
    async handle(req: Request): Promise<Response> {
      const u = new URL(req.url), path = u.pathname.slice('/api/access/'.length);
      const origin = originOf(req);
      if (!origin) return json({ error: 'not this site' }, 403);
      try {
        if (req.method === 'GET' && path === 'login') {
          const business = u.searchParams.get('business') ?? '';
          if (!BUSINESS_ID.test(business) || !await d.workspaceOf(business)) return json({ error: 'unknown business' }, 404);
          const manage = u.searchParams.get('manage') === '1';
          const state = token(), { url, verifier } = await signer(origin).start(state, manage ? MANAGE_SCOPE : 'read');
          pending.set(state, { business, verifier, origin, manage }, PENDING_MS);
          return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } });
        }
        if (req.method === 'GET' && path === 'callback') {
          const p = pending.take(u.searchParams.get('state') ?? '');
          const code = u.searchParams.get('code');
          if (!p || p.origin !== origin) return json({ error: 'this sign-in has expired; start again' }, 400);
          if (!code) return new Response(null, { status: 302, headers: { Location: back(p.business, 'sign-in was cancelled') } });
          const { token: t, until } = await signer(origin).finish(code, p.verifier);
          const me = await signer(origin).me(t), ws = await d.workspaceOf(p.business);
          if (!ws || me.workspace !== ws || !me.role) {
            d.log(`access: sign-in for ${p.business} picked another workspace or no membership`);
            return new Response(null, { status: 302, headers: { Location: back(p.business, 'pick this business’s workspace when Octo asks') } });
          }
          const sid = token(), ms = Math.min(SESSION_MS, until - Date.now());
          sessions.set(sid, { token: t, business: p.business, manage: p.manage }, ms);
          return new Response(null, { status: 302, headers: { Location: back(p.business), 'Set-Cookie': setCookie(sid, ms), 'Cache-Control': 'no-store' } });
        }
        if (req.method === 'GET' && path === 'state') {
          const business = u.searchParams.get('business') ?? '';
          if (!BUSINESS_ID.test(business)) return json({ error: 'bad business' }, 400);
          const w = await whoFor(req, business, origin);
          if (w instanceof Response) return w;
          const ra = accessAt(w.ws), admin = w.who.role === 'owner' || w.who.role === 'admin';
          const members = admin ? await signer(origin).members(w.token, w.ws).catch(e => { d.log(`access: members of ${business}: ${(e as Error).message}`); return null; }) : null;
          return json({ me: { email: w.who.email, role: w.who.role }, members, canManage: admin && w.manage, grants: admin ? await ra.grants(business) : (await ra.grants(business)).filter(g => g.email === w.who.email),
            log: admin ? await ra.log(business) : null });
        }
        if (req.method !== 'POST') return json({ error: 'not found' }, 404);
        if (req.headers.get('x-access') !== '1') return json({ error: 'missing x-access header' }, 403);
        if (path === 'logout') {
          sessions.delete(cookie(req));
          return json({ ok: true }, 200, { 'Set-Cookie': setCookie('', 0) });
        }
        const raw = await req.text();
        if (raw.length > 16_000) return json({ error: 'too large' }, 413);
        let b: any;
        try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
        const business = typeof b?.business === 'string' ? b.business : '';
        if (!BUSINESS_ID.test(business)) return json({ error: 'bad business' }, 400);
        const w = await whoFor(req, business, origin);
        if (w instanceof Response) return w;
        const ra = accessAt(w.ws);
        if (path === 'grant') {
          const until = new Date(String(b.until ?? ''));
          if (Number.isNaN(until.getTime())) return json({ error: 'until must be a date' }, 400);
          return json({ grant: await ra.grant(business, w.who, { email: String(b.email ?? ''), calls: b.calls ?? null, purpose: String(b.purpose ?? ''), until }) });
        }
        if (path === 'revoke') return json({ revoked: await ra.revoke(business, w.who, String(b.id ?? '')) });
        if (path === 'member-code' || path === 'member') {
          if (w.who.role !== 'owner' && w.who.role !== 'admin') return json({ error: 'only the owner or an admin adds or removes members' }, 403);
          if (!w.manage) return json({ error: 'sign in again to manage members', signin: true, manage: true }, 401);
          if (path === 'member-code') return json(await signer(origin).memberCode(w.token, w.ws));
          const op = b.op === 'add' || b.op === 'remove' ? b.op as 'add' | 'remove' : null, email = String(b.email ?? '').trim().toLowerCase();
          const role = b.role === undefined ? undefined : MEMBER_ROLES.find(r => r === b.role);
          const code = String(b.code ?? '').trim(), mfaCode = b.mfaCode ? String(b.mfaCode).trim() : undefined;
          if (!op || !EMAIL.test(email) || (b.role !== undefined && !role) || !code || code.length > 64 || (mfaCode && !/^\d{6,8}$/.test(mfaCode)))
            return json({ error: 'say add or remove, an email, a role of admin, operator or member, and the code' }, 400);
          const what = op === 'add' ? `${email} as ${role ?? 'member'}` : email;
          try {
            const r = await signer(origin).changeMember(w.token, w.ws, op, { email, role, code, mfaCode });
            await ra.note(business, w.who, `member ${op}`, `${what}${r.status ? ` (${r.status})` : ''}`, true);
            return json(r);
          } catch (e) {
            if (!(e instanceof OctoError) || e.status >= 500) throw e;
            await ra.note(business, w.who, `member ${op}`, `${what}: refused by Octo (${e.status})`, false);
            return json({ error: e.status === 404 ? 'nobody with that email is a member' : e.status === 403 || e.status === 412 ? 'Octo refused: check the code (each is good once, for 10 minutes) and the authenticator code' : `Octo refused (${e.status})` }, e.status === 404 ? 404 : 403);
          }
        }
        if (path === 'open' || path === 'audio') {
          const call = typeof b.call === 'string' ? b.call : '';
          if (!CALL.test(call)) return json({ error: 'bad call' }, 400);
          const emergency = typeof b.emergency === 'string' ? b.emergency : undefined;
          if (path === 'open') return json({ entries: await ra.open(business, w.who, call, 'record', () => d.record(business, call), emergency) });
          const a = await ra.open(business, w.who, call, 'audio', () => d.audio(business, call), emergency);
          if (!a) return json({ error: 'no recording for this call' }, 404);
          return new Response(new Blob([a.audio as Uint8Array<ArrayBuffer>]), { headers: { 'Content-Type': a.mime, 'Cache-Control': 'no-store' } });
        }
        return json({ error: 'not found' }, 404);
      } catch (e) {
        if (e instanceof AccessDenied) return json({ error: e.message }, 403);
        const m = (e as Error).message;
        if (/^(email|say what|calls must|a grant ends|bad call)/.test(m)) return json({ error: m }, 400);
        d.log(`access ${path} failed: ${m}`);
        return json({ error: 'backend error' }, 502);
      }
    },
  };
}
