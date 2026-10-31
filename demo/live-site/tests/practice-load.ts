// Load test for the Brindlewick site, staff app and portal against the live Octo database: N concurrent visitors
// each walk a mix of page loads and the API reads those pages make. Reports p50 / p95 / max per route and overall,
// and fails if any request errors or the API p95 is over the budget.
// Run: node tests/practice-load.ts [visitors=20] [rounds=10]
import { start } from '../server.ts';

const [visitors = 20, rounds = 10] = process.argv.slice(2).map(Number);
const BUDGET_API_P95 = 1500, BUDGET_PAGE_P95 = 300;
const srv = await start({ port: 0 });
const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const at: Record<string, number[]> = {};
let errors = 0;
const errs: string[] = [];
async function hit(name: string, path: string, ip: string, token?: string) {
  const t = performance.now();
  const r = await fetch(srv.url + path, { headers: { 'cf-connecting-ip': ip, ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  await r.arrayBuffer();
  (at[name] ??= []).push(performance.now() - t);
  if (r.status !== 200) { errors++; if (errs.length < 10) errs.push(`${r.status} ${path}`); }
}
const post = async (path: string, body: unknown, ip: string) =>
  (await fetch(srv.url + path, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify(body) })).json() as Promise<any>;

const svc = (await (await fetch(`${srv.url}/api/site/services`)).json() as any).services.map((s: any) => s.slug);
const art = (await (await fetch(`${srv.url}/api/site/articles`)).json() as any).articles.map((a: any) => a.slug);
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const names = ['garcia', 'nguyen', 'patel', 'smith', 'okafor', 'kim', 'rossi', 'cohen'];

async function visitor(v: number) {
  const ip = `10.20.${v}.${Math.floor(Math.random() * 250)}`;
  const staff = (await post('/api/staff/session', { staff: 'st-pra' }, ip)).token;
  const portal = (await post('/api/portal/session', { demo: true }, ip)).token;
  for (let r = 0; r < rounds; r++) {
    // a public visitor
    await hit('page /tax', '/tax', ip);
    await Promise.all([hit('api site/services', '/api/site/services', ip), hit('api site/deadlines', `/api/site/deadlines?from=${day(0)}&to=${day(120)}`, ip), hit('api site/locations', '/api/site/locations', ip)]);
    await hit('page /tax/services/:slug', `/tax/services/${pick(svc)}`, ip);
    await hit('api site/service', `/api/site/service?slug=${pick(svc)}`, ip);
    await hit('api site/article', `/api/site/article?slug=${pick(art)}`, ip);
    await hit('api site/team', '/api/site/team', ip);
    await hit('api site/search', `/api/site/search?q=${pick(['payroll', 'notice', 'estimated', 'mileage', 'crypto'])}`, ip);
    await hit('page /tax/schedule', '/tax/schedule', ip);
    await hit('api slots/days', `/api/slots/days?office=${pick(['harrow', 'corbel', 'millbrook'])}`, ip);
    await hit('api slots', `/api/slots?date=${day(3 + (r % 7))}&office=harrow`, ip);
    // a staff member
    await hit('page /staff', '/staff', ip);
    await hit('api staff/dashboard', '/api/staff/dashboard', ip, staff);
    await hit('api staff/clients', `/api/staff/clients?q=${pick(names)}`, ip, staff);
    await hit('api staff/find', `/api/staff/find?q=the%20${pick(names)}%20household`, ip, staff);
    await hit('api staff/engagements', '/api/staff/engagements?stage=docs_in', ip, staff);
    await hit('api staff/notices', '/api/staff/notices?due_within=7', ip, staff);
    await hit('api staff/pipeline', '/api/staff/pipeline', ip, staff);
    // a client in the portal
    await hit('page /tax/portal', '/tax/portal', ip);
    await hit('api portal/summary', '/api/portal/summary', ip, portal);
    await hit('api portal/documents', '/api/portal/documents', ip, portal);
  }
}
const t0 = performance.now();
await Promise.all(Array.from({ length: visitors }, (_, v) => visitor(v)));
const secs = (performance.now() - t0) / 1000;
await srv.close();

const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const all = (pre: string) => Object.entries(at).filter(([k]) => k.startsWith(pre)).flatMap(([, v]) => v);
console.log('route'.padEnd(30), 'n'.padStart(5), 'p50'.padStart(7), 'p95'.padStart(7), 'max'.padStart(7));
for (const [k, v] of Object.entries(at)) console.log(k.padEnd(30), String(v.length).padStart(5), ...[0.5, 0.95, 1].map(p => `${Math.round(q(v, p))}ms`.padStart(7)));
const api = all('api'), page = all('page');
const n = api.length + page.length;
console.log(`\n${visitors} visitors × ${rounds} rounds: ${n} requests in ${secs.toFixed(1)} s (${Math.round(n / secs)}/s), ${errors} errors${errs.length ? ` (${errs.join(', ')})` : ''}`);
console.log(`pages p95 ${Math.round(q(page, 0.95))}ms · API p95 ${Math.round(q(api, 0.95))}ms · API p50 ${Math.round(q(api, 0.5))}ms`);
const ok = !errors && q(api, 0.95) <= BUDGET_API_P95 && q(page, 0.95) <= BUDGET_PAGE_P95;
console.log(ok ? 'load: PASS' : `load: FAIL (budgets: API p95 ≤ ${BUDGET_API_P95}ms, pages p95 ≤ ${BUDGET_PAGE_P95}ms, no errors)`);
process.exit(ok ? 0 : 1);
