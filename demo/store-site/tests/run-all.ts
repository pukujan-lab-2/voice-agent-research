// Every Brambleway test, in order, against the full catalogue in Octo. The shopping eval and API tests need the server
// on BW_BACKEND (default 127.0.0.1:8790); the call test starts its own server on 8793 and needs `node build.ts` first.
// Run: node --no-warnings tests/run-all.ts
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const suites = ['shop-eval.ts', 'api.ts', 'store-call.ts'];
const failed: string[] = [];
for (const s of suites) {
  console.log(`\n######## ${s}`);
  const r = spawnSync(process.execPath, ['--no-warnings', path.join(here, s)], { stdio: 'inherit' });
  if (r.status !== 0) failed.push(s);
}
console.log(failed.length ? `\nFAILED: ${failed.join(', ')}` : `\nall ${suites.length} suites passed`);
process.exit(failed.length ? 1 : 0);
