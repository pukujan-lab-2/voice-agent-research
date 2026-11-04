// A business's copilot config (its pages, voice stacks, desk and manual settings) kept in Octo, one row per business,
// and loaded on demand through a small cache with a time limit and a size cap. A business id is checked before it
// reaches SQL and is the only key, so one business can never read or change another's row (#103).
// No Node imports: it also runs in a Cloudflare Pages Function.
import { MemoryStore } from './memory.ts';
import type { Sql } from './octo-store.ts';

export const BUSINESS_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const MAX_CONFIG_CHARS = 256_000;

export const SITE_KEY = /^pk_[A-Za-z0-9]{24,64}$/;
export const MAX_ORIGINS = 20;

// What the widget's Config holds, minus code: the server keeps it as JSON and only reads `voice` and `site` itself.
// site: the business's public site key (it rides in the page's script tag) and the exact origins its pages are served
// from. A request from any other site is answered only with that key and from one of those origins (decision 0021).
export type SiteConfig = { business?: string; voice?: { stacks?: string[]; default?: string }; site?: { key?: string; origins?: string[] } } & Record<string, unknown>;

// The slice of SiteConfigs the backend uses: a business's config, or null when it has none; the business a site key
// belongs to; and whether any business lists an origin (a preflight carries no key).
export interface Sites {
  get(business: string): Promise<SiteConfig | null>;
  byKey?(key: string): Promise<{ business: string; config: SiteConfig } | null>;
  knowsOrigin?(origin: string): Promise<boolean>;
}

// A new public site key. It is not a secret: it names the business; the origins are what keep other sites out.
export function newSiteKey(): string {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return 'pk_' + Array.from(globalThis.crypto.getRandomValues(new Uint8Array(28)), b => a[b % a.length]).join('');
}

// An origin exactly as a browser sends it: https, or http only for localhost, with no path.
export function isOrigin(o: unknown): o is string {
  if (typeof o !== 'string' || o.length > 200) return false;
  try {
    const u = new URL(o);
    return u.origin === o && (u.protocol === 'https:' || (u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname)));
  } catch { return false; }
}

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
    const site = config.site;
    if (site !== undefined) {
      if (!site || typeof site !== 'object' || Array.isArray(site)) throw new Error('site must be an object with key and origins');
      if (!SITE_KEY.test(site.key ?? '')) throw new Error('site.key must be pk_ and 24 to 64 letters and digits');
      if (!Array.isArray(site.origins) || !site.origins.length || site.origins.length > MAX_ORIGINS || !site.origins.every(isOrigin))
        throw new Error(`site.origins must be 1 to ${MAX_ORIGINS} origins like https://www.example.com (http only for localhost)`);
      const other = await this.byKey(site.key!);
      if (other && other.business !== business) throw new Error('site.key already belongs to another business');
    }
    await this.ensure();
    await this.sql(`insert into ${this.table} (business, config, updated) values ($1, $2::jsonb, now()) on conflict (business) do update set config = excluded.config, updated = now()`, [business, text]);
    await this.cache.delete(business);
    if (site?.key) await this.cache.delete(`key:${site.key}`); // a key just added is found at once, not after a cached miss
    for (const o of site?.origins ?? []) await this.cache.delete(`origin:${o}`);
  }

  // The business a site key belongs to, through the same cache.
  async byKey(key: string): Promise<{ business: string; config: SiteConfig } | null> {
    if (!SITE_KEY.test(key)) return null;
    const hit = (await this.cache.get(`key:${key}`)) as { b: string | null } | undefined;
    let business = hit?.b;
    if (business === undefined) {
      await this.ensure();
      business = ((await this.sql(`select business from ${this.table} where config->'site'->>'key' = $1 limit 1`, [key]))[0]?.business as string | undefined) ?? null;
      await this.cache.set(`key:${key}`, { b: business }, business ? this.ttlMs : Math.min(this.ttlMs, 10_000));
    }
    if (!business) return null;
    const config = await this.get(business);
    return config?.site?.key === key ? { business, config } : null;
  }

  // Whether any business lists this origin: enough to answer a preflight, which carries no key.
  async knowsOrigin(origin: string): Promise<boolean> {
    if (!isOrigin(origin)) return false;
    const hit = (await this.cache.get(`origin:${origin}`)) as { ok: boolean } | undefined;
    if (hit) return hit.ok;
    await this.ensure();
    const ok = (await this.sql(`select 1 from ${this.table} where config->'site'->'origins' ? $1 limit 1`, [origin])).length > 0;
    await this.cache.set(`origin:${origin}`, { ok }, ok ? this.ttlMs : Math.min(this.ttlMs, 10_000));
    return ok;
  }

  async remove(business: string): Promise<void> {
    if (!BUSINESS_ID.test(business)) return;
    await this.ensure();
    await this.sql(`delete from ${this.table} where business = $1`, [business]);
    await this.cache.delete(business);
  }
}

// Who may call: the copilot's own site always (no Origin, one of its own origins, or the request's own host); any other site only with its
// business's public key and from an origin that business lists. A preflight carries no key, so it is answered for an
// origin some business lists, and the real request is checked with its key. `business` is the key's business: a body
// or query naming another business is then refused by the caller.
export type Gate = { ok: true; business?: string; headers: Record<string, string> } | { ok: false; status: number; error: string };
export const SITE_HEADERS = 'content-type, x-site-key, x-session-id';
export async function siteGate(sites: Sites | null, ask: { origin?: string | null; host?: string | null; own?: string[]; key?: string | null; preflight?: boolean }): Promise<Gate> {
  const origin = ask.origin ?? '';
  if (!origin || ask.own?.includes(origin)) return { ok: true, headers: {} };
  let host = '';
  try { host = new URL(origin).host; } catch { /* not an origin: refused below */ }
  if (host && host === (ask.host ?? '').toLowerCase()) return { ok: true, headers: {} };
  const refuse: Gate = { ok: false, status: 403, error: 'this site is not allowed to use this copilot' };
  if (!sites || !isOrigin(origin)) return refuse;
  const cors = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
  if (ask.preflight) {
    if (!sites.knowsOrigin || !(await sites.knowsOrigin(origin))) return refuse;
    return { ok: true, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': SITE_HEADERS, 'Access-Control-Max-Age': '600' } };
  }
  const site = ask.key && sites.byKey ? await sites.byKey(ask.key) : null;
  if (!site || !site.config.site?.origins?.includes(origin)) return refuse;
  return { ok: true, business: site.business, headers: cors };
}
