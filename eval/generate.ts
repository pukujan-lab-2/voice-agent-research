// Writes the test sets from the corpus itself, not from an FAQ, so any document set can be tested.
// For each sampled passage, the generator model writes four things in one call:
//   casual        a spoken, casual question the passage answers, with typos or speech-to-text slips
//   vague         a question with two or more readings, whose right reply is one clarifying question (readings stored)
//   chain         2-3 turns: a question the passage answers, then follow-ups that lean on the earlier turn
//   unanswerable  a nearby question the document set cannot answer (right reply: "I don't know" or a hand-off)
// A second model (Jev) then rejects any question its passage does not actually answer, any "vague" question
// that isn't, and any "unanswerable" one the corpus could answer. Every kept item carries its gold passage id.
// Run: node eval/generate.ts --corpus irs        (cached per passage in eval/out/<corpus>/gen.jsonl; re-runs resume)
import fs from 'node:fs';
import path from 'node:path';
import { samplePassages, type Config, type CorpusPassage } from './lib/corpus.ts';
import { chat, firstJson, jev, setBudget, totalCost, usage } from './lib/llm.ts';
import { pool } from './lib/pool.ts';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (k: string, d = '') => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
export const loadConfig = (corpus: string): Config => JSON.parse(fs.readFileSync(path.join(root, 'eval/config', `${corpus}.json`), 'utf8'));

export type Item = {
  id: string; type: 'casual' | 'vague' | 'chain' | 'unanswerable';
  gold: string | null; turns: string[]; readings?: string[]; passage?: string; title?: string; category?: string;
  check?: Record<string, { choice: string; p: number }>;
};

const prompt = (cfg: Config, p: CorpusPassage) => `You write test questions for a voice assistant that answers ${cfg.audience}. It answers only from this document set: ${cfg.domain}.

Here is one passage from the documents${p.title ? ` (from "${p.title}")` : ''}:
"""
${p.text}
"""

Write, as JSON with exactly these keys:
{
  "casual": a question a caller would really say out loud that THIS passage answers. Casual and spoken: filler words, a lowercase start, and one or two typos or speech-to-text slips (a misheard word, a number said as words). Do not copy the passage's wording.
  "vague": {"question": a short question on the same topic that could mean two or more different things, so a good assistant should ask one clarifying question first, "readings": ["what the caller might mean, one", "two", ...]},
  "chain": [a first question THIS passage answers, then one or two follow-ups that only make sense after the first ("what about if I'm married?", "and is there a deadline for that?") and that this passage also answers],
  "unanswerable": a question on a nearby topic that a caller might ask but that this document set cannot answer (another country's or a US state's rules, a specific company's policy, a figure for a year not yet published, a personal fact about the caller). Not a request for personal advice.
}
Reply with the JSON only.`;

async function generate(cfg: Config, p: CorpusPassage): Promise<Item[]> {
  const text = await chat(cfg.generator, [{ role: 'user', content: prompt(cfg, p) }], { what: 'generator', json: true, maxTokens: 1400 });
  const j = firstJson<any>(text);
  if (!j) { console.log(`unparsed reply for ${p.id}: ${JSON.stringify(text.slice(0, 300))}`); return []; }
  const base = { gold: p.id, passage: p.text, title: p.title, category: p.category };
  const out: Item[] = [];
  const str = (x: unknown) => typeof x === 'string' && x.trim().length > 5 ? x.trim() : '';
  if (str(j.casual)) out.push({ ...base, id: `${p.id}|casual`, type: 'casual', turns: [str(j.casual)] });
  if (str(j.vague?.question) && Array.isArray(j.vague.readings) && j.vague.readings.length >= 2)
    out.push({ ...base, id: `${p.id}|vague`, type: 'vague', turns: [str(j.vague.question)], readings: j.vague.readings.map(String).slice(0, 4) });
  if (Array.isArray(j.chain) && j.chain.filter(str).length >= 2) out.push({ ...base, id: `${p.id}|chain`, type: 'chain', turns: j.chain.filter(str).slice(0, 3) });
  if (str(j.unanswerable)) out.push({ ...base, gold: null, id: `${p.id}|unanswerable`, type: 'unanswerable', turns: [str(j.unanswerable)] });
  return out;
}

