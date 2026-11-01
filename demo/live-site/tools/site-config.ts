// Keeps a business's copilot config in Octo (the copilot_sites table), where the backend loads it on demand.
//   node --no-warnings tools/site-config.ts put <business> <file.json>   store (or replace) a business's config
//   node --no-warnings tools/site-config.ts get <business>               print it
//   node --no-warnings tools/site-config.ts remove <business>            delete it
// The Octo key is read the way server.ts reads it; nothing is printed but the config itself.
import fs from 'node:fs';
import { loadEnv } from '../server.ts';
import { SiteConfigs } from '../../../copilot-engine/src/site-config.ts';

const [cmd, business, file] = process.argv.slice(2);
const env = loadEnv();
if (!env.OCTO_KEY || !env.OCTO_WORKSPACE) throw new Error('no Octo key or workspace found');
const sites = new SiteConfigs(async (text, params = []) => {
  const r = await fetch(`${env.OCTO_BASE || 'https://octodb.design-bakery.com/api'}/workspaces/${env.OCTO_WORKSPACE}/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.OCTO_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: text, ...(params.length ? { params } : {}) }) });
  const j = await r.json() as { rows?: Record<string, unknown>[]; message?: string };
  if (!r.ok) throw new Error(`octo ${r.status}: ${j.message ?? ''}`);
  return j.rows ?? [];
});
if (cmd === 'put' && business && file) { await sites.put(business, JSON.parse(fs.readFileSync(file, 'utf8'))); console.log(`stored ${business}`); }
else if (cmd === 'get' && business) console.log(JSON.stringify(await sites.get(business), null, 2));
else if (cmd === 'remove' && business) { await sites.remove(business); console.log(`removed ${business}`); }
else { console.error('usage: site-config.ts put <business> <file.json> | get <business> | remove <business>'); process.exit(2); }
