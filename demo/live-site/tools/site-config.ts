// Keeps a business's copilot config in Octo (the copilot_sites table), where the backend loads it on demand.
//   node --no-warnings tools/site-config.ts put <business> <file.json>   store (or replace) a business's config
//   node --no-warnings tools/site-config.ts get <business>               print it
//   node --no-warnings tools/site-config.ts remove <business>            delete it
//   node --no-warnings tools/site-config.ts map-put <business> <file.json>   index pages and forms: a JSON array of { id, kind, path, title, keywords?, flow? }
//   node --no-warnings tools/site-config.ts map-remove <business> <id>       drop one entry from the map
// The Octo key is read the way server.ts reads it; nothing is printed but the config itself.
import fs from 'node:fs';
import { loadEnv } from '../server.ts';
import { SiteConfigs } from '../../../copilot-engine/src/site-config.ts';
import { SiteMap, type MapEntry } from '../../../copilot-engine/src/site-map.ts';

const [cmd, business, file] = process.argv.slice(2);
const env = loadEnv();
if (!env.OCTO_KEY || !env.OCTO_WORKSPACE) throw new Error('no Octo key or workspace found');
const sql = async (text: string, params: unknown[] = []) => {
  const r = await fetch(`${env.OCTO_BASE || 'https://octodb.design-bakery.com/api'}/workspaces/${env.OCTO_WORKSPACE}/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.OCTO_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: text, ...(params.length ? { params } : {}) }) });
  const j = await r.json() as { rows?: Record<string, unknown>[]; message?: string };
  if (!r.ok) throw new Error(`octo ${r.status}: ${j.message ?? ''}`);
  return j.rows ?? [];
};
const sites = new SiteConfigs(sql);
const map = new SiteMap(sql);
if (cmd === 'put' && business && file) { await sites.put(business, JSON.parse(fs.readFileSync(file, 'utf8'))); console.log(`stored ${business}`); }
else if (cmd === 'get' && business) console.log(JSON.stringify(await sites.get(business), null, 2));
else if (cmd === 'remove' && business) { await sites.remove(business); console.log(`removed ${business}`); }
else if (cmd === 'map-put' && business && file) {
  const entries = JSON.parse(fs.readFileSync(file, 'utf8')) as MapEntry[];
  for (const e of entries) await map.put(business, e);
  console.log(`indexed ${entries.length} entries for ${business}`);
} else if (cmd === 'map-remove' && business && file) { await map.remove(business, file); console.log(`removed ${file} from ${business}`); }
else { console.error('usage: site-config.ts put|get|remove <business> [file.json] | map-put <business> <file.json> | map-remove <business> <id>'); process.exit(2); }
