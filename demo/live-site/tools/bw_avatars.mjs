// Staff portraits for Brindlewick (fictional people): illustrated with DiceBear's "Notionists" style by Zoish
// (CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/), stored as SVG files in Octo, and served by the
// practice API at /api/site/avatar?id=<staff id>. Usage (needs @dicebear/core and @dicebear/collection 9.2.2):
//   NODE_PATH=<a folder with those installed>/node_modules node demo/live-site/tools/bw_avatars.mjs
import { createRequire } from 'node:module';
import { loadEnv } from '../server.ts';
const require = createRequire(process.env.NODE_PATH + '/');
const { createAvatar } = require('@dicebear/core');
const { notionists } = require('@dicebear/collection');

const env = loadEnv();
const base = 'https://octodb.design-bakery.com/api';
const octo = async (path, body) => {
  const r = await fetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${env.OCTO_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`octo ${path} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
};
const sql = async (text, params = []) => (await octo(`/workspaces/${env.OCTO_WORKSPACE}/query`, { sql: text, params })).rows;
const BG = ['efe6d6', 'e6ddd0', 'dfe8e1', 'eadfd6', 'e3e6dc', 'f0e2d8']; // the brand's warm ivory and sage tints
// chosen by hand from the style's variants so each portrait suits the person and office wear: [hair, body, glasses, beard]
const CALM = ['variant22', 'variant23', 'variant03', 'variant25']; // closed, calm smiles
const LOOK = {
  'st-mva': ['variant28', 'variant16', true, false], 'st-dwh': ['variant05', 'variant20', false, false], 'st-pra': ['variant41', 'variant13', false, false],
  'st-tbi': ['variant27', 'variant19', false, true], 'st-lok': ['variant48', 'variant16', false, false], 'st-rfe': ['variant18', 'variant14', false, true],
  'st-hna': ['variant36', 'variant21', false, false], 'st-gor': ['variant60', 'variant13', false, false], 'st-ebr': ['variant39', 'variant14', true, false],
  'st-kmo': ['variant40', 'variant25', false, false], 'st-sdu': ['variant47', 'variant05', false, false], 'st-ivo': ['variant02', 'variant21', false, false],
  'st-afw': ['variant57', 'variant13', false, false], 'st-bqu': ['variant16', 'variant07', true, false],
};

await sql('alter table bw_staff add column if not exists avatar_file text');
for (const [i, s] of (await sql('select id, name from bw_staff order by sort')).entries()) {
  const [hair, body, glasses, beard] = LOOK[s.id] ?? [];
  const svg = createAvatar(notionists, { seed: s.name, backgroundColor: [BG[i % BG.length]], radius: 0, scale: 105, ...(hair ? { hair: [hair], body: [body] } : {}),
    glasses: ['variant11', 'variant08', 'variant03'], glassesProbability: glasses ? 100 : 0, beard: ['variant01'], beardProbability: beard ? 100 : 0,
    eyes: ['variant01'], brows: ['variant01'], lips: [CALM[i % CALM.length]], gestureProbability: 0, bodyIconProbability: 0 }).toString();
  const { id } = await octo('/files/upload', { workspaceId: env.OCTO_WORKSPACE, name: `bw-staff-${s.id}.svg`, mimeType: 'image/svg+xml',
    data: Buffer.from(svg).toString('base64'), dataEncoding: 'base64', metadata: { kind: 'staff-portrait', staff: s.id, license: 'CC0 1.0 (DiceBear Notionists by Zoish)' } });
  await sql('update bw_staff set avatar_file = $2, avatar = $3 where id = $1', [s.id, id, `/api/site/avatar?id=${s.id}`]);
  console.log(s.id, 'ok');
}
