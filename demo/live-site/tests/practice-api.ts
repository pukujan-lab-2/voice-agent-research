// Every Brindlewick practice route against the live Octo database, through the real HTTP server: site content,
// slots, drafts, all eleven public forms (valid, invalid, double-booked), uploads, newsletter, portal and staff sign-in,
// every portal and staff read, every staff write, the audit trail, bad tokens and the rate limits.
// Test records are clearly named ("Api Test ...") so they can be told apart from the generated clients.
// Run: node tests/practice-api.ts
import { start } from '../server.ts';

const srv = await start({ port: 0 });
let pass = 0, fail = 0;
const failures: string[] = [];
const check = (ok: unknown, what: string, detail = '') => {
  if (ok) pass++; else { fail++; failures.push(what); }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${!ok && detail ? `\n      ${detail}` : ''}`);
};
// Each test group posts from its own address (the server trusts cf-connecting-ip from localhost), so the submit
// limit of 12 per 10 minutes is tested on purpose, not hit by accident.
let ip = `10.9.${Math.floor(Math.random() * 200)}.1`;
const times: Record<string, number> = {};
async function call(method: string, path: string, body?: unknown, token?: string, raw?: Buffer) {
  const t = Date.now();
  const r = await fetch(srv.url + path, { method, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    headers: { 'cf-connecting-ip': ip, ...(raw ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  times[`${method} ${path.split('?')[0]}`] = Date.now() - t;
  const type = r.headers.get('content-type') ?? '';
  return { status: r.status, type, j: type.includes('json') ? await r.json() as any : null, text: type.includes('json') ? '' : await r.text() };
}
const get = (p: string, tok?: string) => call('GET', p, undefined, tok);
const post = (p: string, b: unknown, tok?: string) => call('POST', p, b, tok);
const ok200 = async (p: string, keys: string[], tok?: string) => {
  const r = await get(p, tok);
  check(r.status === 200 && keys.every(k => r.j?.[k] !== undefined), `GET ${p} → 200 with ${keys.join(', ')}`, `${r.status} ${JSON.stringify(r.j).slice(0, 200)}`);
  return r.j;
};
const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// ---- site content
console.log('\n== site content');
const services = await ok200('/api/site/services', ['services']);
check((services?.services?.length ?? 0) >= 10, '10 or more services', String(services?.services?.length));
const s0 = services?.services?.[0]?.slug;
if (s0) { const s = await ok200(`/api/site/service?slug=${s0}`, ['service']); check(s?.service?.body?.length && s?.service?.faqs?.length, `service ${s0} has body sections and FAQs`); }
check((await get('/api/site/service?slug=no-such-thing')).status === 404, 'unknown service → 404');
const inds = await ok200('/api/site/industries', ['industries']);
check((inds?.industries?.length ?? 0) >= 6, '6 or more industries', String(inds?.industries?.length));
if (inds?.industries?.[0]) await ok200(`/api/site/industry?slug=${inds.industries[0].slug}`, ['industry']);
const team = await ok200('/api/site/team', ['team']);
check(team?.team?.length >= 12 && team.team.every((m: any) => m.avatar?.startsWith('/api/site/avatar')), 'a team of 12+ with portraits', String(team?.team?.length));
const av = await get(`/api/site/avatar?id=${team?.team?.[0]?.id}`);
check(av.status === 200 && av.type.includes('svg') && av.text.includes('<svg'), 'a portrait is served as SVG', `${av.status} ${av.type}`);
const locs = await ok200('/api/site/locations', ['locations']);
check(locs?.locations?.length === 3, 'three offices');
const rev = await ok200('/api/site/reviews?page=2&size=12', ['rows', 'total', 'pages']);
check(rev?.rows?.length === 12 && rev.page === 2, 'reviews paged 12 at a time');
const arts = await ok200('/api/site/articles', ['articles']);
check((arts?.articles?.length ?? 0) >= 8, '8 or more articles', String(arts?.articles?.length));
if (arts?.articles?.[0]) {
  const a = await ok200(`/api/site/article?slug=${arts.articles[0].slug}`, ['article']);
  check(a?.article?.cites?.length > 0 && a.article.cites.every((c: any) => c.doc && c.quote), 'an article cites the library with quotes');
}
const jobs = await ok200('/api/site/jobs', ['jobs']);
check((jobs?.jobs?.length ?? 0) >= 3, '3 or more job openings', String(jobs?.jobs?.length));
const dl = await ok200(`/api/site/deadlines?from=${day(0)}&to=${day(365)}`, ['deadlines']);
check((dl?.deadlines?.length ?? 0) >= 10 && dl.deadlines.every((x: any) => x.date >= day(0)), 'a year of upcoming deadlines', String(dl?.deadlines?.length));
const cl = await ok200('/api/site/checklist', ['situations', 'items']);
const sits = (cl?.situations ?? []).slice(0, 2).map((x: any) => x.id).join(',');
if (sits) { const c2 = await ok200(`/api/site/checklist?situations=${sits}`, ['items']); check(c2?.items?.length > 0 && c2.items.every((i: any) => sits.split(',').includes(i.situation) || i.situation === 'everyone'), 'the checklist filters by situation'); }
const rates = await ok200('/api/site/rates', ['rates']);
check((rates?.rates?.length ?? 0) >= 3, 'calculator rates are in the database', String(rates?.rates?.length));
await ok200('/api/site/pages', ['pages']);
const sr = await ok200('/api/site/search?q=payroll', ['pages', 'articles', 'guides', 'team']);
check(sr?.pages && sr.pages.length + sr.articles.length + sr.guides.length > 0, 'search finds payroll content');

// ---- slots
console.log('\n== slots');
const days = await ok200('/api/slots/days?office=harrow', ['days']);
check(days?.days?.length === 15 && days.days.every((d: any) => !/Sat|Sun/.test(new Date(d.date + 'T12:00').toDateString())), '15 weekdays of availability');
const openDay = days?.days?.find((d: any) => d.open > 2)?.date ?? day(3);
const slots = await ok200(`/api/slots?date=${openDay}&office=harrow`, ['slots']);
check(slots?.slots?.length > 0 && slots.slots.every((s: any) => s.time >= '09:00' && s.time <= '16:30' && !s.time.startsWith('12:')), 'open times are 9:00–4:30 with no lunch slot');

// ---- drafts and the eleven public forms
console.log('\n== forms');
await ok200('/api/forms', ['forms']);
const d1 = await post('/api/forms/draft', { form: 'intake', data: { first_name: 'Api', last_name: 'Test' } });
check(d1.status === 200 && /^[a-f0-9-]{36}$/.test(d1.j?.id), 'a draft is saved', JSON.stringify(d1.j));
const d2 = await post('/api/forms/draft', { form: 'intake', id: d1.j?.id, data: { first_name: 'Api', last_name: 'Test', city: 'Corbel' } });
check(d2.j?.id === d1.j?.id, 'saving again updates the same draft');
check((await post('/api/forms/draft', { form: 'nope', data: {} })).status === 404, 'a draft for an unknown form → 404');
const who = { name: 'Api Test Person', email: 'api.test@example.com', phone: '(555) 010-0199' };
const valid: Record<string, any> = {
  consultation: { fullname: who.name, tel: who.phone, mail: who.email, status: 'single', years: '2025', service: 'individual', notice: 'no', day: day(9), slot: 'morning', notes: 'automated API test' },
  intake: { first_name: 'Api', last_name: 'Test', email: who.email, phone: who.phone, street: '12 Test Lane', city: 'Corbel', state: 'OR', zip: '97401', filing_status: 'mfj', dependents: '2', income: ['w2', 'investments'], services: 'individual', years: '2024 and 2025', prior_preparer: 'software', office: 'remote', heard: '', notes: 'automated API test' },
  notice: { ...who, code: 'CP2000', tax_year: '2024', notice_date: day(-12), amount: '1,284.00', agree: 'unsure', description: 'They say I left out a 1099-B. Automated API test.', files: [] },
  payroll: { business_name: 'Api Test Bakery LLC', ein: '00-1234567', entity: 'llc', employees: '6', frequency: 'biweekly', first_pay_date: day(20), state: 'OR', contact_name: who.name, email: who.email, phone: who.phone },
  address: { ...who, old_street: '1 Old Road', street: '2 New Road', city: 'Millbrook', state: 'OR', zip: '97330', effective: day(-30), irs: 'yes' },
  'payment-plan': { ...who, years: '2023 and 2024', owed: '8,400', monthly: '350', plan: 'long', notice: 'yes', debit: 'yes' },
  transcript: { ...who, tax_year: '2023', what: 'both', delivery: 'portal', purpose: 'mortgage' },
  referral: { your_name: who.name, your_email: who.email, friend_name: 'Api Test Friend', friend_email: '', friend_phone: '(555) 010-0142', relationship: 'friend', service: 'business' },
  application: { job: jobs?.jobs?.[0]?.slug ?? 'staff-accountant', ...who, credentials: 'ea', years: '4', start: day(40), resume: [], cover: 'I like careful work and plain explanations. Automated API test.' },
  contact: { ...who, topic: 'question', message: 'Automated API test message.' },
};
for (const [form, data] of Object.entries(valid)) {
  const r = await post('/api/forms/submit', { form, data, draft: form === 'intake' ? d1.j?.id : undefined });
  check(r.status === 200 && /^[A-Z]{2,4}-[A-Z0-9]{6}$/.test(r.j?.ref ?? '') && r.j?.message, `${form}: a valid submission gets a reference`, `${r.status} ${JSON.stringify(r.j).slice(0, 240)}`);
}
ip = `10.8.${Math.floor(Math.random() * 200)}.2`;
const bad: Record<string, [any, string[]]> = {
  intake: [{ ...valid.intake, email: 'nope', zip: '9740', state: 'XX', years: 'last year' }, ['email', 'zip', 'state', 'years']],
  notice: [{ ...valid.notice, code: '2000', notice_date: day(5) }, ['code', 'notice_date']],
  payroll: [{ ...valid.payroll, ein: '12-34', first_pay_date: day(-3), employees: '0' }, ['ein', 'first_pay_date', 'employees']],
  'payment-plan': [{ ...valid['payment-plan'], monthly: '5', plan: 'forever' }, ['monthly', 'plan']],
  referral: [{ ...valid.referral, friend_email: 'friend@', relationship: '' }, ['friend_email', 'relationship']],
  application: [{ ...valid.application, cover: 'short' }, ['cover']],
};
for (const [form, [data, fields]] of Object.entries(bad)) {
  const r = await post('/api/forms/submit', { form, data });
  check(r.status === 422 && fields.every(f => typeof r.j?.errors?.[f] === 'string'), `${form}: bad fields → 422 naming ${fields.join(', ')}`, `${r.status} ${JSON.stringify(r.j?.errors ?? r.j).slice(0, 240)}`);
}
check((await post('/api/forms/submit', { form: 'nope', data: {} })).status === 404, 'an unknown form → 404');

// booking: an open time books once; the same time again is refused
ip = `10.7.${Math.floor(Math.random() * 200)}.3`;
const late = (await get(`/api/slots/days?office=millbrook`)).j?.days?.filter((d: any) => d.open > 0).at(-1)?.date;
const free = late ? (await get(`/api/slots?date=${late}&office=millbrook`)).j?.slots?.at(-1) : null;
if (free) {
  const bk = { kind: 'consultation', mode: 'office', office: 'millbrook', date: late, time: free.time, staff: free.staff[0].id, ...who, notes: 'automated API test' };
  const b1 = await post('/api/forms/submit', { form: 'booking', data: bk });
  check(b1.status === 200 && b1.j?.ref && b1.j?.staff, 'booking: an open time is booked', `${b1.status} ${JSON.stringify(b1.j).slice(0, 200)}`);
  const after = (await get(`/api/slots?date=${late}&office=millbrook&staff=${free.staff[0].id}`)).j?.slots ?? [];
  check(!after.some((s: any) => s.time === free.time), 'booking: the booked time is no longer offered for that preparer');
  const b2 = await post('/api/forms/submit', { form: 'booking', data: bk });
  check(b2.status === 409, 'booking: the same time again → 409', `${b2.status} ${JSON.stringify(b2.j).slice(0, 160)}`);
} else check(false, 'booking: found an open time to book');
const bpast = await post('/api/forms/submit', { form: 'booking', data: { kind: 'consultation', mode: 'office', office: 'harrow', date: day(-2), time: '10:00', ...who } });
check(bpast.status === 422 && bpast.j?.errors?.date, 'booking: a past date → 422');

// newsletter
const n1 = await post('/api/newsletter', { email: 'api.test@example.com', topics: ['deadlines', 'payroll', 'bogus'] });
check(n1.status === 200 && n1.j?.ok, 'newsletter sign-up', JSON.stringify(n1.j));
check((await post('/api/newsletter', { email: 'not-an-email' })).status === 422, 'newsletter: a bad email → 422');

// uploads
ip = `10.4.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
console.log('\n== uploads');
const pdf = Buffer.from('%PDF-1.4\n% Api test upload\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const up = await call('POST', '/api/files?name=api-test-notice.pdf&form=notice', undefined, undefined, pdf);
check(up.status === 200 && /^UP-/.test(up.j?.id ?? ''), 'a PDF uploads into Octo files', `${up.status} ${JSON.stringify(up.j)}`);
check((await call('POST', '/api/files?name=run.exe', undefined, undefined, Buffer.from('MZ'))).status === 422, 'an .exe is refused');
check((await call('POST', '/api/files?name=empty.pdf', undefined, undefined, Buffer.alloc(0))).status === 422, 'an empty file is refused');
check((await call('POST', '/api/files?name=big.pdf', undefined, undefined, Buffer.alloc(8 * 1024 * 1024 + 10, 1))).status === 413, 'a file over 8 MB is refused');

// ---- portal
ip = `10.4.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
console.log('\n== portal');
check((await post('/api/portal/session', {})).status === 400, 'portal sign-in with nothing → 400');
check((await post('/api/portal/session', { call: 'not-a-verified-call' })).status === 403, 'an unverified call cannot open the portal');
const ps = await post('/api/portal/session', { demo: true });
check(ps.status === 200 && ps.j?.token && ps.j.household, 'the demo login opens the portal', JSON.stringify(ps.j).slice(0, 120));
const P = ps.j?.token;
for (const x of ['summary', 'documents', 'invoices', 'messages', 'appointments', 'organizer']) {
  const r = await get(`/api/portal/${x}`, P);
  check(r.status === 200, `GET /api/portal/${x} → 200`, `${r.status} ${JSON.stringify(r.j).slice(0, 160)}`);
  check((await get(`/api/portal/${x}`)).status === 401, `GET /api/portal/${x} without a token → 401`);
}
const threads = (await get('/api/portal/messages', P)).j;
const th = threads?.threads?.[0]?.id;
if (th) await ok200(`/api/portal/thread?id=${th}`, ['messages'], P);
const pm = await post('/api/portal/message', { subject: 'Api test question', body: 'Automated API test: is my organizer complete?' }, P);
check(pm.status === 200 && /^TH-/.test(pm.j?.thread ?? ''), 'a client starts a message thread', JSON.stringify(pm.j));
const pup = await call('POST', '/api/files?name=api-test-w2.pdf&form=portal', undefined, P, pdf);
check(pup.status === 200, 'a signed-in client uploads a document');
const fid = up.j?.id;
if (fid) { const f = await get(`/api/files/${fid}`, P); check(f.status === 200 || f.status === 403 || f.status === 404, `GET /api/files/<id> answers (${f.status})`); }

// ---- staff
ip = `10.4.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
console.log('\n== staff');
check((await get('/api/staff/me')).status === 401, 'staff routes need a token');
check((await get('/api/staff/me', 'staff.st-pra.99999999999999.bad')).status === 401, 'a forged staff token → 401');
check((await get('/api/staff/me', P)).status === 401, 'a portal token cannot read staff routes');
const ss = await post('/api/staff/session', { staff: 'st-pra' });
const S = ss.j?.token;
check(ss.status === 200 && S, 'staff demo sign-in');
await ok200('/api/staff/me', ['staff'], S);
await ok200('/api/staff/staff', ['staff'], S);
await ok200('/api/staff/dashboard', ['counts', 'pipeline'], S);
const garcia = await ok200('/api/staff/clients?q=garcia', ['rows', 'total'], S);
check(garcia?.rows?.length > 0, 'clients: a search for Garcia finds households');
if (garcia?.rows?.[0]) await ok200(`/api/staff/client?id=${garcia.rows[0].id}`, ['kind'], S);
const find = await ok200('/api/staff/find?q=the%20garcia%20household', ['matches'], S);
check(find?.matches?.length > 0 && /garcia/i.test(find.matches[0].name), 'find: "the Garcia household" matches a Garcia', JSON.stringify(find?.matches?.[0]));
await ok200('/api/staff/clients?kind=business&page=3', ['rows', 'pages'], S);
const docsIn = await ok200('/api/staff/engagements?stage=docs_in', ['rows', 'total'], S);
check(docsIn?.rows?.every((e: any) => e.stage === 'docs_in'), 'engagements filter by stage');
await ok200('/api/staff/pipeline', ['columns'], S);
await ok200('/api/staff/queue?days=14', ['rows'], S);
await ok200('/api/staff/documents?status=requested', ['rows'], S);
const nw = await ok200('/api/staff/notices?due_within=7', ['rows', 'total'], S);
check(nw?.rows?.every((n: any) => !n.response_due || n.response_due <= day(7)), 'notices due within 7 days are all due by then');
await ok200('/api/staff/calendar', ['appointments'], S);
await ok200('/api/staff/invoices?status=overdue', ['rows'], S);
const thr = await ok200('/api/staff/threads?unread=1', ['rows'], S);
if (thr?.rows?.[0]) await ok200(`/api/staff/thread?id=${thr.rows[0].id}`, ['thread', 'messages'], S);
await ok200('/api/staff/tasks?assignee=me&status=open', ['rows'], S);
const subs = await ok200('/api/staff/submissions?form=intake', ['rows'], S);
check(subs?.rows?.some((r: any) => r.data?.last_name === 'Test' || JSON.stringify(r.data).includes('Api')), 'the intake test submission shows in the staff submissions list');
await ok200('/api/staff/reports', ['byPreparer'], S);
const hh = garcia?.rows?.find((r: any) => /^HH-/.test(r.id))?.id ?? 'HH-10001';
ip = `10.4.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const en = await post('/api/staff/engagement', { client_ref: hh, kind: 'Tax planning', form: 'Planning', tax_year: '2026', preparer: 'st-pra', reviewer: '', due: day(30), fee: '450', notes: 'Api test engagement' }, S);
check(en.status === 200 && /^EN-/.test(en.j?.id ?? ''), 'staff: a new engagement is created', `${en.status} ${JSON.stringify(en.j).slice(0, 200)}`);
const enBad = await post('/api/staff/engagement', { client_ref: 'HH-1', kind: 'Lunch', form: '1040', tax_year: '1999', preparer: 'x', due: '', fee: '-1' }, S);
check(enBad.status === 422 && ['client_ref', 'kind', 'preparer', 'due'].every(f => enBad.j?.errors?.[f]), 'staff: a bad engagement → 422 per field', JSON.stringify(enBad.j).slice(0, 200));
if (en.j?.id) {
  check((await post('/api/staff/stage', { id: en.j.id, stage: 'docs_in' }, S)).j?.ok, 'staff: an engagement moves stage');
  const dr = await post('/api/staff/doc-request', { engagement_id: en.j.id, name: 'Api test brokerage statement', form: '1099-B' }, S);
  check(dr.j?.ok && /^DC-/.test(dr.j.id), 'staff: a document is requested');
}
const tk = await post('/api/staff/task', { title: 'Api test: call back about organizer', assignee: 'st-pra', client_ref: hh, due: day(3), priority: 'normal' }, S);
check(tk.j?.ok && /^TK-/.test(tk.j.id), 'staff: a task is created', JSON.stringify(tk.j));
if (tk.j?.id) check((await post('/api/staff/task-status', { id: tk.j.id, status: 'done' }, S)).j?.ok, 'staff: a task is marked done');
const sm = await post('/api/staff/message', { client_ref: hh, subject: 'Api test', body: 'Automated API test message.' }, S);
check(sm.j?.ok && /^TH-/.test(sm.j.thread), 'staff: a message thread is started');
check((await post('/api/staff/nope', {}, S)).status === 404, 'staff: an unknown write → 404');
const au = await ok200('/api/staff/audit?actor=st-pra', ['rows'], S);
const acts = new Set((au?.rows ?? []).map((r: any) => r.action));
check(['engagement.created', 'engagement.stage', 'document.requested', 'task.created', 'task.status', 'message.sent'].every(a => acts.has(a)), 'every staff write is in the audit log', [...acts].join(', '));
const au2 = await ok200('/api/staff/audit?entity=submission', ['rows'], S);
check((au2?.rows?.length ?? 0) > 0 || (await get('/api/staff/audit?action=form', S)).j?.rows?.length > 0, 'form submissions are in the audit log');

// ---- limits and errors
console.log('\n== limits');
check((await call('POST', '/api/forms/submit', undefined, undefined, Buffer.from('{not json'))).status === 400, 'bad JSON → 400');
check((await call('PUT', '/api/forms/submit')).status === 405, 'PUT → 405');
ip = `10.6.${Math.floor(Math.random() * 200)}.4`;
let codes: number[] = [];
for (let i = 0; i < 13; i++) codes.push((await post('/api/forms/submit', { form: 'contact', data: { name: '', email: '', phone: '', topic: '', message: '' } })).status);
check(codes.slice(0, 12).every(c => c === 422) && codes[12] === 429, 'the 13th submission in 10 minutes → 429', codes.join(','));
ip = `10.5.${Math.floor(Math.random() * 200)}.5`;
const keep = times['GET /api/site/locations'];
codes = await Promise.all(Array.from({ length: 245 }, () => get('/api/site/locations').then(r => r.status)));
times['GET /api/site/locations'] = keep;
check(codes.filter(c => c === 429).length >= 5 && codes.filter(c => c === 200).length <= 240, 'more than 240 reads a minute → 429', `${codes.filter(c => c === 429).length} limited`);

await srv.close();
const slow = Object.entries(times).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}ms`).join(', ');
console.log(`\npractice api: ${pass}/${pass + fail}${fail ? `  (failed: ${failures.join('; ')})` : ''}\nslowest: ${slow}`);
process.exit(fail ? 1 : 0);
