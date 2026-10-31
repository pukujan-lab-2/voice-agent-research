// The corpus under test: passages to write questions from, and the store the target searches.
// Sources: "octo-sql" (a SQL query over the workspace's tables, $1 = seed, $2 = how many) or "json" (a file of
// {id, text, title?} passages, for a manual exported from anywhere). A passage id must be what the target's
// retriever returns as the passage's title, so search results can be scored against it.
import fs from 'node:fs';
import path from 'node:path';
import { key } from './env.ts';

export type CorpusPassage = { id: string; text: string; title?: string; category?: string; url?: string };
export type Config = Record<string, any>;

export const octoBase = () => process.env.OCTO_BASE || 'https://octodb.design-bakery.com/api';
export async function octoSql(sql: string, params: unknown[] = []): Promise<any[]> {
  const ws = key('OCTO_WORKSPACE', 'octo_db_chatbots_workspace');
  const r = await fetch(`${octoBase()}/workspaces/${ws}/query`, {
    method: 'POST', signal: AbortSignal.timeout(120000),
    headers: { Authorization: `Bearer ${key('OCTO_KEY', 'octo_db_chatbots')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, ...(params.length ? { params } : {}) }),
  });
  if (!r.ok) throw new Error(`octo query ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).rows ?? [];
}

export async function samplePassages(cfg: Config, root: string): Promise<CorpusPassage[]> {
  const src = cfg.passages, n = cfg.counts.passages;
  if (src.source === 'octo-sql') return (await octoSql(src.sql, [src.seed, n])).map(r => ({ ...r, id: String(r.id) }));
  if (src.source === 'json') {
    const all: CorpusPassage[] = JSON.parse(fs.readFileSync(path.resolve(root, src.file), 'utf8'));
    // a seeded shuffle, so a re-run samples the same passages
    let h = [...String(src.seed ?? 'eval')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const rnd = () => ((h = (h * 1103515245 + 12345) >>> 0) / 2 ** 32);
    return all.map(p => [rnd(), p] as const).sort((a, b) => a[0] - b[0]).slice(0, n).map(x => x[1]);
  }
  throw new Error(`unknown passage source ${src.source}`);
}

// How big the searchable corpus is right now (for the report header).
export async function corpusSize(cfg: Config): Promise<string> {
  if (cfg.passages.source !== 'octo-sql' || !cfg.passages.countSql) return '';
  try { return JSON.stringify((await octoSql(cfg.passages.countSql))[0]); } catch { return ''; }
}
