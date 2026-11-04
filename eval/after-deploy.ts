// Record a deploy's replay result in Phoenix, as an eval span in the session `deploy-<sha>` (through the site's
// /api/score, so it needs no keys). The voice test (demo/live-site/tests/voice-call.ts) records its own span in the same
// session when DEPLOY_SHA is set.
// Run: node eval/after-deploy.ts --site <url> --sha <commit> --results <replay.json>
import fs from 'node:fs';
import type { Run } from './lib/standing.ts';

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ''; };
const site = arg('--site').replace(/\/$/, ''), sha = arg('--sha').slice(0, 12);
const run: Run = JSON.parse(fs.readFileSync(arg('--results'), 'utf8'));

const total = Object.values(run.perRule).reduce((n, v) => n + v.pass + v.fail, 0);
const passed = Object.values(run.perRule).reduce((n, v) => n + v.pass, 0);
// A deploy is judged on the cases that were fixed: any guarded case failing live is a regression that reached users.
const regressions = run.failures.filter(f => f.status === 'guarded');
const body = {
  call: `deploy-${sha}`, name: 'deploy.replay', score: total ? passed / total : 1, label: regressions.length ? 'fail' : 'pass',
  explanation: `${passed}/${total} replay cases pass on ${site}; ${regressions.length} guarded regression(s)${regressions.length ? `: ${regressions.map(f => `${f.rule} "${f.said.slice(0, 50)}"`).join('; ')}` : ''}`,
};
const r = await fetch(`${site}/api/score`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
console.log(`${body.label}: ${body.explanation}\nrecorded in Phoenix: ${r.ok ? (await r.json() as any).as : `no (${r.status})`}`);
process.exit(regressions.length ? 1 : 0);
