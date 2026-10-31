// Keys for the eval, from the environment or ~/Documents/projects/.env (this Mac) / ~/.hack_env (the Pro). Never logged.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let cache: Record<string, string> | undefined;
export function key(...names: string[]): string | undefined {
  if (!cache) {
    cache = {};
    for (const f of [path.join(os.homedir(), 'Documents/projects/.env'), path.join(os.homedir(), '.hack_env')]) {
      if (!fs.existsSync(f)) continue;
      for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
        const m = line.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*)$/);
        if (m && !(m[1] in cache)) cache[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
  for (const n of names) if (process.env[n] || cache[n]) return process.env[n] || cache[n];
  return undefined;
}
