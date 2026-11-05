// A business's copilot config (its pages, voice stacks, desk and manual settings) kept in Octo, one row per business,
// and loaded on demand through a small cache with a time limit and a size cap. A business id is checked before it
// reaches SQL and is the only key, so one business can never read or change another's row (#103).
// No Node imports: it also runs in a Cloudflare Pages Function.
import { MemoryStore } from './memory.ts';
import type { Sql } from './octo-store.ts';
import { WORKSPACE_ID } from './octo-workspaces.ts';

export const BUSINESS_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const MAX_CONFIG_CHARS = 256_000;

export const SITE_KEY = /^pk_[A-Za-z0-9]{24,64}$/;
export const MAX_ORIGINS = 20;

// What the widget's Config holds, minus code: the server keeps it as JSON and only reads `voice` and `site` itself.
// site: the business's public site key (it rides in the page's script tag) and the exact origins its pages are served
// from. A request from any other site is answered only with that key and from one of those origins (decision 0021).
// workspace: an outside business's own Octo workspace (#127). Put `workspace: {}` to give a business one; the registry
// creates it and fills in the id. A demo business has none and stays on the shared workspace, told apart by prefix.
export type SiteConfig = { business?: string; voice?: { stacks?: string[]; default?: string }; site?: { key?: string; origins?: string[] }; workspace?: { id?: string } } & Record<string, unknown>;

