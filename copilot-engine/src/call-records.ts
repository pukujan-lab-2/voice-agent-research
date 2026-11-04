// The call record (decision 0021 settlement 3, #129): every turn's words, what the caller said and what the copilot
// answered, kept in the business's own Octo workspace and locked by the call's key (call-vault.ts). Traces carry only a
// pointer to an entry here, never the words. Each business sets how long its calls are kept (`retention.days` in its
// config); older entries can't be read and are deleted by sweep(). No Node imports: it also runs in a Pages Function.
import type { CallVault, Sealed } from './call-vault.ts';
import type { Sql } from './octo-store.ts';

export const DEFAULT_RETENTION_DAYS = 30;
export const MAX_RETENTION_DAYS = 3650;

// The days a business keeps its calls: its config's `retention.days` when it is a whole number in range, else the default.
export function retentionDays(config: object | null | undefined): number {
  const d = ((config as { retention?: { days?: unknown } } | null | undefined)?.retention)?.days;
  return Number.isInteger(d) && (d as number) >= 1 && (d as number) <= MAX_RETENTION_DAYS ? d as number : DEFAULT_RETENTION_DAYS;
}

// A pointer to one entry, as a trace carries it: call-record/<business>/<call>/<entry id>.
export const pointer = (business: string, call: string, id: string) => `call-record/${business}/${call}/${id}`;

export type Entry = Record<string, string>;

export class CallRecords {
  private sql: Sql;
  private vault: CallVault;
  private table: string;
  private ready?: Promise<void>;
  constructor(sql: Sql, vault: CallVault, opts: { table?: string } = {}) {
    this.table = opts.table ?? 'copilot_call_turns';
    if (!/^[a-z_][a-z0-9_]{0,40}$/.test(this.table)) throw new Error('bad table name');
    this.sql = sql; this.vault = vault;
  }

  private ensure(): Promise<void> {
    this.ready ??= (async () => {
      await this.sql(`create table if not exists ${this.table} (id text primary key, business text not null, call text not null, at timestamptz not null default now(), sealed jsonb not null)`);
      await this.sql(`create index if not exists ${this.table}_call on ${this.table} (business, call, at)`);
      await this.sql(`create index if not exists ${this.table}_age on ${this.table} (business, at)`);
    })().catch(e => { this.ready = undefined; throw e; });
    return this.ready;
  }

  // Locks one entry (a turn, a tool call, a correction) and returns the pointer a trace keeps in its place.
  async add(business: string, call: string, entry: Entry): Promise<string> {
    await this.ensure();
    const id = [...crypto.getRandomValues(new Uint8Array(9))].map(b => b.toString(16).padStart(2, '0')).join('');
    await this.sql(`insert into ${this.table} (id, business, call, sealed) values ($1, $2, $3, $4::jsonb)`,
      [id, business, call, JSON.stringify(await this.vault.seal(business, call, entry))]);
    return pointer(business, call, id);
  }

  // A call's entries in order, opened, within the business's retention. An entry that won't open is left out.
  async read(business: string, call: string, days: number): Promise<{ id: string; at: string; entry: Entry }[]> {
    await this.ensure();
    const rows = await this.sql(`select id, at, sealed from ${this.table} where business = $1 and call = $2 and at > now() - $3::int * interval '1 day' order by at, id`,
      [business, call, days]) as { id: string; at: unknown; sealed: Sealed }[];
    const out: { id: string; at: string; entry: Entry }[] = [];
    for (const r of rows) {
      try { out.push({ id: r.id, at: String(r.at), entry: await this.vault.open(business, call, r.sealed) as Entry }); } catch { /* a destroyed or foreign key */ }
    }
    return out;
  }

  // The businesses with entries here, for the sweeper.
  async businesses(): Promise<string[]> {
    await this.ensure();
    return (await this.sql(`select distinct business from ${this.table}`) as { business: string }[]).map(r => r.business);
  }

  // Deletes a business's entries older than its retention; returns the call of each entry that went.
  async sweep(business: string, days: number): Promise<string[]> {
    await this.ensure();
    return (await this.sql(`delete from ${this.table} where business = $1 and at <= now() - $2::int * interval '1 day' returning call`, [business, days]) as { call: string }[]).map(r => r.call);
  }

  async has(business: string, call: string): Promise<boolean> {
    await this.ensure();
    return (await this.sql(`select 1 from ${this.table} where business = $1 and call = $2 limit 1`, [business, call])).length > 0;
  }

  // A business's calls with entries here, for erasing the business (#132).
  async calls(business: string): Promise<string[]> {
    await this.ensure();
    return (await this.sql(`select distinct call from ${this.table} where business = $1`, [business]) as { call: string }[]).map(r => r.call);
  }

  // Deletes a call's entries, or with no call every entry of the business (#132); returns how many went.
  async forget(business: string, call?: string): Promise<number> {
    await this.ensure();
    return call === undefined
      ? (await this.sql(`delete from ${this.table} where business = $1 returning id`, [business])).length
      : (await this.sql(`delete from ${this.table} where business = $1 and call = $2 returning id`, [business, call])).length;
  }
}
