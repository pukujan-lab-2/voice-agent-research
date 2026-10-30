// Builds dist/: the static site plus the widget and the engine as browser modules. No bundler: Node's own TypeScript
// type stripping turns each .ts file into .js, and imports are pointed at the .js copies.
// Also builds dist/_marketing/, the marketing page, served on its own hostname (MARKETING_HOST) by server.ts.
// Run: node build.ts   (API_BASE=https://… sets where the widget calls the backend; default is the same origin.
//   DEMO_ORIGIN=https://… is where the marketing page's "View demo" buttons go; VIDEO_DIR holds the concept videos.)
import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const here = path.dirname(new URL(import.meta.url).pathname);
const dist = path.join(here, 'dist');
const engine = path.join(here, '../../copilot-engine/src');

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(here, 'site'), dist, { recursive: true });

const toJs = (src: string) => stripTypeScriptTypes(src, { mode: 'strip' })
  .replace(/(from\s+['"])(?:\.\.\/)+copilot-engine\/src\/(\w+)\.ts(['"])/g, '$1./engine/$2.js$3')
  .replace(/(from\s+['"]\.{1,2}\/[\w/-]+)\.ts(['"])/g, '$1.js$2');

fs.mkdirSync(path.join(dist, 'copilot/engine'), { recursive: true });
for (const f of ['engine', 'guard', 'guide', 'page', 'types']) {
  fs.writeFileSync(path.join(dist, 'copilot/engine', `${f}.js`), toJs(fs.readFileSync(path.join(engine, `${f}.ts`), 'utf8')));
}
for (const f of fs.readdirSync(path.join(here, 'widget')).filter(f => f.endsWith('.ts'))) {
  let js = toJs(fs.readFileSync(path.join(here, 'widget', f), 'utf8'));
  if (f === 'config.ts') js = `export const API_BASE = ${JSON.stringify((process.env.API_BASE ?? '').replace(/\/$/, ''))};\n`;
  fs.writeFileSync(path.join(dist, 'copilot', f.replace(/\.ts$/, '.js')), js);
}
// Marketing page: videos are not in git (demo/out/ is build output), so they are copied from VIDEO_DIR when present.
const mk = path.join(dist, '_marketing');
fs.cpSync(path.join(here, 'marketing'), mk, { recursive: true });
const mkHtml = path.join(mk, 'index.html');
fs.writeFileSync(mkHtml, fs.readFileSync(mkHtml, 'utf8').replaceAll('{{DEMO}}', (process.env.DEMO_ORIGIN ?? '').replace(/\/$/, '')));
const videos = process.env.VIDEO_DIR ?? path.join(here, '../out');
for (const v of ['copilot-demo-720p.mp4', 'copilot-demo-vertical-720p.mp4']) {
  if (fs.existsSync(path.join(videos, v))) fs.copyFileSync(path.join(videos, v), path.join(mk, 'media', v));
  else console.warn(`no ${v} in ${videos}: the marketing page will have a poster but no video`);
}
console.log(`built ${path.relative(process.cwd(), dist) || 'dist'} (API_BASE=${process.env.API_BASE || 'same origin'})`);
