// Keeps a business's copilot config in Octo (the copilot_sites table), where the backend loads it on demand.
//   node --no-warnings tools/site-config.ts put <business> <file.json>   store (or replace) a business's config
//   node --no-warnings tools/site-config.ts get <business>               print it
//   node --no-warnings tools/site-config.ts remove <business>            delete it
// An outside business gets its own Octo workspace: put a config with "workspace": {} and the registry creates it (the
// account-wide key, octo_account_token, is needed) and stores its id (decision 0021, #127). Demo businesses leave it out.
// The Octo keys are read the way server.ts reads them; nothing is printed but the config itself.
import fs from 'node:fs';
import { loadEnv } from '../server.ts';
import { SiteConfigs } from '../../../copilot-engine/src/site-config.ts';
import { createWorkspace, octoSql } from '../../../copilot-engine/src/octo-workspaces.ts';

const [cmd, business, file] = process.argv.slice(2);
const env = loadEnv();
if (!env.OCTO_KEY || !env.OCTO_WORKSPACE) throw new Error('no Octo key or workspace found');
const account = env.OCTO_ACCOUNT_KEY ? { base: env.OCTO_BASE, key: env.OCTO_ACCOUNT_KEY } : null;
const sites = new SiteConfigs(octoSql({ base: env.OCTO_BASE, key: env.OCTO_KEY }, env.OCTO_WORKSPACE), {
  workspaces: account ? { sqlFor: ws => octoSql(account, ws), create: business => createWorkspace(account, business) } : undefined });
if (cmd === 'put' && business && file) { await sites.put(business, JSON.parse(fs.readFileSync(file, 'utf8'))); console.log(`stored ${business}`); }
else if (cmd === 'get' && business) console.log(JSON.stringify(await sites.get(business), null, 2));
else if (cmd === 'remove' && business) { await sites.remove(business); console.log(`removed ${business}`); }
else { console.error('usage: site-config.ts put <business> <file.json> | get <business> | remove <business>'); process.exit(2); }
