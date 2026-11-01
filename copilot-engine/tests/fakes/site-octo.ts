// An in-process stand-in for the two Octo calls the site code makes: /rag/query (title-prefix and document-id filters,
// word-overlap scoring) and the workspace SQL surface (SQLite, with $n parameters turned into ?n). Test use only.
import { DatabaseSync } from 'node:sqlite';
import type { SiteOcto } from '../../src/site-search.ts';

export type SeedPassage = { business: string; url: string; title: string; section: string; pageType: string; language: string; text: string; lastModified?: string };

const words = (s: string) => new Set((s.toLowerCase().match(/[a-z0-9]+/g) ?? []));

export class FakeSiteOcto implements SiteOcto {
  db = new DatabaseSync(':memory:');
  docs: { documentId: string; title: string; content: string }[] = [];
  ragCalls: { query?: unknown; limit?: number; filter?: { titlePrefix?: string; documentIds?: string[] } }[] = [];
  sqlCalls: { text: string; params: unknown[] }[] = [];
  leaky = false; // ignore the title prefix, to prove the caller does not trust Octo to scope
  constructor() {
    this.db.exec(`create table site_passages (id text primary key, business text not null, url text not null, seq int not null, title text, section text,
      page_type text, language text, last_modified text, text_hash text, text text not null, doc_id text)`);
  }
  seed(rows: SeedPassage[]): string[] {
    const ids: string[] = [];
    const ins = this.db.prepare('insert into site_passages (id, business, url, seq, title, section, page_type, language, last_modified, text_hash, text, doc_id) values (?,?,?,?,?,?,?,?,?,?,?,?)');
    rows.forEach((r, i) => {
      const id = `${r.business}/${r.language}/${r.pageType}/${String(this.docs.length).padStart(6, '0')}`;
      const doc = `doc-${this.docs.length}`;
      this.docs.push({ documentId: doc, title: id, content: `${r.title} - ${r.section}\n${r.text}` });
      ins.run(id, r.business, r.url, i, r.title, r.section, r.pageType, r.language, r.lastModified ?? '2026-10-01', 'h', r.text, doc);
      ids.push(id);
    });
    return ids;
  }
  async rag(body: Record<string, unknown>) {
    this.ragCalls.push(body as (typeof this.ragCalls)[number]);
    const f = (body.filter ?? {}) as { titlePrefix?: string; documentIds?: string[] };
    const q = words(String(body.query));
    const hits = this.docs
      .filter(d => this.leaky || !f.titlePrefix || d.title.startsWith(f.titlePrefix))
      .filter(d => !f.documentIds || f.documentIds.includes(d.documentId))
      .map(d => ({ d, s: [...words(d.content)].filter(w => q.has(w)).length }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s || (a.d.title < b.d.title ? -1 : 1))
      .slice(0, Number(body.limit ?? 10));
    return { matches: hits.map(x => ({ chunkId: x.d.documentId, documentId: x.d.documentId, title: x.d.title, content: x.d.content })) };
  }
  async sql(text: string, params: unknown[]) {
    this.sqlCalls.push({ text, params });
    const rows = this.db.prepare(text.replace(/\$(\d+)/g, '?$1')).all(...(params as any[])) as Record<string, unknown>[];
    return { rows };
  }
}