// How the registry reaches business workspaces: sqlFor(id) is that workspace's SQL; create(business) makes a new one
// and returns its id (an account-wide Octo key; only the registry tool has it, never the request path).
export type Workspaces = { sqlFor: (workspace: string) => Sql; create?: (business: string) => Promise<string> };

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
  private workspaces?: Workspaces;
  // cacheMax: how many businesses stay in memory. ttlMs: how long an instance serves a config before asking Octo again,
  // so an update reaches every instance within this time.
  // workspaces: how to reach and create businesses' own workspaces. Without it a business that has one is refused, never
  // served from the shared workspace.
  constructor(sql: Sql, opts: { table?: string; cacheMax?: number; ttlMs?: number; now?: () => number; workspaces?: Workspaces } = {}) {
    this.table = opts.table ?? 'copilot_sites';
    if (!/^[a-z_][a-z0-9_]{0,40}$/.test(this.table)) throw new Error('bad table name');
    this.sql = sql; this.ttlMs = opts.ttlMs ?? 60_000; this.workspaces = opts.workspaces;
    this.cache = new MemoryStore(opts.now ?? Date.now, { max: opts.cacheMax ?? 200 });
  }
  get cached() { return this.cache.size; }

  private ensure(): Promise<void> {
    this.ready ??= this.create(this.sql).then(() => undefined, e => { this.ready = undefined; throw e; });
    return this.ready;
  }
  private create(sql: Sql) {
    return sql(`create table if not exists ${this.table} (business text primary key, config jsonb not null, updated timestamptz not null default now())`);
  }
  private async row(sql: Sql, business: string): Promise<SiteConfig | null> {
    return ((await sql(`select config from ${this.table} where business = $1`, [business]))[0]?.config as SiteConfig | undefined) ?? null;
  }
  private write(sql: Sql, business: string, config: SiteConfig) {
    return sql(`insert into ${this.table} (business, config, updated) values ($1, $2::jsonb, now()) on conflict (business) do update set config = excluded.config, updated = now()`, [business, JSON.stringify(config)]);
  }
  // A business's own workspace's SQL, refused when the registry was built without a way to reach it.
  private own(id: string): Sql {
    if (!this.workspaces) throw new Error('this business has its own workspace, and no account-wide Octo key is set to reach it');
    return this.workspaces.sqlFor(id);
  }

  async get(business: string): Promise<SiteConfig | null> {
    if (!BUSINESS_ID.test(business)) return null;
    const hit = (await this.cache.get(business)) as { c: SiteConfig | null } | undefined;
    if (hit) return hit.c;
    await this.ensure();
    let c = await this.row(this.sql, business);
    // A business with its own workspace: the shared registry holds only how to reach it (workspace, site key, origins);
    // the rest of its config is read from its workspace, and the registry's facts win.
    const id = c?.workspace?.id;
    if (c && id) {
      const own = this.own(id);
      await this.create(own);
      c = { ...(await this.row(own, business)), workspace: c.workspace, ...(c.site ? { site: c.site } : {}) };
    }
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
    const keep = (config as { retention?: unknown }).retention;
    if (keep !== undefined) {
      const days = (keep as { days?: unknown })?.days;
      if (!keep || typeof keep !== 'object' || Array.isArray(keep) || Object.keys(keep).some(k => k !== 'days') || !Number.isInteger(days) || (days as number) < 1 || (days as number) > 3650)
        throw new Error('retention must be { days } with days a whole number from 1 to 3650 (how long its calls are kept)');
    }
    const tr = (config as { traces?: unknown }).traces;
    if (tr !== undefined && (!tr || typeof tr !== 'object' || Array.isArray(tr) || Object.keys(tr).some(k => k !== 'words') || typeof (tr as { words?: unknown }).words !== 'boolean'))
      throw new Error('traces must be { words: true | false } (whether its traces keep what callers said and what was answered; on when left out)');
    // The desk's offers are the one list of what it may offer (#156), so a bad one is refused here, not met on a call.
    const offers = (config as { desk?: { offers?: unknown } }).desk?.offers;
    if (offers !== undefined) {
      if (!Array.isArray(offers) || offers.length > 50) throw new Error('desk.offers must be a list of up to 50 offers');
      offers.forEach((o: { when?: unknown; href?: unknown; label?: unknown; say?: unknown }, i) => {
        const bad = (why: string) => new Error(`desk.offers[${i}]: ${why}`);
        if (!o || typeof o !== 'object') throw bad('must be { when, href, label, say }');
        if (typeof o.when !== 'string' || !o.when) throw bad('when must be a regular expression');
        try { new RegExp(o.when, 'i'); } catch { throw bad('when is not a valid regular expression'); }
        if (typeof o.href !== 'string' || !/^\/(?!\/)/.test(o.href)) throw bad('href must be a path on the site, like /book');
        if (typeof o.label !== 'string' || !o.label.trim()) throw bad('label must name the form');
        if (typeof o.say !== 'string' || !o.say.trim()) throw bad('say must be what the desk says to offer it');
      });
    }
    const rec = (config as { recording?: unknown }).recording;
    if (rec !== undefined && (!rec || typeof rec !== 'object' || Array.isArray(rec) || Object.keys(rec).some(k => k !== 'audio') || typeof (rec as { audio?: unknown }).audio !== 'boolean'))
      throw new Error('recording must be { audio: true | false } (whether its voice calls are recorded; on when left out)');
    const ws = config.workspace;
    if (ws !== undefined && (!ws || typeof ws !== 'object' || Array.isArray(ws) || Object.keys(ws).some(k => k !== 'id'))) throw new Error('workspace must be {} or { id }');
    await this.ensure();
    // Once a business has its own workspace it keeps it: a put cannot move it back to the shared workspace or point it
    // at a workspace the registry did not create for it.
    const had = (await this.row(this.sql, business))?.workspace?.id;
    let id = had;
    if (had && ws?.id !== undefined && ws.id !== had) throw new Error(`${business} already has its own workspace; it cannot be changed`);
    if (!had && ws) {
      if (ws.id !== undefined) throw new Error('workspace.id is set by the registry when it creates the workspace; put workspace: {} instead');
      if (!this.workspaces?.create) throw new Error('creating a business workspace needs an account-wide Octo key');
      id = await this.workspaces.create(business);
      if (!WORKSPACE_ID.test(id)) throw new Error('Octo returned a bad workspace id');
      // Recorded at once, so a failure below never leaves a workspace the registry does not know.
      await this.write(this.sql, business, { business, workspace: { id } });
    }
    if (id) {
      const own = this.own(id);
      await this.create(own);
      await this.write(own, business, { ...config, business, workspace: { id } });
      await this.write(this.sql, business, { business, workspace: { id }, ...(site ? { site } : {}) });
    } else await this.write(this.sql, business, config);
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

  // Every business in the registry and its own workspace, if it has one (for the call-record sweeper, #129).
  async list(): Promise<{ business: string; workspace?: string }[]> {
    await this.ensure();
    return (await this.sql(`select business, config->'workspace'->>'id' as ws from ${this.table} order by business`) as { business: string; ws: string | null }[])
      .map(r => ({ business: r.business, ...(r.ws ? { workspace: r.ws } : {}) }));
  }

  async remove(business: string): Promise<void> {
    if (!BUSINESS_ID.test(business)) return;
    await this.ensure();
    // A business's own workspace is left in place: deleting a workspace takes the owner's signed-in session (Octo).
    const id = (await this.row(this.sql, business))?.workspace?.id;
    if (id) await this.own(id)(`delete from ${this.table} where business = $1`, [business]);
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
