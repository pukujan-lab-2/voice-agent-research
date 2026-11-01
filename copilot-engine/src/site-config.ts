// A business's copilot config (its pages, voice stacks, desk and manual settings) kept in Octo, one row per business,
// and loaded on demand through a small cache with a time limit and a size cap. A business id is checked before it
// reaches SQL and is the only key, so one business can never read or change another's row (#103).
// No Node imports: it also runs in a Cloudflare Pages Function.
import { MemoryStore } from './memory.ts';
import type { Sql } from './octo-store.ts';

export const BUSINESS_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const MAX_CONFIG_CHARS = 256_000;

// What the widget's Config holds, minus code: the server keeps it as JSON and only reads `voice` itself.
export type SiteConfig = { business?: string; voice?: { stacks?: string[]; default?: string } } & Record<string, unknown>;

// The slice of SiteConfigs the backend uses: a business's config, or null when it has none.
export interface Sites { get(business: string): Promise<SiteConfig | null> }

export class SiteConfigs implements Sites {
  private sql: Sql;
  private table: string;
  private cache: MemoryStore;
  private ttlMs: number;
  private ready?: Promise<void>;
  // cacheMax: how many businesses stay in memory. ttlMs: how long an instance serves a config before asking Octo again,
  // so an update reaches every instance within this time.
  constructor(sql: Sql, opts: { table?: string; cacheMax?: number; ttlMs?: number; now?: () => number } = {}) {
    this.table = opts.table ?? 'copilot_sites';
    if (!/^[a-z_][a-z0-9_]{0,40}$/.test(this.table)) throw new Error('bad table name');
    this.sql = sql; this.ttlMs = opts.ttlMs ?? 60_000;
    this.cache = new MemoryStore(opts.now ?? Date.now, { max: opts.cacheMax ?? 200 });
  }
  get cached() { return this.cache.size; }

  private ensure(): Promise<void> {
    this.ready ??= this.sql(`create table if not exists ${this.table} (business text primary key, config jsonb not null, updated timestamptz not null default now())`)
      .then(() => undefined, e => { this.ready = undefined; throw e; });
    return this.ready;
  }

  async get(business: string): Promise<SiteConfig | null> {
    if (!BUSINESS_ID.test(business)) return null;
    const hit = (await this.cache.get(business)) as { c: SiteConfig | null } | undefined;
    if (hit) return hit.c;
    await this.ensure();
    const c = ((await this.sql(`select config from ${this.table} where business = $1`, [business]))[0]?.config as SiteConfig | undefined) ?? null;
    await this.cache.set(business, { c }, c ? this.ttlMs : Math.min(this.ttlMs, 10_000)); // a business with no config is asked about again sooner
    return c;
  }

  // Replaces a business's config. Throws a message that says what is wrong; nothing is written then.
  async put(business: string, config: SiteConfig): Promise<void> {
    if (!BUSINESS_ID.test(business)) throw new Error('business must be lower-case letters, digits and dashes, up to 40 characters');
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('config must be a JSON object');
    if (config.business !== undefined && config.business !== business) throw new Error(`config.business "${String(config.business)}" is not "${business}"`);
    const text = JSON.stringify(config);
    if (text.length > MAX_CONFIG_CHARS) throw new Error(`config is ${text.length} characters; the limit is ${MAX_CONFIG_CHARS}`);
    const stacks = config.voice?.stacks;
    if (stacks !== undefined && (!Array.isArray(stacks) || stacks.length > 20 || stacks.some(s => typeof s !== 'string' || !s || s.length > 40))) throw new Error('voice.stacks must be up to 20 stack ids');
    if (config.voice?.default !== undefined && stacks && !stacks.includes(config.voice.default)) throw new Error('voice.default must be one of voice.stacks');
    await this.ensure();
    await this.sql(`insert into ${this.table} (business, config, updated) values ($1, $2::jsonb, now()) on conflict (business) do update set config = excluded.config, updated = now()`, [business, text]);
    await this.cache.delete(business);
  }

  async remove(business: string): Promise<void> {
    if (!BUSINESS_ID.test(business)) return;
    await this.ensure();
    await this.sql(`delete from ${this.table} where business = $1`, [business]);
    await this.cache.delete(business);
  }
}
