// Erases one call, one caller or a whole business for good (#132), by destroying its key in OpenBao (every copy stops
// opening, Octo's backups included) and then removing its rows and files from Octo.
//   node --no-warnings tools/erase.ts call <business> <call id>
//   node --no-warnings tools/erase.ts caller <business> <caller hash>   the hash from memory.ts customerKey, not a phone
//   node --no-warnings tools/erase.ts business <business>              asks for the business id to be typed again
// Run it where the site runs (the copilot-web container): it needs the OpenBao AppRole and the Octo keys server.ts reads.
// A destroyed key can't be brought back. Who may erase from the business's own page waits on grants (#131).
import readline from 'node:readline/promises';
import { loadEnv } from '../server.ts';
import { createApi } from '../api.ts';

const [cmd, business, id] = process.argv.slice(2);
const env = loadEnv();
if (!env.OPENBAO_ADDR || !env.OPENBAO_ROLE_ID || !env.OPENBAO_SECRET_ID) throw new Error('erasing needs the OpenBao AppRole (OPENBAO_*)');
const api = createApi(env);
if (cmd === 'call' && business && id) console.log(JSON.stringify(await api.eraseCall(business, id)));
else if (cmd === 'caller' && business && id) console.log(JSON.stringify(await api.eraseCaller(business, id)));
else if (cmd === 'business' && business && !id) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const typed = (await rl.question(`This erases every call of ${business} for good. Type ${business} to go on: `)).trim();
  rl.close();
  console.log(JSON.stringify(await api.eraseBusiness(business, typed)));
} else { console.error('usage: erase.ts call <business> <call id> | caller <business> <caller hash> | business <business>'); process.exit(2); }
