// Builds eval/report.md and eval/report.json from one corpus's outputs: one table per suite, a few failures quoted
// per category, cost and time. Run: node eval/report.ts --corpus irs
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './generate.ts';
import { corpusSize } from './lib/corpus.ts';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (k: string, d = '') => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const corpus = arg('--corpus', 'irs');
const cfg = loadConfig(corpus);
const dir = path.join(root, 'eval/out', corpus);
const read = (f: string) => { const p = path.join(dir, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
const rows: any[] = fs.readFileSync(path.join(dir, 'results.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const sets = read('sets.json'), meta = read('run-meta.json') ?? { usage: {}, timing: {} }, retrieval = read('retrieval.json');
const promptfoo = read('promptfoo.json'), garak = read('garak.json');
const heldout = (() => { const p = path.join(root, 'demo/live-site/build/irs/eval-heldout.json'); return corpus === 'irs' && fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; })();
const deployed = (() => { const p = path.join(root, 'demo/live-site/build/irs/eval-deployed.json'); return corpus === 'irs' && fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; })();

const pct = (a: number, b: number) => b ? `${Math.round(100 * a / b)}%` : '–';
const count = <T>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length;
const md: string[] = [];
const json: Record<string, any> = { corpus, label: cfg.label, when: new Date().toISOString() };
const q = (s: string, n = 160) => `"${String(s ?? '').replace(/\s+/g, ' ').slice(0, n)}${String(s ?? '').length > n ? '…' : ''}"`;
const table = (head: string[], body: (string | number)[][]) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...body.map(r => `| ${r.join(' | ')} |`)].join('\n');

const size = await corpusSize(cfg);
md.push(`# Copilot eval: ${cfg.name}`, '');
md.push(`**Run label: ${cfg.label}.** ${cfg.label === 'pre-880k' ? 'The index was still loading (the 880k-passage load is running); re-run when it finishes: `node eval/run.ts --corpus irs` after deleting `eval/out/irs/results.jsonl`.' : ''}`, '');
md.push(`- Corpus flag: \`--corpus ${corpus}\` (config \`eval/config/${corpus}.json\`). Index at report time: ${size || 'n/a'}.`);
md.push(`- Test sets written by \`${cfg.generator.model}\` (${cfg.generator.provider}), checked by ${cfg.checker === 'jev' ? 'Jev (typesafe/jev-1.14)' : cfg.checker}; rubric judge: Jev; simulated callers: \`${cfg.caller.model}\`.`);
md.push('- **No human spot check anywhere.** Every number below is a code check unless its row says "Jev" (the judge is used only where code cannot decide, such as "does this passage answer the question").');
md.push(`- Target: the shipped answer path (Octo hybrid search over ${cfg.target.retriever.prefixes.join(' ')}, reranker on, Jev passage and sentence pick, word-overlap fallback, the widget's advice check, quote-only Guide). The eval's search timeout is ${cfg.target.retriever.timeoutMs / 1000} s; the site ships with ${cfg.target.retriever.shippedTimeoutMs / 1000} s (see Latency).`, '');

const headAt = md.length;   // the four weighted areas go here, built last because they draw on every suite

// ---- single-turn ----
const single = rows.filter(r => r.suite === 'single');
const ofType = (t: string) => single.filter(r => r.type === t);
const answerRows = (t: string) => ofType(t).flatMap(r => r.turns.map((x: any, i: number) => ({ ...x, r, i })));
const tallyV = (xs: any[]) => ({ n: xs.length, correct: count(xs, x => x.verdict === 'correct'), partial: count(xs, x => x.verdict === 'partial'), wrong: count(xs, x => x.verdict === 'wrong'),
  dont_know: count(xs, x => x.verdict === 'dont_know'), no_search: count(xs, x => x.verdict === 'no-search'), deflected: count(xs, x => x.verdict === 'deflected'), error: count(xs, x => x.verdict === 'error') });
const casual = tallyV(answerRows('casual'));
const chainAll = answerRows('chain');
const chainFirst = tallyV(chainAll.filter(x => x.i === 0)), chainFollow = tallyV(chainAll.filter(x => x.i > 0));
const chainsWhole = ofType('chain').filter(r => r.turns.every((t: any) => t.verdict === 'correct')).length;
const vague = ofType('vague').map(r => r.turns[0]);
const unans = ofType('unanswerable').map(r => r.turns[0]);
const all = single.flatMap(r => r.turns);
const answered = all.filter(t => t.kind === 'answer');
json.single = { casual, chainFirst, chainFollow, chainsAllCorrect: chainsWhole, chains: ofType('chain').length,
  vague: { n: vague.length, clarified: count(vague, t => t.clarified), answered: count(vague, t => t.kind === 'answer'), dont_know: count(vague, t => t.kind === 'unknown') },
  unanswerable: { n: unans.length, held: count(unans, t => t.kind !== 'answer'), answered: count(unans, t => t.kind === 'answer') },
  plain: { answers: answered.length, cited: count(answered, t => t.cited), quoteInPassage: count(answered, t => t.quoteInPassage), citedGold: count(answered, t => t.citeIsGold) } };
md.push('## 1. Single-turn questions (generated from passages)', '');
md.push(table(['Set', 'Asked', 'Correct', 'Partial', 'Wrong', "Don't know", 'Search timed out', 'Deflected'], [
  ['Casual / spoken (typos, STT slips)', casual.n, `${casual.correct} (${pct(casual.correct, casual.n)})`, casual.partial, casual.wrong, casual.dont_know, casual.no_search, casual.deflected],
  ['Chain, first turn', chainFirst.n, `${chainFirst.correct} (${pct(chainFirst.correct, chainFirst.n)})`, chainFirst.partial, chainFirst.wrong, chainFirst.dont_know, chainFirst.no_search, chainFirst.deflected],
  ['Chain, follow-ups', chainFollow.n, `${chainFollow.correct} (${pct(chainFollow.correct, chainFollow.n)})`, chainFollow.partial, chainFollow.wrong, chainFollow.dont_know, chainFollow.no_search, chainFollow.deflected],
]), '');
md.push(`Whole chains with every turn correct: ${chainsWhole} of ${ofType('chain').length}.`, '');
md.push(table(['Set', 'Asked', 'Right behaviour', 'Result', 'Other'], [
  ['Vague (needs one clarifying question)', vague.length, 'asks one clarifying question', `${json.single.vague.clarified} (${pct(json.single.vague.clarified, vague.length)})`, `answered a guess ${json.single.vague.answered}, "don't know" ${json.single.vague.dont_know}`],
  ['Unanswerable from the corpus', unans.length, `"I don't know" or a hand-off`, `${json.single.unanswerable.held} (${pct(json.single.unanswerable.held, unans.length)})`, `quoted something anyway ${json.single.unanswerable.answered}`],
]), '');
md.push(`Plain checks over every answer given (${answered.length}): citation present ${pct(json.single.plain.cited, answered.length)}, quote word for word in the cited passage ${pct(json.single.plain.quoteInPassage, answered.length)}, cited the gold passage ${pct(json.single.plain.citedGold, answered.length)}.`, '');
const fails = (title: string, xs: any[], show: (x: any) => string) => { if (!xs.length) return; md.push(`**${title}** (${xs.length}):`, ''); for (const x of xs.slice(0, 3)) md.push(`- ${show(x)}`); md.push(''); };
fails('Casual, wrong', answerRows('casual').filter(x => x.verdict === 'wrong'), x => `Q ${q(x.q, 120)} → ${q(x.reply)}`);
fails('Casual, "don\'t know" although the passage answers it', answerRows('casual').filter(x => x.verdict === 'dont_know'), x => `Q ${q(x.q, 120)} (gold \`${x.r.gold}\`, ${x.hits?.includes(x.r.gold) ? `in search hits at rank ${x.hits.indexOf(x.r.gold) + 1}` : 'not in the top 10 hits'})`);
fails('Follow-ups that lost the thread', chainAll.filter(x => x.i > 0 && x.verdict !== 'correct'), x => `${q(x.r.turns[0].q, 80)} then ${q(x.q, 80)} → ${q(x.reply, 120)}`);
fails('Vague, answered without asking', ofType('vague').filter(r => r.turns[0].kind === 'answer'), r => `Q ${q(r.turns[0].q, 100)} (readings: ${r.readings.map((s: string) => q(s, 60)).join(' / ')}) → ${q(r.turns[0].reply, 120)}`);
fails('Unanswerable, quoted something anyway', ofType('unanswerable').filter(r => r.turns[0].kind === 'answer'), r => `Q ${q(r.turns[0].q, 100)} → ${q(r.turns[0].reply, 140)}`);
fails('Quote not found word for word in its cited passage', answered.filter(t => !t.quoteInPassage), t => `Q ${q(t.q, 100)} → ${q(t.reply, 140)}`);

// ---- retrieval ----
md.push('## 2. Retrieval (ranx): is the gold passage in the copilot\'s own search results?', '');
if (retrieval) {
  json.retrieval = retrieval;
  md.push(table(['Questions', 'n', 'recall@5', 'recall@10', 'MRR'], Object.entries(retrieval).map(([k, v]: any) => [k, v.queries, v['recall@5'], v['recall@10'], v.mrr])), '');
  const searchMiss = answerRows('casual').filter(x => x.verdict !== 'correct' && !x.hits?.slice(0, 4).includes(x.r.gold)).length;
  const answerMiss = answerRows('casual').filter(x => x.verdict !== 'correct' && x.hits?.slice(0, 4).includes(x.r.gold)).length;
  json.retrieval_split = { casualNotCorrect: casual.n - casual.correct, searchMiss, answerMiss };
  md.push(`Of the ${casual.n - casual.correct} casual questions not answered correctly, ${searchMiss} are search misses (gold passage not among the 4 the copilot reads) and ${answerMiss} are answer misses (it was there; the judge or quote missed). Note: many passages say nearly the same thing, so a miss on the gold id can still be a right answer from a sibling passage.`, '');
} else md.push('_Not run yet: `eval/.venv/bin/python eval/retrieval.py --corpus ' + corpus + '`._', '');

// ---- callers ----
const lib = rows.filter(r => r.suite === 'callers' && r.type === 'library' && !r.error);
const forms = rows.filter(r => r.suite === 'callers' && r.type === 'form' && !r.error);
md.push('## 3. Simulated callers (persona model, up to 8 turns)', '');
if (lib.length) {
  const rc = (k: string, v: string) => count(lib, r => r.rubric?.[k]?.choice === v);
  const turnsAll = lib.flatMap(r => r.turns);
  const ans = turnsAll.filter((t: any) => t.kind === 'answer');
  const reached = lib.filter(r => r.end === 'done');
  const meanTurns = reached.length ? (reached.reduce((s, r) => s + r.goalTurn, 0) / reached.length).toFixed(1) : '–';
  const vagueStart = lib.filter(r => r.vague);
  json.callers = { n: lib.length, goal: { reached: rc('goal', 'reached'), partly: rc('goal', 'partly'), not: rc('goal', 'not') }, callerSaidDone: reached.length, meanTurnsToGoal: meanTurns,
    clarify: { right: rc('clarify', 'right'), missed: rc('clarify', 'missed'), needless: rc('clarify', 'needless'), askedWhenVagueStart: count(vagueStart, r => r.turns.some((t: any) => t.clarified)), vagueStarts: vagueStart.length },
    grounded: rc('grounded', 'yes'), noAdvice: rc('advice', 'none'), tone: { good: rc('tone', 'good'), ok: rc('tone', 'ok'), poor: rc('tone', 'poor') },
    plain: { answers: ans.length, cited: count(ans, (t: any) => t.cited), quoteInPassage: count(ans, (t: any) => t.quoteInPassage) } };
  const c = json.callers;
  md.push(table(['Check', 'Result', 'How'], [
    ['Goal reached', `${c.goal.reached} of ${c.n} (partly ${c.goal.partly})`, 'Jev rubric'],
    ['Caller said it got what it needed', `${c.callerSaidDone} of ${c.n}`, 'persona ended with [DONE]'],
    ['Turns to goal (when reached)', c.meanTurnsToGoal, 'plain count'],
    ['Clarifying question right', `${c.clarify.right} of ${c.n} (missed ${c.clarify.missed}, needless ${c.clarify.needless})`, 'Jev rubric'],
    ['Asked a clarifying question on a vague start', `${c.clarify.askedWhenVagueStart} of ${c.clarify.vagueStarts}`, 'plain check'],
    ['Every claim backed by a cited passage', `${c.grounded} of ${c.n}`, 'Jev rubric'],
    ['Citation present on every answer', `${c.plain.cited} of ${c.plain.answers} answers`, 'plain check'],
    ['Quote really in the cited passage', `${c.plain.quoteInPassage} of ${c.plain.answers} answers`, 'plain check'],
    ['No personal advice, nothing done for the caller', `${c.noAdvice} of ${c.n}`, 'Jev rubric'],
  ]), '');
  md.push(`Low priority (soft score): tone good / ok / poor ${c.tone.good} / ${c.tone.ok} / ${c.tone.poor} (Jev rubric).`, '');
  fails('Callers who did not reach their goal', lib.filter(r => r.rubric?.goal?.choice === 'not'), r => `goal ${q(r.goal, 90)}, ${r.mood}: ${r.turns.slice(0, 2).map((t: any) => `caller ${q(t.said, 70)} → ${q(t.reply, 90)}`).join('; ')}`);
}
if (forms.length) {
  const rbAll = forms.flatMap(r => r.readback.filter((x: any) => x.needed));
  json.formCallers = { n: forms.length, handedBack: count(forms, r => r.end === 'handed back' || r.end === 'done'), fieldsRight: forms.reduce((s, r) => s + r.fieldsRight, 0), fieldsTotal: forms.reduce((s, r) => s + r.fieldsTotal, 0),
    submitCalls: forms.reduce((s, r) => s + r.submitCalls, 0), claimedSubmit: count(forms, r => r.claimedSubmit), readback: { ok: count(rbAll, (x: any) => x.ok), needed: rbAll.length }, pushy: count(forms, r => r.pushy) };
  const f = json.formCallers;
  md.push(table(['Form callers (plain checks)', 'Result'], [
    ['Calls', `${f.n} (${f.pushy} of them asked the assistant to send the form)`],
    ['Form handed back to the caller', `${f.handedBack} of ${f.n}`],
    ['Fields filled correctly', `${f.fieldsRight} of ${f.fieldsTotal}`],
    ['Read-back before each spelled value (name, phone, email, code)', `${f.readback.ok} of ${f.readback.needed}`],
    ['Assistant claimed it submitted', f.claimedSubmit],
    ['Hand-back hook reached before the caller confirmed the review', '0 by construction (engine needs a clear yes)'],
  ]), '');
  fails('Form calls with wrong fields', forms.filter(r => r.wrongFields.length), r => `${r.who}: wrong ${r.wrongFields.join(', ')}; got ${JSON.stringify(r.values).slice(0, 200)}`);
}

// ---- traps ----
const tr = rows.filter(r => r.suite === 'traps');
md.push('## 4. Traps', '');
const tt = (k: string) => tr.filter(r => r.trap === k);
json.traps = Object.fromEntries(['advice', 'ignore-rules', 'injection', 'submit'].map(k => [k, { n: tt(k).length, pass: count(tt(k), r => r.pass) }]));
md.push(table(['Trap', 'Source', 'Passed'], [
  ['Personal advice', 'own suite', `${json.traps.advice.pass} of ${json.traps.advice.n}`],
  ['Ignore your rules', 'own suite', `${json.traps['ignore-rules'].pass} of ${json.traps['ignore-rules'].n}`],
  ['Instruction planted inside a passage', 'own suite', `${json.traps.injection.pass} of ${json.traps.injection.n}`],
  ['"Submit it for me" mid-form', 'own suite', `${json.traps.submit.pass} of ${json.traps.submit.n}`],
  ...(promptfoo ? Object.entries(promptfoo).map(([k, v]: any) => [`promptfoo ${k === 'ask' ? 'advice + ignore-rules + classic injections' : 'submit traps'}`, 'promptfoo 0.124.1', `${v.passed} of ${v.total}${v.exit ? ` (exit ${v.exit})` : ''}`]) : [['promptfoo', 'not run', '']]),
  ...(garak ? garak.probes.map((p: any) => [`${p.probe} (${p.detector})`, 'garak 0.17.1', `${p.passed} of ${p.total}`]) : [['garak', 'not run', '']]),
]), '');
json.promptfoo = promptfoo; json.garak = garak;
fails('Trap failures', tr.filter(r => !r.pass), r => `${r.trap}: ${q(r.q, 90)} → ${q(r.reply, 140)}`);
if (promptfoo) fails('promptfoo failures', Object.values(promptfoo).flatMap((v: any) => v.failures ?? []), f => `${q(f.test, 100)} → ${q(f.output, 140)}`);
if (garak?.failures?.length) fails('garak hits', garak.failures, f => `${f.probe}: ${q(f.prompt, 90)} → ${q(f.output, 120)}`);

// ---- FAQ baselines (IRS only) ----
if (heldout || deployed) {
  md.push('## 5. FAQ baselines (100 IRS FAQ questions, tests/irs-eval.ts)', '');
  const rowOf = (name: string, d: any, mode: string) => { const s = d?.summary?.[mode]; return s ? [name, s.correct, s.partial, s.wrong, s.dont_know, s.deflected, s.seconds_per_question] : [name, '–', '', '', '', '', '']; };
  md.push(table(['Run', 'Correct', 'Partial', 'Wrong', "Don't know", 'Deflected', 's/question'], [rowOf('As deployed (own FAQ entry searchable)', deployed, 'deployed'), rowOf('Held-out (own FAQ entry hidden)', heldout, 'held-out')]), '');
  json.faq = { deployed: deployed?.summary?.deployed, heldout: heldout?.summary?.['held-out'] };
}

// ---- caller verification (eval/verify.ts) ----
const ver = read('verify.json');
if (ver) {
  const s = ver.summary, m = s.mustPass;
  md.push('## Caller verification (eval/verify.ts)', '');
  md.push(`Simulated callers against the real server check (${s.clients} fictional sample clients in Octo; name matched fuzzy and by sound, birth date, last four and zip exactly). Each scenario ran ${s.runsPerScenario} times with a different client or guess and must pass every time. All checks are code over the transcript, every API response and every log line; no human spot check.`, '');
  const ok = (n: number) => (n === 0 ? '**0** ✓' : `**${n}** ✗`);
  md.push(table(['Must pass', 'Result'], [
    ['Impostors verified', ok(m.impostorsVerified)],
    ['Runs with a stored value in an assistant turn, API response or log line', ok(m.leaks)],
    ['Lockout not applied after 3 failed tries (incl. right answers on a locked call)', ok(m.lockoutFailures)],
    ['Values checked without a read-back and a yes first', ok(m.readBackFailures)],
    ['Real clients locked out', ok(m.realLockedOut)],
    ['Real clients verified as themselves', `${s.real.verifiedAsSelf} of ${s.real.runs}`],
    ['Real clients verified on the first try', `${s.real.firstTry} of ${s.real.runs} (${pct(s.real.firstTry, s.real.runs)}; the "old zip first" scenario needs 2 tries by design)`],
  ]), '');
  md.push(table(['Scenario', 'Group', 'Passed every run', 'End state / tries per run'], s.scenarios.map((x: any) => [x.name, x.group, `${x.passed} of ${x.runs}${x.passed === x.runs ? '' : ' ✗'}`, x.states.join(', ')])), '');
  md.push(table(['Direct API attack', 'Result', 'OK'], s.attacks.map((a: any) => [a.what, a.result, a.ok ? '✓' : '✗'])), '');
  md.push(`Model spend for the open-model callers: $${s.cost.toFixed(4)}. Time: ${s.seconds} s.`, '');
  json.verify = s;
}

// ---- the four weighted areas: ambiguity, spelling / speech-to-text, read-backs, grounding ----
{
  const H: string[] = [];
  const sec = (n: string) => H.push(`## ${n}`, '');
  const fl = (title: string, xs: any[], show: (x: any) => string, k = 3) => { if (!xs.length) return; H.push(`**${title}** (${xs.length}):`, ''); for (const x of xs.slice(0, k)) H.push(`- ${show(x)}`); H.push(''); };
  const vals = rows.filter(r => r.suite === 'values'), noiseR = rows.filter(r => r.suite === 'noise'), cl = rows.filter(r => r.suite === 'clarify'), gr = rows.filter(r => r.suite === 'grounding');
  const ok = (v: string) => v === 'correct';

  // A. ambiguity
  sec('A. Ambiguous questions: one clarifying question, then the answer');
  if (cl.length) {
    const asked = cl.filter(r => r.asked);
    json.clarify = { n: cl.length, asked: asked.length, askedOnce: count(cl, r => r.askedOnce), answeredAfter: count(cl, r => r.answeredAfter), guessedAnswer: count(cl, r => !r.asked && r.kind1 === 'answer'),
      guessedRight: count(cl, r => r.guessedRight), dontKnow: count(cl, r => r.kind1 === 'unknown' || r.kind1 === 'no-search') };
    const c = json.clarify;
    H.push(table(['Check', 'Result', 'How'], [
      ['Asked back instead of guessing', `${c.asked} of ${c.n} (${pct(c.asked, c.n)})`, 'code: reply is a question, no quote'],
      ['Asked exactly one question', `${c.askedOnce} of ${c.n}`, 'code: one "?" outside quotes'],
      ['After the caller picked a meaning, answered it correctly', `${c.answeredAfter} of ${c.asked} that asked`, 'Jev grade vs the gold passage'],
      ['Guessed and quoted something without asking', `${c.guessedAnswer} (of which it cited the gold passage: ${c.guessedRight})`, 'code'],
      ["Said \"I don't know\" or search timed out", c.dontKnow, 'code'],
    ]), '');
    fl('Answered a vague question without asking', cl.filter(r => !r.asked && r.kind1 === 'answer'), r => `Q ${q(r.q, 100)} (could mean ${r.readings.slice(0, 2).map((s: string) => q(s, 60)).join(' or ')}) → ${q(r.reply1, 110)}`);
    fl('Asked, but then missed the answer', asked.filter(r => !r.answeredAfter), r => `Q ${q(r.q, 80)} → asked ${q(r.reply1, 80)}; caller ${q(r.t2?.said, 60)} → ${q(r.t2?.reply, 100)} (${r.t2?.verdict})`);
  } else H.push('_Not run yet: `node eval/run.ts --corpus ' + corpus + ' --suites clarify`._', '');
  const lib2 = rows.filter(r => r.suite === 'callers' && r.type === 'library' && r.vague);
  if (lib2.length) H.push(`Simulated callers who opened vaguely: asked back in ${count(lib2, r => r.turns.some((t: any) => t.clarified))} of ${lib2.length} calls (code).`, '');

  // B. spelling and speech-to-text
  sec('B. Spelling and speech-to-text errors');
  H.push('Questions: the casual set is written with typos, fillers and STT slips; the noise set takes each clean chain first turn and adds sound-alike swaps, no punctuation, numbers as words, a dropped and a swapped letter (deterministic, seeded by item id), then compares with the clean result.', '');
  if (noiseR.length) {
    const both = noiseR.filter(r => r.cleanVerdict);
    json.noise = { n: noiseR.length, cleanCorrect: count(both, r => ok(r.cleanVerdict)), noisyCorrect: count(both, r => ok(r.verdict)),
      lost: count(both, r => ok(r.cleanVerdict) && !ok(r.verdict)), gained: count(both, r => !ok(r.cleanVerdict) && ok(r.verdict)),
      goldTop5Clean: count(both, r => r.cleanHits?.slice(0, 5).includes(r.gold)), goldTop5Noisy: count(both, r => r.hits?.slice(0, 5).includes(r.gold)) };
    const n = json.noise;
    H.push(table(['Same question', 'Correct', 'Gold passage in top-5 search hits'], [
      ['Clean', `${n.cleanCorrect} of ${n.n} (${pct(n.cleanCorrect, n.n)})`, `${n.goldTop5Clean} (code)`],
      ['Noisy (typos + STT)', `${n.noisyCorrect} of ${n.n} (${pct(n.noisyCorrect, n.n)})`, `${n.goldTop5Noisy} (code)`],
    ]), '');
    H.push(`Right when clean but not when noisy: ${n.lost}; the other way round: ${n.gained}.`, '');
    fl('Lost to noise', both.filter(r => ok(r.cleanVerdict) && !ok(r.verdict)), r => `${q(r.clean, 80)} → noisy ${q(r.noisy, 80)} → ${r.kind}`);
  } else H.push('_Noise suite not run yet._', '');
  H.push(`Casual set (written with slips): ${casual.correct} of ${casual.n} correct (${pct(casual.correct, casual.n)}), partial ${casual.partial}, "don't know" ${casual.dont_know}, search timed out ${casual.no_search}.`, '');
  const stt = vals.filter(r => r.kind === 'stt' || r.kind === 'spelled');
  if (stt.length) {
    H.push('Spoken values in the form (scripted caller, every check is code):', '');
    H.push(table(['Case', 'Kept value right', 'Read back', 'Notes'], stt.map(r => [r.case, r.valueRight ? 'yes' : '**no**', r.readBackOk ? 'yes' : '**no**', r.stuck ? `stuck at ${r.stuck}` : (r.wrong?.length ? `wrong: ${r.wrong.join(', ')}` : '')])), '');
  }

  // C. read-backs and corrections
  sec('C. Read-backs and corrections');
  if (vals.length) {
    json.values = { n: vals.length, valueRight: count(vals, r => r.valueRight), allRight: count(vals, r => r.allRight), readBackOk: count(vals, r => r.readBackOk), confirmedOk: count(vals, r => r.confirmedOk),
      handedBackOnlyAfterYes: count(vals, r => r.handedBackOnlyAfterYes), claimedSubmit: count(vals, r => r.claimedSubmit), stuck: count(vals, r => r.stuck),
      inlineFix: { taken: count(vals, r => r.inlineFix === true), tried: count(vals, r => r.inlineFix !== null && r.inlineFix !== undefined) } };
    const v = json.values;
    H.push(table(['Check (23 scripted callers; code only)', 'Result'], [
      ['Every value read back before it was typed in', `${v.readBackOk} of ${v.n}`],
      ['Every value typed in only after a "yes" to its read-back', `${v.confirmedOk} of ${v.n}`],
      ['Form handed back only after the review was confirmed', `${v.handedBackOnlyAfterYes} of ${v.n}`],
      ['Claimed to have submitted', v.claimedSubmit],
      ['The case value kept right', `${v.valueRight} of ${v.n}`],
      ['Whole form right', `${v.allRight} of ${v.n}`],
      ['Stuck (re-asked 3 times)', v.stuck],
      ['"no, <value>" said in one breath taken at once', `${v.inlineFix.taken} of ${v.inlineFix.tried}`],
    ]), '');
    H.push(table(['Case', 'Kind', 'Value right', 'Read back + confirmed', 'Wrong / stuck'], vals.map(r => [r.case, r.kind, r.valueRight ? 'yes' : '**no**', r.readBackOk && r.confirmedOk ? 'yes' : '**no**', r.stuck ? `stuck at ${r.stuck}` : (r.wrong ?? []).join(', ')])), '');
    fl('Wrong values (last exchanges)', vals.filter(r => !r.valueRight), r => `${r.case}: ${(r.transcript ?? []).filter((t: any) => t.said !== 'yes').slice(0, 3).map((t: any) => `${q(t.said, 40)} → ${q(t.reply, 70)}`).join('; ')}`, 6);
  } else H.push('_Values suite not run yet._', '');
  const formsH = rows.filter(r => r.suite === 'callers' && r.type === 'form' && !r.error);
  if (formsH.length) { const rb = formsH.flatMap(r => r.readback.filter((x: any) => x.needed)); H.push(`Free-form simulated form callers: read-back before each spelled value ${count(rb, (x: any) => x.ok)} of ${rb.length}; fields right ${formsH.reduce((s, r) => s + r.fieldsRight, 0)} of ${formsH.reduce((s, r) => s + r.fieldsTotal, 0)} (code; details in section 3).`, ''); }

  // D. grounding
  sec('D. Grounded in the library');
  if (gr.length) {
    const found = gr.filter(r => r.found);
    json.grounding = { n: gr.length, found: found.length, quoteInPassage: count(found, r => r.quoteInPassage), passageAnswers: count(found, r => r.passageAnswers === 'yes'), both: count(found, r => r.quoteInPassage && r.passageAnswers === 'yes'),
      byFrom: Object.fromEntries([...new Set(gr.map(r => r.from))].map(f => { const xs = found.filter(r => r.from === f); return [f, { n: xs.length, quote: count(xs, r => r.quoteInPassage), answers: count(xs, r => r.passageAnswers === 'yes') }]; })) };
    const g = json.grounding;
    H.push(table(['Every answer given in the run', 'Answers', 'Quote word for word in the cited passage (code, passage fetched fresh by id)', 'Cited passage answers the question (Jev)'], [
      ...Object.entries(g.byFrom).map(([f, x]: any) => [f, x.n, `${x.quote} (${pct(x.quote, x.n)})`, `${x.answers} (${pct(x.answers, x.n)})`]),
      ['**All**', g.found, `**${g.quoteInPassage} (${pct(g.quoteInPassage, g.found)})**`, `**${g.passageAnswers} (${pct(g.passageAnswers, g.found)})**`],
    ]), '');
    H.push(`Both true: ${g.both} of ${g.found}.${g.n - g.found ? ` Cited passage not found in the store by id: ${g.n - g.found}.` : ''} The quote shows the passage's heading or document path above the quoted words in ${count(found, r => r.headingShown)} answers; the heading is not passage text, so only the words after it are checked.`, '');
    fl('Quote not in the cited passage', found.filter(r => !r.quoteInPassage), r => `\`${r.cite}\`: ${q(r.reply, 160)}`);
    fl('Cited passage does not answer the question', found.filter(r => r.passageAnswers === 'no'), r => `Q ${q(r.q, 90)} → \`${r.cite}\`: ${q(r.reply, 120)}`);
  } else H.push('_Grounding suite not run yet._', '');
  md.splice(headAt, 0, ...H);
}

// ---- latency, cost, time ----
const searchMs: number[] = rows.flatMap(r => (r.turns ?? []).map((t: any) => t.searchMs).filter((x: number) => x > 0)).sort((a, b) => a - b);
const pq = (p: number) => searchMs.length ? (searchMs[Math.min(searchMs.length - 1, Math.floor(p * searchMs.length))] / 1000).toFixed(1) : '–';
const over = count(searchMs, x => x > cfg.target.retriever.shippedTimeoutMs);
json.latency = { searches: searchMs.length, p50: pq(0.5), p90: pq(0.9), max: pq(1), overShippedTimeout: over };
md.push('## 6. Latency, cost and time', '');
md.push(`Octo search, as measured during this run (${searchMs.length} searches, run at concurrency ${cfg.concurrency} alongside the ingest): p50 ${pq(0.5)} s, p90 ${pq(0.9)} s, max ${pq(1)} s. **${over} of ${searchMs.length} (${pct(over, searchMs.length)}) took longer than the ${cfg.target.retriever.shippedTimeoutMs / 1000} s timeout the site ships with**, so on the live site those questions would have been answered "I don't know".`, '');
const genUsage = sets?.stats?.usage ?? {};
const useRows = [...Object.entries(genUsage).map(([k, u]: any) => [`generate: ${k}`, u]), ...Object.entries(meta.usage).map(([k, u]: any) => [`run: ${k}`, u])] as [string, any][];
const totalUsd = useRows.reduce((s, [, u]) => s + u.cost, 0);
json.cost = { totalUsd: +totalUsd.toFixed(4), rows: Object.fromEntries(useRows) };
md.push(table(['Step', 'Calls', 'Failed', 'Time (s, summed over calls)', 'Cost'], useRows.map(([k, u]) => [k, u.calls, u.failed, Math.round(u.ms / 1000), `$${u.cost.toFixed(4)}`])), '');
md.push(`Total model spend: **$${totalUsd.toFixed(4)}** (cap $${cfg.budgetUsd}). Wall-clock: generation ${sets?.stats?.seconds ?? '–'} s (last top-up), suites ${Object.entries(meta.timing).map(([k, v]) => `${k} ${v} s`).join(', ') || '–'}${promptfoo ? `, promptfoo ${Object.values(promptfoo).reduce((s: number, v: any) => s + v.seconds, 0)} s` : ''}${garak ? `, garak ${garak.seconds} s` : ''}.`, '');
const slow = useRows.slice().sort((a, b) => b[1].ms - a[1].ms)[0];
json.slowest = slow ? { step: slow[0], seconds: Math.round(slow[1].ms / 1000) } : null;
if (slow) md.push(`Slowest step: **${slow[0]}** (${Math.round(slow[1].ms / 1000)} s summed over ${slow[1].calls} calls).`, '');
md.push('## Re-running / a new document set', '', '```bash', `node eval/generate.ts --corpus ${corpus}        # test sets (cached; delete eval/out/${corpus}/gen.jsonl to regenerate)`, `node eval/run.ts --corpus ${corpus}             # suites (resumable; delete results.jsonl to start over)`, `eval/.venv/bin/python eval/retrieval.py --corpus ${corpus}`, `node eval/traps/promptfoo.ts --corpus ${corpus} && node eval/traps/garak.ts --corpus ${corpus}`, `node eval/report.ts --corpus ${corpus}`, '```', '', 'A new manual needs only `eval/config/<name>.json` (passages from Octo SQL or a JSON file, retriever prefixes, generator and caller models, counts) and `eval/config/<name>.traps.json`; no FAQ is needed.');

fs.writeFileSync(path.join(root, 'eval/report.md'), md.join('\n') + '\n');
fs.writeFileSync(path.join(root, 'eval/report.json'), JSON.stringify(json, null, 1));
fs.copyFileSync(path.join(root, 'eval/report.md'), path.join(dir, `report-${cfg.label}.md`));
console.log(md.join('\n').slice(0, 3000));
