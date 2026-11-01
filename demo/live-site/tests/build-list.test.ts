// The browser bundle (build.ts) copies a fixed list of engine files. A file the widget imports that is not in the list
// is a 404 on the live site and the copilot never loads (issue #68). This reads the list and follows every import.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const here = new URL('.', import.meta.url).pathname;
const build = fs.readFileSync(`${here}../build.ts`, 'utf8');
const listed = new Set([...build.match(/for \(const f of \[([^\]]+)\]\) \{\n  fs\.writeFileSync\(path\.join\(dist, 'copilot\/engine'/)![1].matchAll(/'([\w-]+)'/g)].map(m => m[1]));

test('every engine file the widget needs, directly or through another engine file, is in the browser bundle', () => {
  const need = new Set<string>();
  const visit = (name: string) => {
    if (need.has(name)) return;
    need.add(name);
    const src = fs.readFileSync(`${here}../../../copilot-engine/src/${name}.ts`, 'utf8');
    for (const m of src.matchAll(/from '\.\/([\w-]+)\.ts'/g)) visit(m[1]);
  };
  for (const f of fs.readdirSync(`${here}../widget`).filter(f => f.endsWith('.ts'))) {
    for (const m of fs.readFileSync(`${here}../widget/${f}`, 'utf8').matchAll(/copilot-engine\/src\/([\w-]+)\.ts/g)) visit(m[1]);
  }
  const missing = [...need].filter(n => !listed.has(n));
  assert.deepEqual(missing, [], `build.ts does not copy: ${missing.join(', ')}`);
});
