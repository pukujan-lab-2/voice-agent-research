// Search over one business's own site, loaded by ingest/ (see docs/ingest.md). Every passage is an Octo search
// document titled <business>/<language>/<page type>/<id>, with its url, page title, section and dates in the
// workspace's `site_passages` table. A search is narrowed by language and page type through Octo's title-prefix filter
// (before its limit), by section through the ids of the passages under that heading (Octo's documentIds filter), and
// always to the business's own prefix, so one business never sees another's passages. Octo has no metadata filter of
// its own yet (octo-database issue, see docs/retrieval-limits.md); this is the stand-in until it does.
import type { Passage, Retriever, SearchFilter } from './guide.ts';

// The two Octo calls the retriever needs, so tests can run it against an in-process stand-in.
export interface SiteOcto {
  rag(body: Record<string, unknown>): Promise<{ matches?: { chunkId?: string; title?: string; content?: string; documentId?: string }[] }>;
  sql(text: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export class OctoHttp implements SiteOcto {
  private base: string;
  private key: string;
  private workspaceId: string;
  private timeoutMs: number;
  constructor(opts: { base?: string; key: string; workspaceId: string; timeoutMs?: number }) {
    this.base = opts.base ?? 'https://octodb.design-bakery.com/api';
    this.key = opts.key;
    this.workspaceId = opts.workspaceId;
    this.timeoutMs = opts.timeoutMs ?? 30000;
  }
  private async post(path: string, body: unknown): Promise<any> {
    const r = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}`, 'User-Agent': 'copilot-engine/0.1' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!r.ok) throw new Error(`octo ${path} ${r.status}`);
    return r.json();
  }
  rag(body: Record<string, unknown>) { return this.post('/rag/query', { workspaceId: this.workspaceId, ...body }); }
  sql(text: string, params: unknown[]) { return this.post(`/workspaces/${this.workspaceId}/query`, { sql: text, params }); }
}

const WORD = /^[a-z0-9][a-z0-9-]{0,39}$/;
// Languages and page types are short lowercase words; anything else is dropped rather than put into a prefix.
export function cleanFilter(f: SearchFilter | undefined): SearchFilter {
  const out: SearchFilter = {};
  const lang = f?.language?.trim().toLowerCase();
  const type = f?.pageType?.trim().toLowerCase();
  const section = f?.section?.trim().slice(0, 120);
  if (lang && WORD.test(lang)) out.language = lang;
  if (type && WORD.test(type)) out.pageType = type;
  if (section) out.section = section;
  return out;
}

export const MAX_SECTION_IDS = 500;
const likeEscape = (s: string) => s.replace(/[\\%_]/g, c => `\\${c}`);
const inList = (from: number, n: number) => Array.from({ length: n }, (_, i) => `$${from + i}`).join(',');

export class SiteRetriever implements Retriever {
  private octo: SiteOcto;
  private business: string;
  private rerank?: boolean;
  private maxSectionIds: number;
  // lastFilter: what the last search was narrowed by after cleaning, for traces and tests.
  lastFilter: SearchFilter = {};
  constructor(opts: { octo: SiteOcto; business: string; rerank?: boolean; maxSectionIds?: number }) {
    if (!WORD.test(opts.business)) throw new Error(`bad business id: ${opts.business}`);
    this.octo = opts.octo;
    this.business = opts.business;
    this.rerank = opts.rerank;
    this.maxSectionIds = opts.maxSectionIds ?? MAX_SECTION_IDS;
  }

  // The title prefix for a filter: language narrows first, page type inside it. A page type with no language cannot be
  // a prefix (the language comes first in the title), so it is applied to the results instead.
  prefix(f: SearchFilter): string {
    return `${this.business}/${f.language ? `${f.language}/${f.pageType ? `${f.pageType}/` : ''}` : ''}`;
  }

  async search(query: string, k: number, filter?: SearchFilter): Promise<Passage[]> {
    const f = cleanFilter(filter);
    this.lastFilter = f;
    const prefix = this.prefix(f);
    let documentIds: string[] | undefined;
    if (f.section) {
      const where = ['business = $1', "lower(section) like $2 escape '\\'"];
      const params: unknown[] = [this.business, `%${likeEscape(f.section.toLowerCase())}%`];
      if (f.language) { params.push(f.language); where.push(`language = $${params.length}`); }
      if (f.pageType) { params.push(f.pageType); where.push(`page_type = $${params.length}`); }
      const ids = (await this.octo.sql(`select doc_id from site_passages where ${where.join(' and ')} limit ${this.maxSectionIds + 1}`, params)).rows;
      if (!ids.length) return [];
      if (ids.length <= this.maxSectionIds) documentIds = ids.map(r => String(r.doc_id));
    }
    // A section too broad for an id list, or a page type with no language, is checked on the results; ask for more.
    const post = (f.pageType && !f.language) || (f.section && !documentIds);
    const limit = post ? Math.min(50, k * 5) : k;
    const res = await this.octo.rag({ query, limit, filter: { titlePrefix: prefix, ...(documentIds ? { documentIds } : {}) },
      ...(this.rerank === false ? { rerank: false } : {}) });
    const titles = (res.matches ?? []).map(m => String(m.title ?? '')).filter(t => t.startsWith(prefix));
    if (!titles.length) return [];
    const rows = (await this.octo.sql(
      `select id, url, title, section, page_type, language, last_modified, text from site_passages where business = $1 and id in (${inList(2, titles.length)})`,
      [this.business, ...titles])).rows;
    const byId = new Map(rows.map(r => [String(r.id), r]));
    const out: Passage[] = [];
    for (const t of titles) {
      const r = byId.get(t);
      if (!r) continue; // in search but not in the table: not cited, because it has no address
      if (f.pageType && r.page_type !== f.pageType) continue;
      if (f.language && r.language !== f.language) continue;
      if (f.section && !String(r.section ?? '').toLowerCase().includes(f.section.toLowerCase())) continue;
      out.push({ id: t, title: t, text: String(r.text), section: String(r.section ?? ''), pageType: String(r.page_type), language: String(r.language),
        lastModified: String(r.last_modified ?? ''), cite: { title: String(r.title) + (r.section ? `, ${r.section}` : ''), url: String(r.url) } });
      if (out.length === k) break;
    }
    return out;
  }
}
