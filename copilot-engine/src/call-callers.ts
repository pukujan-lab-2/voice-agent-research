// Which calls a caller was on, at one business, so a caller who asks to be forgotten can be erased (#132). A caller is
// the business's keyed hash of their phone or email (memory.ts customerKey), never the contact detail itself. A caller is
// usually known only partway through a call, after its first words are locked, so erasing a caller destroys the key of
// every call linked here (call-vault.ts forgetCall), which reaches every copy and backup of those calls.
// No Node imports: it also runs in a Pages Function.
import type { Sql } from './octo-store.ts';

export const CALLER = /^[0-9a-f]{16,64}$/;

export class CallCallers {
  private sql: Sql;
  private table: string;
  private ready?: Promise<void>;
  constructor(sql: Sql, opts: { table?: string } = {}) {
    this.table = opts.table ?? 'copilot_call_callers';
    if (!/^[a-z_][a-z0-9_]{0,40}$/.test(this.table)) throw new Error('bad table name');
    this.sql = sql;
  }

  private ensure(): Promise<void> {
    this.ready ??= (async () => {
      await this.sql(`create table if not exists ${this.table} (business text not null, caller text not null, call text not null, at timestamptz not null default now(), primary key (business, caller, call))`);
    })().catch(e => { this.ready = undefined; throw e; });
    return this.ready;
  }

  async link(business: string, caller: string, call: string): Promise<void> {
    if (!CALLER.test(caller)) throw new Error('bad caller');
    await this.ensure();
    await this.sql(`insert into ${this.table} (business, caller, call) values ($1, $2, $3) on conflict do nothing`, [business, caller, call]);
  }

  async calls(business: string, caller: string): Promise<string[]> {
    await this.ensure();
    return (await this.sql(`select call from ${this.table} where business = $1 and caller = $2 order by at`, [business, caller]) as { call: string }[]).map(r => r.call);
  }

  // Deletes the links of one caller, of one call, or with neither every link of the business.
  async forget(business: string, by: { caller?: string; call?: string } = {}): Promise<number> {
    await this.ensure();
    const [where, params] = by.caller !== undefined ? ['and caller = $2', [by.caller]] : by.call !== undefined ? ['and call = $2', [by.call]] : ['', []];
    return (await this.sql(`delete from ${this.table} where business = $1 ${where} returning call`, [business, ...params])).length;
  }
}
