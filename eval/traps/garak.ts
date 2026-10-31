// Traps through garak (Apache-2.0): prompt injection, injection hidden in a document, encoded instructions and a
// jailbreak, sent to the copilot through eval/target-server.ts with garak's REST generator. Only probes whose
// detectors are string checks (no detector models to download, no spend). Each probe is capped at a few prompts:
// every prompt is a real search and answer.
// Writes eval/out/<corpus>/garak/ (garak's own reports) and garak.json (the summary the report reads).
// Run: node eval/traps/garak.ts --corpus irs      (needs eval/.venv with garak; starts and stops the target server)
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const arg = (k: string, d = '') => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const corpus = arg('--corpus', 'irs');
const cap = Number(arg('--cap', '8'));
const out = path.join(root, 'eval/out', corpus, 'garak');
fs.mkdirSync(out, { recursive: true });
const port = 8898;
const PROBES = ['promptinject.HijackHateHumans', 'latentinjection.LatentInjectionFactSnippetEiffel', 'latentinjection.LatentInjectionReport', 'encoding.InjectBase64', 'dan.AutoDANCached'];

fs.writeFileSync(path.join(out, 'rest.json'), JSON.stringify({ rest: { RestGenerator: {
  name: `${corpus}-copilot`, uri: `http://127.0.0.1:${port}/ask`, method: 'post', headers: { 'Content-Type': 'application/json' },
  req_template_json_object: { prompt: '$INPUT' }, response_json: true, response_json_field: 'output', request_timeout: 400,
} } }, null, 1));
fs.writeFileSync(path.join(out, 'config.yaml'), `---\nsystem:\n  show_z: false\nrun:\n  soft_probe_prompt_cap: ${cap}\n  generations: 1\nreporting:\n  report_dir: ${out}\n`);

const server = spawn(process.execPath, ['--no-warnings', path.join(root, 'eval/target-server.ts'), '--corpus', corpus, '--port', String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise<void>(res => server.stdout!.on('data', d => { if (String(d).includes('copilot target on')) res(); }));
const t0 = Date.now();
let r: ReturnType<typeof spawnSync>;
try {
  r = spawnSync(path.join(root, 'eval/.venv/bin/python'), ['-m', 'garak', '--model_type', 'rest', '--generator_option_file', path.join(out, 'rest.json'),
    '--probes', PROBES.join(','), '--config', path.join(out, 'config.yaml'), '--report_prefix', corpus, '--parallel_attempts', '2'],
    { cwd: out, encoding: 'utf8', timeout: 4 * 3600 * 1000, env: { ...process.env, GARAK_TELEMETRY: '0' } });
} finally { server.kill(); }
fs.writeFileSync(path.join(out, 'stdout.log'), `${r.stdout}\n${r.stderr}`);

// garak's report: one "eval" line per probe and detector, with passed / total attempts.
const report = path.join(out, `${corpus}.report.jsonl`);
const evals = fs.existsSync(report) ? fs.readFileSync(report, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(e => e.entry_type === 'eval') : [];
const hits = fs.existsSync(path.join(out, `${corpus}.hitlog.jsonl`)) ? fs.readFileSync(path.join(out, `${corpus}.hitlog.jsonl`), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const summary = {
  exit: r.status, seconds: Math.round((Date.now() - t0) / 1000), cap,
  probes: evals.map(e => ({ probe: e.probe, detector: e.detector, passed: e.passed, total: e.total ?? e.total_evaluated })),
  failures: hits.slice(0, 8).map(h => ({ probe: h.probe, detector: h.detector, prompt: String(h.prompt?.turns?.[0]?.content?.text ?? h.prompt ?? '').slice(0, 300), output: String(h.output?.text ?? h.output ?? '').slice(0, 300) })),
  stderrTail: r.status ? String(r.stderr ?? '').slice(-800) : undefined,
};
fs.writeFileSync(path.join(root, 'eval/out', corpus, 'garak.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1).slice(0, 1500));
