// A large site's map of pages and forms, kept in Octo and found by search (#104). Each entry is one row in the
// workspace's own Postgres: its page path, title, the words a visitor might use for it, and (for a form) its flow.
// A lookup by the current page or by what the visitor asked for returns a few small references; only the one chosen
// form's flow is then loaded. No list of forms is ever held in memory, so a site with thousands costs the same as one
// with ten. Every query is scoped by business, so one business never sees another's map.
// No Node imports: it also runs in a Cloudflare Pages Function.
import type { Sql } from './octo-store.ts';
import { BUSINESS_ID } from './site-config.ts';
import type { Flow } from './types.ts';

export type MapEntry = { id: string; kind: 'page' | 'form'; path: string; title: string; keywords?: string[]; flow?: Flow };
export type MapRef = { id: string; kind: 'page' | 'form'; path: string; title: string; score?: number };

const ENTRY_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const MAX_FIELDS = 2000;
// Words that say nothing about which form is meant.
const STOP = new Set('a an the i me my we our you your to of in on for and or it is are do does can could would should want need like please get how what where which when with this that there about help find take go open show fill form page'.split(' '));

export class SiteMap {
  private sql: Sql;
  private table: string;
  private ready?: Promise<void>;
  constructor(sql: Sql, opts: { table?: string } = {}) {
    this.table = opts.table ?? 'copilot_site_map';
    if (!/^[a-z_][a-z0-9_]{0,40}$/.test(this.table)) throw new Error('bad table name');
    this.sql = sql;
  }

  private ensure(): Promise<void> {
    const t = this.table;
    this.ready ??= (async () => {
      // search: title and keywords weigh most, then the path, then the labels of a form's fields.
      await this.sql(`create table if not exists ${t} (
        business text not null, id text not null, kind text not null, path text not null, title text not null, keywords text not null default '', labels text not null default '', flow jsonb,
        search tsvector generated always as (
          setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', keywords), 'A') ||
          setweight(to_tsvector('english', regexp_replace(path, '[^a-zA-Z0-9]+', ' ', 'g')), 'B') || setweight(to_tsvector('english', labels), 'C')) stored,
        updated timestamptz not null default now(), primary key (business, id))`);
      await this.sql(`create index if not exists ${t}_search on ${t} using gin (search)`);
      await this.sql(`create index if not exists ${t}_path on ${t} (business, path)`);
    })().catch(e => { this.ready = undefined; throw e; });
    return this.ready;
  }

  // Adds or replaces one entry. A form's flow is stored whole; its field labels are indexed so a request that names a
  // field ("where do I put my VIN?") finds the form.
  async put(business: string, e: MapEntry): Promise<void> {
    if (!BUSINESS_ID.test(business)) throw new Error('bad business id');
    if (!ENTRY_ID.test(e.id)) throw new Error('entry id must be lower-case letters, digits, dots, dashes, up to 80 characters');
    if (e.kind !== 'page' && e.kind !== 'form') throw new Error('kind must be page or form');
    if (e.kind === 'form' && !e.flow) throw new Error('a form needs its flow');
    if (e.flow && e.flow.fields.length > MAX_FIELDS) throw new Error(`a form can have up to ${MAX_FIELDS} fields`);
    if (!e.path.startsWith('/') || e.path.length > 300 || !e.title || e.title.length > 200) throw new Error('bad path or title');
    await this.ensure();
    await this.sql(`insert into ${this.table} (business, id, kind, path, title, keywords, labels, flow, updated) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,now())
      on conflict (business, id) do update set kind = excluded.kind, path = excluded.path, title = excluded.title, keywords = excluded.keywords, labels = excluded.labels, flow = excluded.flow, updated = now()`,
    [business, e.id, e.kind, norm(e.path), e.title, (e.keywords ?? []).join(' ').slice(0, 1000), (e.flow?.fields ?? []).map(f => f.label).join(' ').slice(0, 20_000), e.flow ? JSON.stringify(e.flow) : null]);
  }

  async remove(business: string, id: string): Promise<void> {
    if (!BUSINESS_ID.test(business)) return;
    await this.ensure();
    await this.sql(`delete from ${this.table} where business = $1 and id = $2`, [business, id]);
  }

  // The entries at exactly this page path (a trailing slash or a query string does not matter).
  async forPage(business: string, path: string): Promise<MapRef[]> {
    if (!BUSINESS_ID.test(business)) return [];
    await this.ensure();
    return (await this.sql(`select id, kind, path, title from ${this.table} where business = $1 and path = $2 order by kind desc, id limit 10`, [business, norm(path)])) as MapRef[];
  }

  // The best matches for what a visitor asked for, best first. Words are stemmed, any word may match, and an entry that
  // matches more of them (or in its title) ranks higher. Returns references only, never flows.
  async find(business: string, query: string, opts: { k?: number; kind?: 'page' | 'form' } = {}): Promise<MapRef[]> {
    if (!BUSINESS_ID.test(business)) return [];
    const words = [...new Set((query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(w => w.length > 1 && !STOP.has(w)))].slice(0, 20);
    if (!words.length) return [];
    await this.ensure();
    const rows = await this.sql(`select id, kind, path, title, ts_rank(search, q) as score from ${this.table}, to_tsquery('english', $2) q
      where business = $1 and search @@ q and ($4::text is null or kind = $4) order by score desc, id limit $3`, [business, words.join(' | '), Math.min(Math.max(opts.k ?? 3, 1), 10), opts.kind ?? null]);
    return rows.map(r => ({ id: String(r.id), kind: r.kind as 'page' | 'form', path: String(r.path), title: String(r.title), score: Number(r.score) }));
  }

  // One form's flow: the only query that returns a flow, and it returns one.
  async load(business: string, id: string): Promise<Flow | null> {
    if (!BUSINESS_ID.test(business) || !ENTRY_ID.test(id)) return null;
    await this.ensure();
    return ((await this.sql(`select flow from ${this.table} where business = $1 and id = $2 and kind = 'form'`, [business, id]))[0]?.flow as Flow | undefined) ?? null;
  }
}

// /apply/ and /apply?x=1 are the page /apply.
function norm(path: string): string {
  const p = path.split(/[?#]/)[0];
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}
