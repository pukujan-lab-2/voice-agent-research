/**
 * Fails a pull request that changes code but no documentation: no README.md anywhere and no file under the docs paths.
 * A `no-docs-needed` label, or a PR body line starting "No docs needed:" with the reason, skips it.
 *
 *   BASE=<sha> HEAD=<sha> PR_BODY=... PR_LABELS=a,b DOC_PATHS=docs/,additionals/doc/ node scripts/check-docs-updated.mjs
 *   node scripts/check-docs-updated.mjs --self-test
 */
import { execFileSync } from 'node:child_process';

const SKIP_LABEL = 'no-docs-needed';
const SKIP_LINE = 'no docs needed:';
// Files that are neither code nor docs: lockfiles and task or checkpoint notes.
const IGNORED_FILES = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'uv.lock', 'poetry.lock'];
const IGNORED_DIRS = ['tasks/', 'checkpoints/'];

const base = (path) => path.split('/').at(-1);

export function isDoc(path, docPaths) {
  return base(path).toLowerCase() === 'readme.md' || docPaths.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p));
}

export function isCode(path, docPaths) {
  if (isDoc(path, docPaths) || path.toLowerCase().endsWith('.md')) return false;
  return !IGNORED_FILES.includes(base(path)) && !IGNORED_DIRS.some((d) => path.startsWith(d));
}

export function skipped(body = '', labels = []) {
  if (labels.includes(SKIP_LABEL)) return `label ${SKIP_LABEL}`;
  const line = body.split('\n').map((l) => l.trim()).find((l) => l.toLowerCase().startsWith(SKIP_LINE));
  return line && line.length > SKIP_LINE.length ? `"${line}"` : null;
}

/** { ok, message } for a list of changed paths. */
export function decide(files, { docPaths, body, labels }) {
  const skip = skipped(body, labels);
  if (skip) return { ok: true, message: `docs check skipped: ${skip}` };
  const code = files.filter((f) => isCode(f, docPaths));
  const docs = files.filter((f) => isDoc(f, docPaths));
  if (!code.length) return { ok: true, message: 'no code changed' };
  if (docs.length) return { ok: true, message: `docs updated: ${docs.join(', ')}` };
  return {
    ok: false,
    message: `${code.length} code file(s) changed but no README.md or file under ${docPaths.join(', ')}: ${code.slice(0, 10).join(', ')}`
      + `\nUpdate the docs, or add the "${SKIP_LABEL}" label or a body line "No docs needed: <why>".`,
  };
}

function selfTest() {
  const o = { docPaths: ['docs/', 'HANDOFF.md'], body: '', labels: [] };
  const cases = [
    [['src/a.ts'], o, false],
    [['src/a.ts', 'src/README.md'], o, true],
    [['src/a.ts', 'docs/x.md'], o, true],
    [['src/a.ts', 'HANDOFF.md'], o, true],
    [['src/a.ts', 'tasks/T-1.md'], o, false],
    [['tasks/T-1.md', 'pnpm-lock.yaml'], o, true],
    [['src/a.ts'], { ...o, labels: [SKIP_LABEL] }, true],
    [['src/a.ts'], { ...o, body: 'Fix.\nNo docs needed: a typo in a log line' }, true],
    [['src/a.ts'], { ...o, body: 'No docs needed:' }, false],
  ];
  const bad = cases.filter(([files, opts, want]) => decide(files, opts).ok !== want);
  for (const [files, opts, want] of bad) console.error(`self-test: ${files} ${JSON.stringify(opts)} wanted ${want}`);
  console.log(`docs check self-test: ${cases.length - bad.length} of ${cases.length} passed`);
  process.exit(bad.length ? 1 : 0);
}

if (process.argv.includes('--self-test')) selfTest();
else {
  const env = process.env;
  const files = execFileSync('git', ['diff', '--name-only', `${env.BASE}...${env.HEAD}`], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const result = decide(files, {
    docPaths: (env.DOC_PATHS ?? 'docs/').split(',').map((p) => p.trim()).filter(Boolean),
    body: env.PR_BODY ?? '',
    labels: (env.PR_LABELS ?? '').split(',').map((l) => l.trim()).filter(Boolean),
  });
  (result.ok ? console.log : console.error)(result.message);
  process.exit(result.ok ? 0 : 1);
}
