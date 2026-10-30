// Builds dist/: the static site plus the widget and the engine as browser modules. No bundler: Node's own TypeScript
// type stripping turns each .ts file into .js, and imports are pointed at the .js copies.
// Run: node build.ts   (API_BASE=https://… sets where the widget calls the backend; default is the same origin)
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
console.log(`built ${path.relative(process.cwd(), dist) || 'dist'} (API_BASE=${process.env.API_BASE || 'same origin'})`);
