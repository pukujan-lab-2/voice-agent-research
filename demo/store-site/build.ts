// Builds dist/: the store app ABA built (app/, with its own Vite setup), plus the copilot at /copilot/ (the engine,
// the shopping copilot and the headless SDK, window.copilot, as browser modules). No bundler for the copilot: Node's
// own TypeScript type stripping turns each .ts file into .js, and imports are pointed at the .js copies.
// Run: node build.ts   (API_BASE=https://… sets where the SDK calls the backend; default is the same origin.
//   SKIP_APP=1 reuses app/dist as it is.)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';

const here = path.dirname(new URL(import.meta.url).pathname);
const app = path.join(here, 'app');
const dist = path.join(here, 'dist');
const engine = path.join(here, '../../copilot-engine/src');

if (process.env.SKIP_APP !== '1') {
  const pnpm = (...args: string[]) => execFileSync('pnpm', args, { cwd: app, stdio: 'inherit' });
  if (!fs.existsSync(path.join(app, 'node_modules'))) pnpm('install', '--frozen-lockfile');
  pnpm('run', 'build');
}
fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(app, 'dist'), dist, { recursive: true });

const toJs = (src: string) => stripTypeScriptTypes(src, { mode: 'strip' })
  .replace(/(from\s+['"])(?:\.\.\/)+copilot-engine\/src\/([\w-]+)\.ts(['"])/g, '$1./engine/$2.js$3')
  .replace(/(from\s+['"]\.{1,2}\/[\w/-]+)\.ts(['"])/g, '$1.js$2');

fs.rmSync(path.join(dist, 'copilot'), { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'copilot/engine'), { recursive: true });
for (const f of ['engine', 'guard', 'guide', 'page', 'types', 'shop', 'shop-text']) {
  fs.writeFileSync(path.join(dist, 'copilot/engine', `${f}.js`), toJs(fs.readFileSync(path.join(engine, `${f}.ts`), 'utf8')));
}
for (const f of fs.readdirSync(path.join(here, 'widget')).filter(f => f.endsWith('.ts'))) {
  let js = toJs(fs.readFileSync(path.join(here, 'widget', f), 'utf8'));
  if (f === 'config.ts') js = `export const API_BASE = ${JSON.stringify((process.env.API_BASE ?? '').replace(/\/$/, ''))};\n`;
  fs.writeFileSync(path.join(dist, 'copilot', f.replace(/\.ts$/, '.js')), js);
}
console.log(`built ${path.relative(process.cwd(), dist) || 'dist'} (API_BASE=${process.env.API_BASE || 'same origin'})`);
