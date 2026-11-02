// Smart model slots on the live backend (decision 0017). LFM3 answers every desk turn; for a hard turn the desk may ask
// the `desk` slot's smart hosted model, and only here is that allowed, with these limits:
//   scope     only a request from a development host or carrying the owner's token (never an ordinary visitor of a business)
//   switch    DESK_HYBRID=1 on the server, and for the owner path SMART_OWNER=1 with OWNER_TOKEN set
//   cap       a call count per slot per UTC day (like JEV_DAILY_CAP)
//   routes    InferHub's vendor routes of the one allowed model are tried in order after a 402, 429, 5xx or a timeout, inside the slot's
//             total time budget; after the last one the local model's own answer, which the caller already holds, stands
//   key       no key keeps the slot off (a log line at start); a 401 or 403 (a rejected or expired vault lease) switches it off for
//             10 minutes with a log line, and the span of that request is an error span saying why
//   names     a model whose name (or the name the gateway reports) contains claude, gemma or openrouter/free never answers
// Nothing here picks a model for production: with no smart slot every check says "off" and no request leaves the server.
import { OpenAIChat, type ChatMsg, type ChatResult } from '../../copilot-engine/src/desk.ts';
import { reportedModelOk, type Slot, type SlotName, type Slots } from '../../copilot-engine/src/slots.ts';

type Env = Record<string, string | undefined>;
export type Scope = 'dev-host' | 'owner' | null;
export type Gate = { ok: true } | { ok: false; reason: 'off' | 'scope' | 'cap' | 'no-key' | 'auth' };
// One route that was tried and why it was passed over, for the span.
export type Tried = { model: string; why: string };
export type SmartReason = 'timeout' | 'error' | 'banned-model' | 'auth' | 'exhausted';
export class SmartError extends Error {
  reason: SmartReason; tried: Tried[];
  constructor(reason: SmartReason, msg: string, tried: Tried[] = []) { super(msg); this.reason = reason; this.tried = tried; }
}
const AUTH_COOLDOWN_MS = 10 * 60_000;
// A route that answered these, or no answer at all, is passed over for the next vendor route; anything else (a 400) would fail the same way.
const passOver = (status: number) => status === 0 || status === 402 || status === 429 || status >= 500;

const OWNER_COOKIE = 'copilot_owner';
// localhost, 127.0.0.1, ::1, *.localhost and *.test, plus the hosts SMART_DEV_HOSTS lists (comma separated).
const isDevHost = (hostname: string, extra: string) => {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.localhost') || h.endsWith('.test')
    || extra.split(',').map(x => x.trim().toLowerCase()).filter(Boolean).includes(h);
};

// Equal-time comparison of two secrets (no early exit on the first different character).
export function sameSecret(a: string, b: string): boolean {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

const cookieOf = (req: Request): string => {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === OWNER_COOKIE) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
};