// The second model's checks. Keep only what they pass.
const ANSWERS = { answers: 'The passage contains the answer to the question', not: 'The passage does not answer the question, or only touches the topic' };
async function check(cfg: Config, it: Item): Promise<boolean> {
  const passage = it.passage!;
  if (it.type === 'casual') {
    const c = await jev({ question: it.turns[0], passage }, { fit: { instructions: 'The question is spoken and may have typos; read it as the caller meant it.', criteria: ANSWERS } }, 'checker');
    it.check = c ?? undefined;
    return c?.fit.choice === 'answers';
  }
  if (it.type === 'chain') {
    const c = await jev({ conversation: it.turns.map((t, i) => `turn ${i + 1}: ${t}`).join('\n'), passage }, {
      first: { instructions: 'Look only at turn 1.', criteria: ANSWERS },
      follow: { instructions: 'Look at the last turn, read in the context of the earlier turns.', criteria: {
        answers: 'The passage answers the last turn, and the last turn depends on an earlier turn to make sense',
        not: 'The passage does not answer the last turn, or the last turn makes full sense on its own' } },
    }, 'checker');
    it.check = c ?? undefined;
    return c?.first.choice === 'answers' && c?.follow.choice === 'answers';
  }
  if (it.type === 'vague') {
    const c = await jev({ question: it.turns[0], possible_readings: it.readings, passage }, {
      vague: { instructions: 'Would a careful expert need to ask which one the caller means before answering?', criteria: {
        vague: 'Yes: the question has two or more readings with different answers', clear: 'No: one reading is clearly meant, or the answers would be the same' } },
      topic: { instructions: 'Is one of the readings answered by the passage?', criteria: { yes: 'At least one reading is answered by the passage', no: 'None of the readings is answered by the passage' } },
    }, 'checker');
    it.check = c ?? undefined;
    return c?.vague.choice === 'vague' && c?.topic.choice === 'yes';
  }
  const c = await jev({ question: it.turns[0], documents: cfg.domain }, { covered: { instructions: 'Could this document set answer the question?', criteria: {
    no: 'No: the answer is outside these documents (another jurisdiction, a private policy, a personal fact, an unpublished figure)',
    yes: 'Yes, or probably: the documents could answer it' } } }, 'checker');
  it.check = c ?? undefined;
  return c?.covered.choice === 'no';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const corpus = arg('--corpus', 'irs');
  const cfg = loadConfig(corpus);
  setBudget(cfg.budgetUsd);
  const dir = path.join(root, 'eval/out', corpus);
  fs.mkdirSync(dir, { recursive: true });
  const cacheFile = path.join(dir, 'gen.jsonl');
  const done = new Map<string, { items: Item[]; kept: string[] }>();
  if (fs.existsSync(cacheFile)) for (const l of fs.readFileSync(cacheFile, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); done.set(r.passage, r); }
  const t0 = Date.now();
  const passages = (await samplePassages(cfg, root)).slice(0, Number(arg('--limit', '100000')));
  console.log(`${passages.length} passages sampled (${done.size} already generated)`);
  let n = 0;
  await pool(passages.filter(p => !done.has(p.id)), cfg.concurrency, async p => {
    const items = await generate(cfg, p).catch(e => { console.log(`gen failed ${p.id}: ${e.message}`); return [] as Item[]; });
    const kept: string[] = [];
    for (const it of items) if (await check(cfg, it)) kept.push(it.id);
    const rec = { passage: p.id, items, kept };
    done.set(p.id, rec);
    fs.appendFileSync(cacheFile, JSON.stringify(rec) + '\n');
    console.log(`${String(++n).padStart(3)} ${p.id.slice(0, 50).padEnd(50)} ${items.length} written, ${kept.length} kept   $${totalCost().toFixed(4)}`);
  });
  // The sets: kept items, in passage order, capped at the configured count per type.
  const sets: Record<string, Item[]> = { casual: [], vague: [], chain: [], unanswerable: [] };
  let written = 0;
  for (const p of passages) {
    const r = done.get(p.id);
    if (!r) continue;
    written += r.items.length;
    for (const it of r.items) if (r.kept.includes(it.id) && sets[it.type].length < cfg.counts[it.type]) sets[it.type].push(it);
  }
  // spend accumulates over top-up runs
  const setsFile = path.join(dir, 'sets.json');
  const prevUsage = fs.existsSync(setsFile) ? JSON.parse(fs.readFileSync(setsFile, 'utf8')).stats?.usage ?? {} : {};
  for (const [k, u] of Object.entries(prevUsage) as [string, any][]) {
    const x = (usage[k] ??= { calls: 0, cost: 0, ms: 0, failed: 0 });
    x.calls += u.calls; x.cost += u.cost; x.ms += u.ms; x.failed += u.failed;
  }
  const stats = { written, kept: Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.length])), seconds: Math.round((Date.now() - t0) / 1000), usage };
  fs.writeFileSync(path.join(dir, 'sets.json'), JSON.stringify({ when: new Date().toISOString(), corpus, generator: cfg.generator, checker: cfg.checker, stats, sets }, null, 1));
  console.log(JSON.stringify(stats.kept), `written ${written}, cost $${totalCost().toFixed(4)}, ${stats.seconds}s`);
}
