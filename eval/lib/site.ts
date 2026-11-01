// The library path as the widget runs it against a running site: the site's own search, judge and sentence routes
// (demo/live-site/widget/remote.ts), so a replay needs no keys. The site holds them.
import type { Judge, Passage, Retriever } from '../../copilot-engine/src/guide.ts';

export function siteLibrary(site: string, manual = 'irs'): { retriever: Retriever; judge: Judge } {
  const post = async (p: string, body: unknown) => {
    const r = await fetch(`${site.replace(/\/$/, '')}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`${p} answered ${r.status}`);
    return r.json() as Promise<any>;
  };
  let last: Passage | undefined;
  return {
    retriever: { async search(query, k) { return (await post('/api/search', { manual, query, k })).passages ?? []; } },
    judge: {
      async pick(question, passages) { const id: string = (await post('/api/judge', { question, passages })).id ?? ''; last = passages.find(p => p.id === id); return id; },
      async sentences(question, sentences) { return last ? (await post('/api/sentences', { question, passage: last, sentences })).idx ?? [] : []; },
    },
  };
}
