// Builds dist/: the React app ABA built (app/, built with its own Vite setup), plus what the host owns on the same origin:
//   /copilot/  the engine and the headless SDK (window.copilot) as browser modules, replacing the app's stand-in sdk.js
//   /docs/     the two synthetic manuals as HTML pages (tools/docs.py)
//   /media/    the concept videos and their posters
// No bundler for the copilot: Node's own TypeScript type stripping turns each .ts file into .js, and imports are pointed
// at the .js copies.
// Run: node build.ts   (API_BASE=https://… sets where the SDK calls the backend; default is the same origin.
//   VIDEO_DIR holds the concept videos, which are not in git. SKIP_APP=1 reuses app/dist as it is.)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';

const here = path.dirname(new URL(import.meta.url).pathname);
const app = path.join(here, 'app');
const dist = path.join(here, 'dist');
const engine = path.join(here, '../../copilot-engine/src');

if (process.env.SKIP_APP !== '1') {
  // ABA scaffolds the app with pnpm; its build also runs the copilot contract check.
  const pnpm = (...args: string[]) => execFileSync('pnpm', args, { cwd: app, stdio: 'inherit' });
  if (!fs.existsSync(path.join(app, 'node_modules'))) pnpm('install', '--frozen-lockfile');
  pnpm('run', 'build');
}
fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(app, 'dist'), dist, { recursive: true });
fs.cpSync(path.join(here, 'static'), dist, { recursive: true });

const toJs = (src: string) => stripTypeScriptTypes(src, { mode: 'strip' })
  .replace(/(from\s+['"])(?:\.\.\/)+copilot-engine\/src\/(\w+)\.ts(['"])/g, '$1./engine/$2.js$3')
  .replace(/(from\s+['"]\.{1,2}\/[\w/-]+)\.ts(['"])/g, '$1.js$2');

fs.rmSync(path.join(dist, 'copilot'), { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'copilot/engine'), { recursive: true });
for (const f of ['engine', 'guard', 'guide', 'page', 'types', 'verify']) {
  fs.writeFileSync(path.join(dist, 'copilot/engine', `${f}.js`), toJs(fs.readFileSync(path.join(engine, `${f}.ts`), 'utf8')));
}
for (const f of fs.readdirSync(path.join(here, 'widget')).filter(f => f.endsWith('.ts'))) {
  let js = toJs(fs.readFileSync(path.join(here, 'widget', f), 'utf8'));
  if (f === 'config.ts') js = `export const API_BASE = ${JSON.stringify((process.env.API_BASE ?? '').replace(/\/$/, ''))};\n`;
  fs.writeFileSync(path.join(dist, 'copilot', f.replace(/\.ts$/, '.js')), js);
}
// Videos are not in git (demo/out/ is build output), so they are copied from VIDEO_DIR when present.
const videos = process.env.VIDEO_DIR ?? path.join(here, '../out');
for (const v of ['copilot-demo-720p.mp4', 'copilot-demo-vertical-720p.mp4']) {
  if (fs.existsSync(path.join(videos, v))) fs.copyFileSync(path.join(videos, v), path.join(dist, 'media', v));
  else console.warn(`no ${v} in ${videos}: the landing page will show a poster but no video`);
}
console.log(`built ${path.relative(process.cwd(), dist) || 'dist'} (API_BASE=${process.env.API_BASE || 'same origin'})`);
