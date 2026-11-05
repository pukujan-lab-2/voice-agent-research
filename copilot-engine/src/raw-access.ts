// Who may open a business's raw calls, and the log of every time someone did (decision 0021 settlement 4, #131).
// A person is a member of the business's own Octo workspace, signed in with Octo (octo-signin.ts); their live role there
// is checked on every request. A grant from the business's owner or an admin names who (their Octo email), which calls (or
// all) and until when, and why. open() is the one door to a raw call: it writes the log entry first, under the person's
// Octo principal, and only then unlocks the call; a refused try is logged too. The workspace owner has an emergency path
// that needs no grant but a written reason, and is flagged in the log the business reads. Both tables live in the
// business's own workspace. No Node imports: it also runs in a Pages Function.
import type { Sql } from './octo-store.ts';

export type Role = 'owner' | 'admin' | 'operator' | 'member';
export type Who = { principal: string; email: string; role: Role };
export type Grant = { id: string; email: string; calls: string[] | null; purpose: string; until: string; by: string; at: string; revoked_at: string | null; revoked_by: string | null };
export type LogEntry = { id: string; at: string; principal: string; email: string; role: string; action: string; call: string | null; grant_id: string | null; reason: string | null; emergency: boolean; ok: boolean };

export const ROLES: Role[] = ['owner', 'admin', 'operator', 'member'];
export const manages = (who: Who) => who.role === 'owner' || who.role === 'admin';
export const MAX_GRANT_DAYS = 90;
export const EMERGENCY_REASON_MIN = 20;
const CALL = /^[\w.-]{1,64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AccessDenied extends Error {}

const newId = () => [...crypto.getRandomValues(new Uint8Array(9))].map(b => b.toString(16).padStart(2, '0')).join('');

export class RawAccess {
  private sql: Sql;
  private ready?: Promise<void>;
  constructor(sql: Sql) { this.sql = sql; }

  private ensure(): Promise<void> {
    this.ready ??= (async () => {
      await this.sql(`create table if not exists copilot_access_grants (id text primary key, business text not null, email text not null, calls jsonb, purpose text not null, until timestamptz not null, by text not null, at timestamptz not null default now(), revoked_at timestamptz, revoked_by text)`);
      await this.sql(`create index if not exists copilot_access_grants_who on copilot_access_grants (business, email)`);
      await this.sql(`create table if not exists copilot_access_log (n bigint generated always as identity, id text primary key, business text not null, at timestamptz not null default clock_timestamp(), principal text not null, email text not null, role text not null, action text not null, call text, grant_id text, reason text, emergency boolean not null default false, ok boolean not null)`);
      await this.sql(`create index if not exists copilot_access_log_n on copilot_access_log (business, n)`);
    })().catch(e => { this.ready = undefined; throw e; });
    return this.ready;
  }

  private async write(business: string, who: Who, e: { action: string; call?: string | null; grant?: string | null; reason?: string | null; emergency?: boolean; ok: boolean }): Promise<void> {
    await this.sql(`insert into copilot_access_log (id, business, principal, email, role, action, call, grant_id, reason, emergency, ok) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [newId(), business, who.principal, who.email, who.role, e.action, e.call ?? null, e.grant ?? null, e.reason ?? null, e.emergency ?? false, e.ok]);
  }

  // A grant from the business's owner or an admin. Logged.
  async grant(business: string, by: Who, g: { email: string; calls: string[] | null; purpose: string; until: Date }): Promise<Grant> {
    if (!manages(by)) throw new AccessDenied('only the owner or an admin gives grants');
    const email = g.email.trim().toLowerCase(), purpose = g.purpose.trim();
    if (!EMAIL.test(email)) throw new Error('email must be an email address');
    if (purpose.length < 3 || purpose.length > 300) throw new Error('say what the grant is for (3 to 300 characters)');
    if (g.calls !== null && (!Array.isArray(g.calls) || !g.calls.length || g.calls.length > 200 || !g.calls.every(c => CALL.test(c)))) throw new Error('calls must be call ids, or all');
    const until = g.until.getTime();
    if (!(until > Date.now()) || until > Date.now() + MAX_GRANT_DAYS * 86_400_000) throw new Error(`a grant ends in the future, within ${MAX_GRANT_DAYS} days`);
    await this.ensure();
    const id = newId();
    await this.write(business, by, { action: 'grant', grant: id, reason: `${email}: ${purpose}`, ok: true });
    await this.sql(`insert into copilot_access_grants (id, business, email, calls, purpose, until, by) values ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
      [id, business, email, g.calls === null ? null : JSON.stringify(g.calls), purpose, new Date(until).toISOString(), by.email]);
    return (await this.grants(business)).find(x => x.id === id)!;
  }

  // Revoking works at once: open() reads grants live. Logged.
  async revoke(business: string, by: Who, id: string): Promise<boolean> {
    if (!manages(by)) throw new AccessDenied('only the owner or an admin revokes grants');
    await this.ensure();
    const n = (await this.sql(`update copilot_access_grants set revoked_at = now(), revoked_by = $3 where business = $1 and id = $2 and revoked_at is null returning id`, [business, id, by.email])).length;
    if (n) await this.write(business, by, { action: 'revoke', grant: id, ok: true });
    return n > 0;
  }

  async grants(business: string): Promise<Grant[]> {
    await this.ensure();
    return (await this.sql(`select id, email, calls, purpose, until, by, at, revoked_at, revoked_by from copilot_access_grants where business = $1 order by at desc limit 200`, [business]) as Grant[])
      .map(g => ({ ...g, until: String(g.until), at: String(g.at), revoked_at: g.revoked_at ? String(g.revoked_at) : null }));
  }

  async log(business: string, limit = 500): Promise<LogEntry[]> {
    await this.ensure();
    return (await this.sql(`select id, at, principal, email, role, action, call, grant_id, reason, emergency, ok from copilot_access_log where business = $1 order by n desc limit $2`, [business, limit]) as LogEntry[])
      .map(e => ({ ...e, at: String(e.at) }));
  }

  // The one door to a raw call (its record or its audio). With `emergency`, the workspace owner opens it without a grant
  // and the written reason is flagged in the log. Otherwise the person needs a live grant for this call. The log entry is
  // written before anything is unlocked; if it can't be written, nothing opens.
  async open<T>(business: string, who: Who, call: string, what: 'record' | 'audio', unlock: () => Promise<T>, emergency?: string): Promise<T> {
    if (!CALL.test(call)) throw new Error('bad call id');
    await this.ensure();
    const action = `read ${what}`;
    if (emergency !== undefined) {
      const reason = emergency.trim();
      if (who.role !== 'owner' || reason.length < EMERGENCY_REASON_MIN) {
        await this.write(business, who, { action, call, reason: reason || null, emergency: true, ok: false });
        throw new AccessDenied(who.role !== 'owner' ? 'only the workspace owner has the emergency path' : `say why, in at least ${EMERGENCY_REASON_MIN} characters`);
      }
      await this.write(business, who, { action, call, reason, emergency: true, ok: true });
      return unlock();
    }
    const [g] = await this.sql(`select id from copilot_access_grants where business = $1 and email = $2 and revoked_at is null and until > now()
      and (calls is null or calls ? $3) order by until desc limit 1`, [business, who.email.toLowerCase(), call]) as { id: string }[];
    if (!g) {
      await this.write(business, who, { action, call, ok: false });
      throw new AccessDenied('no live grant covers this call');
    }
    await this.write(business, who, { action, call, grant: g.id, ok: true });
    return unlock();
  }
}
