// A Store kept in Octo (decision 0004): one small table in the workspace's own Postgres, reached through the workspace
// SQL surface (POST /workspaces/<id>/query), so a restart or a second instance loses nothing. The database's clock
// decides when an entry expires, so instances with different clocks agree. No Node imports: it also runs in a
// Cloudflare Pages Function.
import type { Store } from './memory.ts';

export type Sql = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

export class OctoStore implements Store {
  private sql: Sql;
  private table: string;
  private max: number;
  private ready?: Promise<void>;
  private puts = 0;
  // table: a plain identifier. max: the most rows it keeps (the newest written survive a sweep).
  constructor(sql: Sql, opts: { table?: string; max?: number } = {}) {
    this.table = opts.table ?? 'copilot_kv';
    if (!/^[a-z_][a-z0-9_]{0,40}$/.test(this.table)) throw new Error('bad table name');
    this.sql = sql; this.max = opts.max ?? 100_000;
  }

  private ensure(): Promise<void> {
    this.ready ??= (async () => {
      await this.sql(`create table if not exists ${this.table} (k text primary key, v jsonb not null, exp timestamptz, touched timestamptz not null default now())`);
      await this.sql(`create index if not exists ${this.table}_exp on ${this.table} (exp)`);
    })().catch(e => { this.ready = undefined; throw e; });
    return this.ready;
  }

  async get(key: string): Promise<unknown | undefined> {
    await this.ensure();
    const rows = await this.sql(`select v from ${this.table} where k = $1 and (exp is null or exp > now())`, [key]);
    return rows[0]?.v;
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    await this.ensure();
    await this.sql(`insert into ${this.table} (k, v, exp, touched) values ($1, $2::jsonb, case when $3::bigint > 0 then now() + $3::bigint * interval '1 millisecond' end, now())
      on conflict (k) do update set v = excluded.v, exp = excluded.exp, touched = now()`, [key, JSON.stringify(value), ttlMs && ttlMs > 0 ? Math.round(ttlMs) : 0]);
    if (++this.puts % 64 === 0) void this.sweep().catch(() => { /* the next sweep tries again */ });
  }

  async delete(key: string): Promise<void> {
    await this.ensure();
    await this.sql(`delete from ${this.table} where k = $1`, [key]);
  }

  async incr(key: string, ttlMs: number): Promise<number> {
    await this.ensure();
    const rows = await this.sql(`insert into ${this.table} (k, v, exp, touched) values ($1, '1'::jsonb, now() + $2::bigint * interval '1 millisecond', now())
      on conflict (k) do update set
        v = case when ${this.table}.exp <= now() then '1'::jsonb else to_jsonb((${this.table}.v #>> '{}')::int + 1) end,
        exp = case when ${this.table}.exp <= now() then excluded.exp else ${this.table}.exp end,
        touched = now()
      returning (v #>> '{}')::int as n`, [key, Math.round(ttlMs)]);
    return Number(rows[0]?.n);
  }

  // Drops expired rows, then the oldest written past `max`. Runs every 64 writes; also callable by a tool or a test.
  async sweep(): Promise<void> {
    await this.ensure();
    await this.sql(`delete from ${this.table} where exp is not null and exp <= now()`);
    await this.sql(`delete from ${this.table} where k in (select k from ${this.table} order by touched desc offset $1)`, [this.max]);
  }
}