export function createSmart(env: Env, slots: Slots, opts: { log?: (m: string) => void; now?: () => number } = {}) {
  const log = opts.log ?? (() => {});
  const now = opts.now ?? Date.now;
  const ownerOn = env.SMART_OWNER === '1' && !!env.OWNER_TOKEN;
  const used: Partial<Record<SlotName, { day: string; n: number }>> = {};
  const today = () => new Date(now()).toISOString().slice(0, 10);
  const count = (name: SlotName) => { const u = used[name]; return u && u.day === today() ? u.n : 0; };
  const authOffUntil: Partial<Record<SlotName, number>> = {};
  // A smart slot with no key stays off, and the log says why once at start.
  if (env.DESK_HYBRID === '1') for (const slot of Object.values(slots)) if (slot.smart && slot.keyName && !env[slot.keyName]) log(`smart ${slot.name}: ${slot.provider} needs ${slot.keyName}, which is not set; the local model answers (deploy/README.md)`);

  return {
    // Who this request is: a development host (the request's own host name, which server.ts only passes on when it is not
    // behind a proxy), or the owner (the token in a header or the cookie, only when the owner switch is on). Anything else: null.
    scope(req: Request): Scope {
      const proxied = req.headers.has('cf-connecting-ip') || req.headers.has('x-forwarded-for'); // a proxied request's host name is not a development one
      if (!proxied && isDevHost(new URL(req.url).hostname, env.SMART_DEV_HOSTS ?? '')) return 'dev-host';
      if (!ownerOn) return null;
      const t = req.headers.get('x-owner-token') || cookieOf(req);
      return t && sameSecret(t, env.OWNER_TOKEN!) ? 'owner' : null;
    },
    // Whether a smart model may answer this request's turn now (does not use up a call).
    check(name: SlotName, scope: Scope): Gate {
      const slot = slots[name];
      if (env.DESK_HYBRID !== '1' || !slot.smart) return { ok: false, reason: 'off' };
      if (!scope) return { ok: false, reason: 'scope' };
      if (!slot.keyName || !env[slot.keyName]) return { ok: false, reason: 'no-key' };
      if ((authOffUntil[name] ?? 0) > now()) return { ok: false, reason: 'auth' };
      if (count(name) >= slot.dailyCap) return { ok: false, reason: 'cap' };
      return { ok: true };
    },
    // One smart call for the slot: its routes in order, inside the slot's total time budget. Counts once toward the daily cap, passes
    // over a route on 402, 429, 5xx, a network failure or the deadline, stops on a 401 or 403 (the key is rejected or expired), and drops
    // an answer whose reported model name is not allowed. Throws SmartError; the caller keeps the local model's answer.
    async call(name: SlotName, messages: ChatMsg[], tools: unknown[], o: { maxTokens?: number; temperature?: number } = {}): Promise<ChatResult & { tried: Tried[] }> {
      const slot: Slot = slots[name];
      const u = (used[name] = count(name) ? used[name]! : { day: today(), n: 0 });
      u.n++;
      const tried: Tried[] = [];
      const deadline = Date.now() + slot.timeoutMs;
      const fail = (reason: SmartReason, why: string): never => {
        log(`smart ${name}: ${reason} (${slot.provider}): ${why}${tried.length ? `; tried ${tried.map(t => `${t.model} ${t.why}`).join(', ')}` : ''}`);
        throw new SmartError(reason, why, tried);
      };
      for (const route of slot.routes) {
        const left = deadline - Date.now();
        if (left <= 0) break;
        const model = new OpenAIChat({ url: slot.url, key: env[slot.keyName!], model: route, stream: slot.stream, nothink: false, timeoutMs: left + 1000, attempts: 1 }); // the race below is the deadline
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const r = await Promise.race([model.chat(messages, tools, o), new Promise<never>((_, no) => { timer = setTimeout(() => no(new SmartError('timeout', 'deadline')), left); })]);
          if (!reportedModelOk(r.model)) return fail('banned-model', `${slot.provider} reported a model that is not allowed`);
          return { ...r, tried };
        } catch (e) {
          if (e instanceof SmartError) { if (e.reason !== 'timeout') throw e; tried.push({ model: route, why: 'timeout' }); break; } // our own refusals (a banned model, a rejected key) end the walk
          const status = Number((e as { status?: number }).status) || 0;
          tried.push({ model: route, why: status ? String(status) : 'no answer' });
          if (status === 401 || status === 403) {
            authOffUntil[name] = now() + AUTH_COOLDOWN_MS;
            return fail('auth', `${slot.provider} rejected the key (HTTP ${status}); if it is the 30-day vault lease it may have expired, so renew it as deploy/README.md says. Smart turns are off for 10 minutes and the local model answers`);
          }
          if (!passOver(status)) return fail('error', `${slot.provider} ${route} answered ${status}`);
        } finally { clearTimeout(timer); }
      }
      return fail(Date.now() >= deadline ? 'timeout' : 'exhausted', Date.now() >= deadline ? `no answer within ${slot.timeoutMs} ms` : `every ${slot.provider} route failed`);
    },
    // POST /api/owner: sets (or, with an empty token, clears) the owner cookie. Not found unless the owner switch is on.
    ownerSession(token: unknown): Response {
      const reply = (status: number, body: object, cookie?: string) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
      if (!ownerOn) return reply(404, { error: 'not found' });
      const attrs = 'Path=/api; HttpOnly; Secure; SameSite=Lax';
      if (token === '') return reply(200, { ok: true, owner: false }, `${OWNER_COOKIE}=; ${attrs}; Max-Age=0`);
      if (typeof token !== 'string' || !sameSecret(token, env.OWNER_TOKEN!)) return reply(403, { error: 'no' });
      return reply(200, { ok: true, owner: true }, `${OWNER_COOKIE}=${encodeURIComponent(token)}; ${attrs}; Max-Age=${30 * 86400}`);
    },
  };
}
