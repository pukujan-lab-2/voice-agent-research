// Brindlewick's practice backend: the public site's content and forms, the client portal and the staff CRM (/staff),
// all read from and written to the Octo workspace's Postgres (bw_* tables, tools/bw_crm.py and tools/bw_content.py) and
// Octo file storage. No local data and no fallbacks: when Octo is down, these routes say so.
//
// Every form is validated here (the browser's checks are a convenience), saved as a draft while it is filled and stored
// as a real record only when a person presses Submit. The copilot never submits; it has no route of its own here.
// Sessions are signed tokens (HMAC, in memory per server start): a portal session comes from a verified call or the
// demo login (no password: every client is fictional), a staff session from the staff demo login. Every write and every
// sign-in goes to bw_audit. Rate limits: reads 240 a minute, writes 30 a minute, submits 12 per 10 minutes, per visitor.
import crypto from 'node:crypto';

export type Sql = (text: string, params?: unknown[]) => Promise<any[]>;
export type PracticeDeps = {
  sql: Sql;
  upload: (name: string, mime: string, data: Buffer, meta: Record<string, string>) => Promise<string>; // Octo file id
  download: (fileId: string) => Promise<ArrayBuffer>;
  verifiedClient: (call: string) => string; // the client id a voice call was verified as, or ''
  log: (msg: string) => void;
  now?: () => Date;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);
const int = (s: unknown, d: number, lo: number, hi: number) => { if (s == null || s === '') return d; const n = Math.floor(Number(s)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const pageOf = (u: URLSearchParams, size = 25) => { const s = int(u.get('size'), size, 5, 100); const p = int(u.get('page'), 1, 1, 100000); return { size: s, page: p, offset: (p - 1) * s }; };
const paged = (rows: any[], p: { page: number; size: number }) => {
  const total = rows.length ? Number(rows[0].total) : 0;
  return { rows: rows.map(({ total: _t, ...r }) => r), page: p.page, size: p.size, total, pages: Math.max(1, Math.ceil(total / p.size)) };
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const money = (cents: number | null | undefined) => (cents == null ? null : `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const STAGES = ['organizer_sent', 'docs_in', 'in_prep', 'review', 'efiled', 'accepted'] as const;
export const STAGE_LABEL: Record<string, string> = { organizer_sent: 'Organizer sent', docs_in: 'Documents in', in_prep: 'In preparation', review: 'In review', efiled: 'E-filed', accepted: 'Accepted' };

// ---------------------------------------------------------------- form rules (server-side validation)
type Rule = { label: string; required?: boolean; max?: number; min?: number; re?: RegExp; reMsg?: string; oneOf?: string[]; kind?: 'email' | 'phone' | 'date' | 'time' | 'number' | 'zip' | 'ein' | 'year' | 'list'; future?: boolean; past?: boolean };
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const nameR = (label: string): Rule => ({ label, required: true, max: 80, re: /^[\p{L}][\p{L} .'-]*$/u, reMsg: `${label} can only have letters, spaces, apostrophes and hyphens.` });
const contact = { email: { label: 'Email', required: true, kind: 'email' } as Rule, phone: { label: 'Phone', required: true, kind: 'phone' } as Rule };
export const FORMS: Record<string, { title: string; fields: Record<string, Rule> }> = {
  intake: { title: 'New-client intake', fields: {
    first_name: nameR('First name'), last_name: nameR('Last name'), ...contact,
    street: { label: 'Street address', required: true, max: 120 }, city: { label: 'City', required: true, max: 60 },
    state: { label: 'State', required: true, oneOf: STATES }, zip: { label: 'ZIP code', required: true, kind: 'zip' },
    filing_status: { label: 'Filing status', required: true, oneOf: ['single', 'mfj', 'mfs', 'hoh', 'qss'] },
    dependents: { label: 'Dependants', required: true, kind: 'number', min: 0, max: 15 },
    income: { label: 'Income types', kind: 'list', oneOf: ['w2', 'self', 'rental', 'investments', 'retirement', 'social-security', 'crypto', 'k1', 'unemployment', 'foreign'] },
    services: { label: 'Services', required: true, oneOf: ['individual', 'business', 'bookkeeping', 'payroll', 'notice', 'planning', 'prior-year', 'state', 'trust', 'nonprofit'] },
    years: { label: 'Tax years', required: true, max: 60, re: /^(20[12]\d)([ ,and&-]+20[12]\d)*$/i, reMsg: 'List the tax years as four-digit years, like 2025 or 2024 and 2025.' },
    prior_preparer: { label: 'Who prepared your last return', required: true, oneOf: ['self', 'software', 'preparer', 'none'] },
    office: { label: 'Preferred office', required: true, oneOf: ['harrow', 'corbel', 'millbrook', 'remote'] },
    heard: { label: 'How you heard about us', oneOf: ['', 'referral', 'search', 'review', 'social', 'event', 'other'] },
    notes: { label: 'Notes', max: 2000 },
  } },
  booking: { title: 'Appointment', fields: {
    kind: { label: 'Appointment type', required: true, oneOf: ['consultation', 'review', 'planning', 'notice', 'signing'] },
    mode: { label: 'Meeting type', required: true, oneOf: ['office', 'video', 'phone'] },
    office: { label: 'Office', required: true, oneOf: ['harrow', 'corbel', 'millbrook'] },
    date: { label: 'Date', required: true, kind: 'date', future: true }, time: { label: 'Time', required: true, kind: 'time' },
    staff: { label: 'Preparer', max: 20 }, name: nameR('Full name'), ...contact, notes: { label: 'Notes', max: 1000 },
  } },
  notice: { title: 'IRS notice', fields: {
    name: nameR('Full name'), ...contact,
    code: { label: 'Notice or letter number', required: true, re: /^(CP|LTR|LT)\s?\d{1,5}[A-Z]?$/i, reMsg: 'Enter the notice number from the top right corner, like CP2000 or LTR 1058.' },
    tax_year: { label: 'Tax year', required: true, kind: 'year' }, notice_date: { label: 'Notice date', required: true, kind: 'date', past: true },
    amount: { label: 'Amount on the notice', kind: 'number', min: 0, max: 10_000_000 }, response_due: { label: 'Respond-by date', kind: 'date' },
    agree: { label: 'Do you agree with the notice', required: true, oneOf: ['agree', 'disagree', 'partly', 'unsure'] },
    description: { label: 'What happened', required: true, max: 3000, min: 10 }, files: { label: 'Uploads', kind: 'list' },
  } },
  payroll: { title: 'Payroll setup', fields: {
    business_name: { label: 'Business name', required: true, max: 120 }, ein: { label: 'EIN', required: true, kind: 'ein' },
    entity: { label: 'Entity type', required: true, oneOf: ['sole', 'llc', 'scorp', 'ccorp', 'partnership', 'nonprofit'] },
    employees: { label: 'Number of employees', required: true, kind: 'number', min: 1, max: 500 },
    frequency: { label: 'Pay frequency', required: true, oneOf: ['weekly', 'biweekly', 'semimonthly', 'monthly'] },
    first_pay_date: { label: 'First pay date with us', required: true, kind: 'date', future: true },
    state: { label: 'State where employees work', required: true, oneOf: STATES }, contact_name: nameR('Contact name'), ...contact,
    current_provider: { label: 'Current payroll provider', max: 80 }, notes: { label: 'Notes', max: 1000 },
  } },
  address: { title: 'Change of address', fields: {
    name: nameR('Full name'), ...contact, old_street: { label: 'Old street address', required: true, max: 120 },
    street: { label: 'New street address', required: true, max: 120 }, city: { label: 'New city', required: true, max: 60 },
    state: { label: 'New state', required: true, oneOf: STATES }, zip: { label: 'New ZIP code', required: true, kind: 'zip' },
    effective: { label: 'Moving date', required: true, kind: 'date' }, irs: { label: 'File Form 8822 with the IRS', required: true, oneOf: ['yes', 'no'] },
  } },
  'payment-plan': { title: 'Payment-plan request', fields: {
    name: nameR('Full name'), ...contact, years: { label: 'Tax years owed', required: true, max: 60, re: /^(20[0-2]\d)([ ,and&-]+20[0-2]\d)*$/i, reMsg: 'List the tax years as four-digit years, like 2024 or 2023 and 2024.' },
    owed: { label: 'Total owed', required: true, kind: 'number', min: 1, max: 10_000_000 }, monthly: { label: 'Monthly payment you can afford', required: true, kind: 'number', min: 25, max: 1_000_000 },
    plan: { label: 'Plan type', required: true, oneOf: ['short', 'long', 'unsure'] }, notice: { label: 'Have you had a notice', required: true, oneOf: ['yes', 'no'] },
    debit: { label: 'Pay by direct debit', required: true, oneOf: ['yes', 'no'] }, notes: { label: 'Notes', max: 1000 },
  } },
  transcript: { title: 'Prior-year return request', fields: {
    name: nameR('Full name'), ...contact, tax_year: { label: 'Tax year', required: true, kind: 'year' },
    what: { label: 'What you need', required: true, oneOf: ['copy', 'transcript', 'both'] }, delivery: { label: 'Delivery', required: true, oneOf: ['portal', 'mail'] },
    purpose: { label: 'What it is for', required: true, oneOf: ['mortgage', 'aid', 'immigration', 'records', 'other'] }, notes: { label: 'Notes', max: 1000 },
  } },
  referral: { title: 'Referral', fields: {
    your_name: nameR('Your name'), your_email: { label: 'Your email', required: true, kind: 'email' }, friend_name: nameR("Friend's name"),
    friend_email: { label: "Friend's email", kind: 'email' }, friend_phone: { label: "Friend's phone", kind: 'phone' },
    relationship: { label: 'How you know them', required: true, oneOf: ['family', 'friend', 'colleague', 'client', 'other'] },
    service: { label: 'What they need', required: true, oneOf: ['individual', 'business', 'bookkeeping', 'payroll', 'notice', 'planning'] }, notes: { label: 'Notes', max: 1000 },
  } },
  application: { title: 'Job application', fields: {
    job: { label: 'Position', required: true, max: 40 }, name: nameR('Full name'), ...contact,
    credentials: { label: 'Credentials', required: true, oneOf: ['cpa', 'ea', 'both', 'progress', 'none'] }, years: { label: 'Years of experience', required: true, kind: 'number', min: 0, max: 50 },
    start: { label: 'Earliest start date', required: true, kind: 'date', future: true }, resume: { label: 'Résumé', kind: 'list' }, cover: { label: 'Why Brindlewick', required: true, min: 20, max: 4000 },
  } },
  // the consultation request at /tax/book (the original intake form; its field names are kept)
  consultation: { title: 'Consultation request', fields: {
    fullname: nameR('Full name'), tel: { label: 'Phone', required: true, kind: 'phone' }, mail: { label: 'Email', required: true, kind: 'email' },
    status: { label: 'Filing status', required: true, oneOf: ['single', 'mfj', 'mfs', 'hoh', 'qss'] },
    years: { label: 'Tax years', required: true, max: 60, re: /^(20[12]\d)([ ,and&-]+20[12]\d)*$/i, reMsg: 'List the tax years as four-digit years, like 2025 or 2024 and 2025.' },
    service: { label: 'Service needed', required: true, oneOf: ['individual', 'bookkeeping', 'payroll', 'notice', 'planning'] },
    notice: { label: 'IRS notice', required: true, oneOf: ['yes', 'no'] },
    noticecode: { label: 'Notice code', re: /^(CP|LTR|LT)\s?\d{1,5}[A-Z]?$/i, reMsg: 'Enter the notice code from the top right corner, like CP2000.' },
    day: { label: 'Preferred date', required: true, kind: 'date', future: true }, slot: { label: 'Preferred time', required: true, oneOf: ['morning', 'afternoon', 'evening'] },
    notes: { label: 'Notes', max: 2000 },
  } },
  contact: { title: 'Contact', fields: { name: nameR('Full name'), ...contact, topic: { label: 'Topic', required: true, oneOf: ['question', 'billing', 'portal', 'other'] }, message: { label: 'Message', required: true, min: 5, max: 3000 } } },
};
// Staff-side forms (saved by a staff member's click in /staff)
const STAFF_FORMS: Record<string, Record<string, Rule>> = {
  engagement: { client_ref: { label: 'Client', required: true, re: /^(HH|BZ)-\d{5}$/, reMsg: 'Pick a household or business from the client list.' },
    kind: { label: 'Engagement type', required: true, oneOf: ['Individual return', 'Business return', 'Nonprofit return', 'Fiduciary return', 'Amended return', 'Prior-year return', 'Tax planning', 'Monthly bookkeeping', 'Payroll', 'Notice response'] },
    form: { label: 'Form', required: true, oneOf: ['1040', '1040-X', '1120-S', '1065', '1120', '990', '990-EZ', '1041', '941', 'Planning', 'Bookkeeping', 'Notice'] },
    tax_year: { label: 'Tax year', required: true, kind: 'year' }, preparer: { label: 'Preparer', required: true, re: /^st-[a-z]{3}$/ },
    reviewer: { label: 'Reviewer', re: /^st-[a-z]{3}$/ }, due: { label: 'Due date', required: true, kind: 'date' }, fee: { label: 'Fee', required: true, kind: 'number', min: 0, max: 100000 },
    notes: { label: 'Notes', max: 2000 } },
  task: { title: { label: 'Task', required: true, min: 3, max: 160 }, assignee: { label: 'Assignee', required: true, re: /^st-[a-z]{3}$/ }, client_ref: { label: 'Client', re: /^(HH|BZ)-\d{5}$/ },
    due: { label: 'Due date', required: true, kind: 'date' }, priority: { label: 'Priority', required: true, oneOf: ['high', 'normal', 'low'] } },
  message: { thread: { label: 'Thread', re: /^TH-\d+$/ }, client_ref: { label: 'Client', re: /^(HH|BZ)-\d{5}$/ }, subject: { label: 'Subject', max: 120 }, body: { label: 'Message', required: true, min: 1, max: 4000 } },
  stage: { id: { label: 'Engagement', required: true, re: /^EN-\d+$/ }, stage: { label: 'Stage', required: true, oneOf: [...STAGES] } },
  'task-status': { id: { label: 'Task', required: true, re: /^TK-\d+$/ }, status: { label: 'Status', required: true, oneOf: ['open', 'in progress', 'waiting', 'done'] } },
  'doc-request': { engagement_id: { label: 'Engagement', required: true, re: /^EN-\d+$/ }, name: { label: 'Document', required: true, min: 3, max: 120 }, form: { label: 'Form', required: true, max: 30 } },
};

function validate(rules: Record<string, Rule>, data: Record<string, unknown>, today: string) {
  const errors: Record<string, string> = {};
  const out: Record<string, unknown> = {};
  for (const [k, r] of Object.entries(rules)) {
    const raw = data[k];
    if (r.kind === 'list') {
      const xs = Array.isArray(raw) ? raw.map(x => clip(x, 80)) : raw ? String(raw).split(',').map(s => s.trim()).filter(Boolean) : [];
      if (r.required && !xs.length) errors[k] = `Choose at least one: ${r.label.toLowerCase()}.`;
      else if (r.oneOf && xs.some(x => !r.oneOf!.includes(x))) errors[k] = `${r.label}: choose from the list.`;
      out[k] = xs.slice(0, 20);
      continue;
    }
    const v = String(raw ?? '').trim();
    if (!v) { if (r.required) errors[k] = `${r.label} is required.`; else out[k] = ''; continue; }
    if (r.max && v.length > r.max && r.kind !== 'number') { errors[k] = `${r.label} must be ${r.max} characters or fewer.`; continue; }
    if (r.min && v.length < r.min && r.kind !== 'number') { errors[k] = `${r.label} needs at least ${r.min} characters.`; continue; }
    if (r.oneOf && !r.oneOf.includes(v)) { errors[k] = `${r.label}: choose one of the options.`; continue; }
    if (r.re && !r.re.test(v)) { errors[k] = r.reMsg ?? `${r.label} isn't in the right format.`; continue; }
    switch (r.kind) {
      case 'email': if (!EMAIL.test(v)) { errors[k] = 'Enter a valid email address, like name@example.com.'; continue; } break;
      case 'phone': { const d = v.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''); if (d.length !== 10) { errors[k] = 'Enter a 10-digit US phone number, like (555) 010-0199.'; continue; } out[k] = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`; continue; }
      case 'zip': if (!/^\d{5}(-\d{4})?$/.test(v)) { errors[k] = 'Enter a 5-digit ZIP code.'; continue; } break;
      case 'ein': if (!/^\d{2}-?\d{7}$/.test(v)) { errors[k] = 'Enter the EIN as 9 digits, like 12-3456789.'; continue; } out[k] = v.replace(/^(\d{2})-?/, '$1-'); continue;
      case 'year': if (!/^20[0-2]\d$/.test(v) || +v > +today.slice(0, 4)) { errors[k] = 'Enter a four-digit tax year, 2000 or later and not in the future.'; continue; } break;
      case 'time': if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) { errors[k] = 'Pick a time from the list.'; continue; } break;
      case 'number': { const n = Number(v.replace(/[$,]/g, '')); if (!Number.isFinite(n)) { errors[k] = `${r.label} must be a number.`; continue; }
        if (r.min != null && n < r.min) { errors[k] = `${r.label} must be at least ${r.min.toLocaleString('en-US')}.`; continue; }
        if (r.max != null && n > r.max) { errors[k] = `${r.label} must be at most ${r.max.toLocaleString('en-US')}.`; continue; }
        out[k] = n; continue; }
      case 'date': { if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) { errors[k] = `Enter ${r.label.toLowerCase()} as a date.`; continue; }
        if (r.future && v < today) { errors[k] = `${r.label} can't be in the past.`; continue; }
        if (r.past && v > today) { errors[k] = `${r.label} can't be in the future.`; continue; } break; }
    }
    out[k] = v;
  }
  return { ok: !Object.keys(errors).length, errors, data: out };
}

// ---------------------------------------------------------------- sessions and limits
class Tokens {
  private key = crypto.randomBytes(32);
  sign(kind: 'portal' | 'staff', id: string, hours = 8) {
    const body = `${kind}.${id}.${Date.now() + hours * 3600_000}`;
    return `${body}.${crypto.createHmac('sha256', this.key).update(body).digest('base64url')}`;
  }
  read(req: Request, kind: 'portal' | 'staff'): string | null {
    const t = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const parts = t.split('.');
    if (parts.length !== 4 || parts[0] !== kind) return null;
    const body = parts.slice(0, 3).join('.');
    const want = crypto.createHmac('sha256', this.key).update(body).digest('base64url');
    if (want.length !== parts[3].length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(parts[3]))) return null;
    return Number(parts[2]) > Date.now() ? parts[1] : null;
  }
}
class Limits {
  private hits = new Map<string, number[]>();
  hit(key: string, n: number, ms: number) {
    const now = Date.now();
    const h = (this.hits.get(key) ?? []).filter(t => now - t < ms);
    h.push(now);
    this.hits.set(key, h);
    if (this.hits.size > 20000) this.hits.clear();
    return h.length > n;
  }
}

// ---------------------------------------------------------------- the routes
export function createPractice(d: PracticeDeps) {
  const { sql, log } = d;
  const now = () => d.now?.() ?? new Date();
  const today = () => iso(now());
  const tokens = new Tokens();
  const limits = new Limits();
  const audit = (actor: string, kind: string, action: string, entity: string, id: string | null, detail: string | null, ip: string) =>
    sql('insert into bw_audit (actor, actor_kind, action, entity, entity_id, detail, ip) values ($1,$2,$3,$4,$5,$6,$7)', [actor, kind, action, entity, id, detail ? clip(detail, 300) : null, ip])
      .catch(e => log(`audit failed: ${(e as Error).message}`));
  const ref = (prefix: string) => `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;

  // ---- slots
  async function loadSlots(from: string, days: number, office: string, staff: string) {
    const people = await sql(`select id, name, credentials, hours from bw_staff where accepts_new and ($1 = '' or office = $1) and ($2 = '' or id = $2) and role not in ('bookkeeping','payroll','operations') order by sort`, [office, staff]);
    const booked = people.length ? await sql(`select staff_id, to_char(starts, 'YYYY-MM-DD') as d, to_char(starts, 'HH24:MI') as t, minutes from bw_appointments where starts >= $1::date and starts < $1::date + $2::int and status <> 'cancelled' and staff_id = any($3)`, [from, days, people.map(p => p.id)]) : [];
    return { people, booked };
  }
  function openTimes(date: string, { people, booked }: Awaited<ReturnType<typeof loadSlots>>, minutes = 30) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const day = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (day === 0 || day === 6 || date < today() || !people.length) return [];
    const busy = new Map<string, Set<number>>();
    for (const b of booked) {
      if (b.d !== date) continue;
      const [h, m] = b.t.split(':').map(Number);
      const s = busy.get(b.staff_id) ?? new Set();
      for (let x = h * 60 + m; x < h * 60 + m + b.minutes; x += 30) s.add(x);
      busy.set(b.staff_id, s);
    }
    const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][day];
    const out: { time: string; label: string; staff: { id: string; name: string }[] }[] = [];
    const nowMin = date === today() ? now().getHours() * 60 + now().getMinutes() + 60 : 0;
    for (let t = 9 * 60; t < 17 * 60; t += 30) {
      if (t >= 12 * 60 && t < 13 * 60) continue;
      if (t < nowMin) continue;
      const free = people.filter(p => {
        const [a, b] = (typeof p.hours === 'string' ? JSON.parse(p.hours) : p.hours)[dayKey] ?? [0, 0];
        if (t < a * 60 || t + minutes > b * 60) return false;
        for (let x = t; x < t + minutes; x += 30) if (busy.get(p.id)?.has(x)) return false;
        return true;
      });
      if (!free.length) continue;
      const hh = Math.floor(t / 60), mm = t % 60;
      out.push({ time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, label: `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`,
        staff: free.map(p => ({ id: p.id, name: p.credentials ? `${p.name}, ${p.credentials}` : p.name })) });
    }
    return out;
  }
  // 30-minute starts from 9:00 to 16:30 on weekdays (no 12:00-1:00), minus every booked appointment
  const slots = async (date: string, office: string, staff: string, minutes = 30) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) ? openTimes(date, await loadSlots(date, 1, office, staff), minutes) : [];

  // ---- submissions (a person pressed Submit)
  async function submit(form: string, data: Record<string, unknown>, ip: string, clientRef: string | null) {
    const f = FORMS[form];
    if (!f) return json({ error: 'unknown form' }, 404);
    const v = validate(f.fields, data, today());
    if (form === 'referral' && !v.data.friend_email && !v.data.friend_phone && !v.errors.friend_email && !v.errors.friend_phone) v.errors.friend_email = "Give your friend's email or phone.";
    if (form === 'payment-plan' && Number(v.data.monthly) > Number(v.data.owed)) v.errors.monthly = "The monthly payment can't be more than the total owed.";
    if (Object.keys(v.errors).length) return json({ error: 'invalid', errors: v.errors }, 422);
    let reference = ref({ consultation: 'CR', intake: 'NC', booking: 'BK', notice: 'NT', payroll: 'PS', address: 'AD', 'payment-plan': 'PP', transcript: 'PY', referral: 'RF', application: 'JA', contact: 'CT' }[form] ?? 'BW');
    let extra: Record<string, unknown> = {};
    if (form === 'booking') {
      const want = String(v.data.staff || '');
      const minutes = v.data.kind === 'review' || v.data.kind === 'planning' ? 60 : 30;
      const open = (await slots(String(v.data.date), String(v.data.office), want, minutes)).find(s => s.time === v.data.time);
      if (!open) return json({ error: 'invalid', errors: { time: 'That time was just booked. Pick another time.' } }, 409);
      const staff = open.staff[0];
      // insert only if no overlapping appointment exists for that preparer (two people booking the same slot at once)
      const rows = await sql(`insert into bw_appointments (id, staff_id, client_ref, client_name, starts, minutes, kind, mode, status, location, notes, ref)
        select $1, $2, $3, $4, $5::timestamp, $6, $7, $8, 'booked', $9, $10, $11
        where not exists (select 1 from bw_appointments where staff_id = $2 and status <> 'cancelled' and starts < $5::timestamp + make_interval(mins => $6) and starts + make_interval(mins => minutes) > $5::timestamp)
        returning id`, [`AP-${crypto.randomBytes(5).toString('hex')}`, staff.id, clientRef, v.data.name, `${v.data.date} ${v.data.time}`, minutes,
        { consultation: 'Consultation', review: 'Return review', planning: 'Planning meeting', notice: 'Notice review', signing: 'Signing' }[String(v.data.kind)], v.data.mode, v.data.office, clip(v.data.notes, 1000), reference]);
      if (!rows.length) return json({ error: 'invalid', errors: { time: 'That time was just booked. Pick another time.' } }, 409);
      extra = { appointment: rows[0].id, staff: staff.name, when: `${v.data.date} ${v.data.time}`, minutes };
    }
    await sql('insert into bw_submissions (id, form, ref, data, client_ref, ip) values ($1,$2,$3,$4,$5,$6)', [crypto.randomUUID(), form, reference, JSON.stringify({ ...v.data, ...extra }), clientRef, ip]);
    if (data.draft) await sql('delete from bw_drafts where id = $1', [clip(data.draft, 40)]);
    await audit(clientRef ?? 'visitor', clientRef ? 'client' : 'visitor', `${form}.submitted`, 'submission', reference, null, ip);
    log(`submit ${form} ${reference}`);
    return json({ ok: true, ref: reference, ...extra, message: `${f.title} received. Your reference is ${reference}.` });
  }

  // ---- the staff CRM's client list
  async function clientList(u: URLSearchParams) {
    const p = pageOf(u);
    const q = clip(u.get('q'), 80).trim();
    const kind = u.get('kind') === 'business' ? 'business' : u.get('kind') === 'household' ? 'household' : '';
    const filters = [clip(u.get('preparer'), 10), clip(u.get('office'), 12), clip(u.get('tag'), 20), clip(u.get('stage'), 20), clip(u.get('industry'), 40)];
    const sort = { name: 'name', since: 'since desc', due: 'next_due nulls last' }[u.get('sort') ?? 'name'] ?? 'name';
    const rows = await sql(`with c as (
        select h.id, 'household' as kind, h.name, h.city, h.state, h.preparer, h.office, h.since, h.tags, null as industry, h.filing_status as detail,
               (select count(*) from bw_clients x where x.household_id = h.id) as people
        from bw_households h where ($1 = '' or $1 = 'household')
          and ($2 = '' or h.name ilike '%' || $2 || '%' or h.id = upper($2) or exists (select 1 from bw_clients x where x.household_id = h.id and (x.full_name ilike '%' || $2 || '%' or x.email ilike $2 || '%')))
        union all
        select b.id, 'business', b.name, b.city, b.state, b.preparer, null, b.since, b.services, b.industry, b.entity, b.employees
        from bw_businesses b where ($1 = '' or $1 = 'business') and ($2 = '' or b.name ilike '%' || $2 || '%' or b.id = upper($2) or b.ein = $2))
      select c.*, s.name as preparer_name, e.stage, e.due as next_due, count(*) over() as total
      from c left join bw_staff s on s.id = c.preparer
      left join lateral (select stage, due from bw_engagements e where e.client_ref = c.id and e.stage <> 'accepted' order by due limit 1) e on true
      where ($3 = '' or c.preparer = $3) and ($4 = '' or c.office = $4) and ($5 = '' or $5 = any(c.tags)) and ($6 = '' or e.stage = $6) and ($7 = '' or c.industry = $7)
      order by ${sort}, c.id limit $8 offset $9`, [kind, q, ...filters, p.size, p.offset]);
    return paged(rows, p);
  }

  async function clientDetail(id: string) {
    const isBiz = id.startsWith('BZ-');
    const head = isBiz
      ? (await sql(`select b.*, s.name as preparer_name, o.full_name as owner_name, o.id as owner_id from bw_businesses b left join bw_staff s on s.id = b.preparer left join bw_clients o on o.id = b.owner_client where b.id = $1`, [id]))[0]
      : (await sql(`select h.*, s.name as preparer_name from bw_households h left join bw_staff s on s.id = h.preparer where h.id = $1`, [id]))[0];
    if (!head) return null;
    const [people, engagements, documents, invoices, notices, threads, appointments, tasks, activity, related, payroll] = await Promise.all([
      isBiz ? sql(`select id, full_name, relation, email, phone, occupation from bw_clients where id = $1`, [head.owner_client])
        : sql(`select id, full_name, relation, email, phone, occupation, portal, extract(year from age(dob))::int as age from bw_clients where household_id = $1 order by relation <> 'primary', relation <> 'spouse', full_name`, [id]),
      sql(`select e.*, s.name as preparer_name, r.name as reviewer_name from bw_engagements e left join bw_staff s on s.id = e.preparer left join bw_staff r on r.id = e.reviewer where client_ref = $1 order by tax_year desc, due desc`, [id]),
      sql(`select * from bw_documents where client_ref = $1 order by requested desc limit 200`, [id]),
      sql(`select * from bw_invoices where client_ref = $1 order by issued desc limit 100`, [id]),
      sql(`select * from bw_notices where client_ref = $1 order by response_due desc`, [id]),
      sql(`select * from bw_threads where client_ref = $1 order by updated desc limit 50`, [id]),
      sql(`select a.*, s.name as staff_name from bw_appointments a left join bw_staff s on s.id = a.staff_id where client_ref = $1 order by starts desc limit 50`, [id]),
      sql(`select * from bw_tasks where client_ref = $1 order by status = 'done', due limit 100`, [id]),
      sql(`select a.at, a.actor, s.name as actor_name, a.action, a.entity, a.entity_id, a.detail from bw_audit a left join bw_staff s on s.id = a.actor
           where a.entity_id = $1 or a.entity_id in (select id from bw_engagements where client_ref = $1) order by a.at desc limit 60`, [id]),
      isBiz ? sql(`select id, name from bw_households where id = $1`, [head.household_id ?? ''])
        : sql(`select id, name, entity, industry from bw_businesses where household_id = $1`, [id]),
      isBiz ? sql(`select * from bw_payroll_runs where business_id = $1 order by pay_date desc limit 24`, [id]) : Promise.resolve([]),
    ]);
    const billed = invoices.reduce((s: number, i: any) => s + i.amount_cents, 0), paid = invoices.reduce((s: number, i: any) => s + i.paid_cents, 0);
    return { kind: isBiz ? 'business' : 'household', client: head, people, engagements, documents, invoices, notices, threads, appointments, tasks, activity, related, payroll,
      totals: { billed: money(billed), paid: money(paid), outstanding: money(billed - paid), openNotices: notices.filter((n: any) => !['resolved'].includes(n.status)).length,
        missingDocs: documents.filter((x: any) => x.status === 'requested').length } };
  }

  async function dashboard(staff: string) {
    const t = today();
    const [counts, pipeline, mine, notices, appts, unread, billing, queue] = await Promise.all([
      sql(`select (select count(*) from bw_households) households, (select count(*) from bw_businesses) businesses, (select count(*) from bw_clients) people,
           (select count(*) from bw_engagements where stage <> 'accepted') open_engagements, (select count(*) from bw_engagements where stage not in ('efiled','accepted') and due < $1::date) overdue,
           (select count(*) from bw_documents where status = 'requested') docs_requested, (select count(*) from bw_submissions where status = 'new') new_submissions`, [t]),
      sql(`select stage, count(*)::int as n from bw_engagements where tax_year = 2025 and form in ('1040','1120-S','1065','1120','990','990-EZ','1041') group by stage`),
      sql(`select count(*) filter (where status <> 'done')::int as open, count(*) filter (where status <> 'done' and due < $2::date)::int as late from bw_tasks where assignee = $1`, [staff, t]),
      sql(`select count(*) filter (where status not in ('resolved','response sent') and response_due between $1::date and $1::date + 7)::int as due_week,
           count(*) filter (where status not in ('resolved','response sent') and response_due < $1::date)::int as past_due from bw_notices`, [t]),
      sql(`select a.id, a.starts, a.minutes, a.kind, a.mode, a.client_name, a.client_ref from bw_appointments a where a.staff_id = $1 and a.starts >= $2::date and a.starts < $2::date + 7 and status = 'booked' order by starts limit 12`, [staff, t]),
      sql(`select count(*)::int as n from bw_threads where staff_id = $1 and unread_staff > 0`, [staff]),
      sql(`select coalesce(sum(amount_cents - paid_cents) filter (where status = 'overdue'), 0)::bigint as overdue, coalesce(sum(paid_cents) filter (where issued >= date_trunc('month', $1::date)), 0)::bigint as collected_month from bw_invoices`, [t]),
      sql(`select e.id, e.client_ref, e.client_name, e.form, e.tax_year, e.stage, e.due, e.priority from bw_engagements e where e.preparer = $1 and e.stage not in ('efiled','accepted') order by e.due limit 10`, [staff]),
    ]);
    return { counts: counts[0], pipeline: STAGES.map(s => ({ stage: s, label: STAGE_LABEL[s], n: pipeline.find((p: any) => p.stage === s)?.n ?? 0 })), tasks: mine[0], notices: notices[0],
      appointments: appts, unread: unread[0].n, billing: { overdue: money(Number(billing[0].overdue)), collectedThisMonth: money(Number(billing[0].collected_month)) }, queue };
  }

  async function reports() {
    const [byPreparer, byMonth, aging, mix, notices] = await Promise.all([
      sql(`select s.id, s.name, count(*) filter (where e.stage not in ('efiled','accepted'))::int as open, count(*) filter (where e.stage = 'accepted' and e.tax_year = 2025)::int as done_2025,
           count(*) filter (where e.stage not in ('efiled','accepted') and e.due < $1::date)::int as overdue from bw_staff s left join bw_engagements e on e.preparer = s.id group by s.id, s.name, s.sort order by s.sort`, [today()]),
      sql(`select to_char(date_trunc('month', paid), 'YYYY-MM') as month, sum(amount_cents)::bigint as cents, count(*)::int as n from bw_payments where paid >= '2025-11-01' group by 1 order by 1`),
      sql(`select case when $1::date - due <= 0 then 'current' when $1::date - due <= 30 then '1-30' when $1::date - due <= 60 then '31-60' when $1::date - due <= 90 then '61-90' else '90+' end as bucket,
           count(*)::int as n, sum(amount_cents - paid_cents)::bigint as cents from bw_invoices where status in ('open','overdue','partial') group by 1`, [today()]),
      sql(`select form, count(*)::int as n, sum(fee_cents)::bigint as fees from bw_engagements where tax_year = 2025 group by form order by n desc`),
      sql(`select code, count(*)::int as n from bw_notices group by code order by n desc limit 10`),
    ]);
    return { byPreparer, revenueByMonth: byMonth.map((r: any) => ({ month: r.month, collected: money(Number(r.cents)), cents: Number(r.cents), payments: r.n })),
      aging: ['current', '1-30', '31-60', '61-90', '90+'].map(b => { const r = aging.find((x: any) => x.bucket === b); return { bucket: b, invoices: r?.n ?? 0, outstanding: money(Number(r?.cents ?? 0)) }; }),
      mix: mix.map((r: any) => ({ form: r.form, engagements: r.n, fees: money(Number(r.fees)) })), notices };
  }

  // ---- the routes
  async function get(path: string, u: URLSearchParams, req: Request, ip: string): Promise<Response | null> {
    // public site content (seeded by tools/bw_content.py)
    if (path === '/api/site/team') return json({ team: await sql(`select id, name, first_name, role, credentials, title, office, bio, specialties, years, languages, avatar, accepts_new from bw_staff order by sort`) });
    if (path === '/api/site/avatar') {
      // staff portraits (tools/bw_avatars.mjs: DiceBear Notionists, CC0), stored in Octo files
      const f = (await sql('select avatar_file from bw_staff where id = $1', [clip(u.get('id'), 10)]))[0]?.avatar_file;
      if (!f) return json({ error: 'not found' }, 404);
      return new Response(await d.download(f), { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
    }
    if (path === '/api/site/locations') return json({ locations: await sql('select * from bw_locations order by id = $1 desc, name', ['harrow']) });
    if (path === '/api/site/reviews') { const p = pageOf(u, 12); return json(paged(await sql(`select id, author, city, service, rating, title, body, date, staff_id, count(*) over() as total from bw_reviews order by date desc limit $1 offset $2`, [p.size, p.offset]), p)); }
    if (path === '/api/site/articles') return json({ articles: await sql(`select slug, title, summary, category, author_id, published, minutes, tags from bw_articles order by published desc`) });
    if (path === '/api/site/article') { const a = (await sql('select * from bw_articles where slug = $1', [clip(u.get('slug'), 80)]))[0]; return a ? json({ article: a }) : json({ error: 'not found' }, 404); }
    if (path === '/api/site/jobs') return json({ jobs: await sql('select * from bw_jobs where open order by sort') });
    if (path === '/api/site/deadlines') return json({ deadlines: await sql(`select * from bw_deadlines where date between coalesce($1::date, '2026-01-01') and coalesce($2::date, '2027-12-31') order by date, sort`, [u.get('from') || null, u.get('to') || null]) });
    if (path === '/api/site/checklist') {
      const want = clip(u.get('situations'), 300).split(',').map(s => s.trim()).filter(Boolean);
      return json({ situations: await sql('select id, label, hint, sort from bw_checklist_situations order by sort'),
        items: want.length ? await sql('select * from bw_checklist_items where situation = any($1) order by situation, sort', [want]) : [] });
    }
    if (path === '/api/site/services') return json({ services: await sql('select slug, name, short, audience, from_price, icon, sort from bw_services order by sort') });
    if (path === '/api/site/service') { const s = (await sql('select * from bw_services where slug = $1', [clip(u.get('slug'), 60)]))[0]; return s ? json({ service: s }) : json({ error: 'not found' }, 404); }
    if (path === '/api/site/industries') return json({ industries: await sql('select slug, name, short, icon, sort from bw_industries order by sort') });
    if (path === '/api/site/industry') { const s = (await sql('select * from bw_industries where slug = $1', [clip(u.get('slug'), 60)]))[0]; return s ? json({ industry: s }) : json({ error: 'not found' }, 404); }
    if (path === '/api/site/pages') return json({ pages: await sql('select path, title, section, summary, keywords from bw_pages order by sort') });
    if (path === '/api/site/rates') return json({ rates: await sql('select * from bw_rates order by sort') });
    if (path === '/api/site/search') {
      const q = clip(u.get('q'), 100).trim();
      if (q.length < 2) return json({ pages: [], articles: [], guides: [], team: [] });
      const [pages, articles, guides, team] = await Promise.all([
        sql(`select path, title, section, summary from bw_pages where title ilike '%'||$1||'%' or summary ilike '%'||$1||'%' or $1 ilike any(keywords) or exists (select 1 from unnest(keywords) k where k ilike '%'||$1||'%') order by title ilike '%'||$1||'%' desc, sort limit 8`, [q]),
        sql(`select slug, title, summary from bw_articles where title ilike '%'||$1||'%' or summary ilike '%'||$1||'%' or $1 ilike any(tags) order by published desc limit 5`, [q]),
        sql(`select doc, title, category from irs_docs where category in ('publications','instructions','taxtopics','faqs') and title ilike '%'||$1||'%' order by length(title) limit 6`, [q]),
        sql(`select id, name, title from bw_staff where name ilike '%'||$1||'%' or $1 ilike any(specialties) or array_to_string(specialties, ' ') ilike '%'||$1||'%' limit 4`, [q]),
      ]);
      return json({ pages, articles, guides, team });
    }
    if (path === '/api/slots') {
      const date = clip(u.get('date'), 10), office = clip(u.get('office'), 12), staff = clip(u.get('staff'), 10);
      const kind = u.get('kind');
      return json({ date, slots: await slots(date, office, staff, kind === 'review' || kind === 'planning' ? 60 : 30) });
    }
    if (path === '/api/slots/days') {
      // the next 15 weekdays with how many open times each has
      const office = clip(u.get('office'), 12), staff = clip(u.get('staff'), 10);
      const dates: string[] = [];
      const d = now();
      for (let i = 0; dates.length < 15 && i < 30; i++) {
        const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
        if (x.getDay() === 0 || x.getDay() === 6) continue;
        dates.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`);
      }
      const loaded = await loadSlots(dates[0], 31, office, staff);
      const days = dates.map(date => ({ date, open: openTimes(date, loaded).length }));
      return json({ days });
    }
    if (path === '/api/forms/draft') { const r = (await sql('select form, data, updated from bw_drafts where id = $1', [clip(u.get('id'), 40)]))[0]; return r ? json({ draft: r }) : json({ error: 'not found' }, 404); }
    if (path === '/api/forms') return json({ forms: Object.fromEntries(Object.entries(FORMS).map(([k, f]) => [k, { title: f.title, fields: Object.fromEntries(Object.entries(f.fields).map(([n, r]) => [n, { label: r.label, required: !!r.required, options: r.oneOf }])) }])) });
    if (path.startsWith('/api/files/')) {
      const id = clip(path.slice('/api/files/'.length), 60);
      const who = tokens.read(req, 'staff') ?? tokens.read(req, 'portal');
      if (!who) return json({ error: 'sign in first' }, 401);
      const f = (await sql('select * from bw_uploads where id = $1', [id]))[0];
      if (!f) return json({ error: 'not found' }, 404);
      if (!who.startsWith('st-') && f.client_ref !== who) return json({ error: 'not yours' }, 403);
      return new Response(await d.download(f.file_id), { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${f.name.replace(/"/g, '')}"` } });
    }

    // ---- client portal
    if (path.startsWith('/api/portal/')) {
      const hh = tokens.read(req, 'portal');
      if (!hh) return json({ error: 'sign in first' }, 401);
      if (path === '/api/portal/summary') {
        const [h, people, ret, docs, inv, appts, threads, notices] = await Promise.all([
          sql('select h.*, s.name as preparer_name, s.credentials as preparer_credentials from bw_households h left join bw_staff s on s.id = h.preparer where h.id = $1', [hh]),
          sql(`select id, first_name, full_name, relation from bw_clients where household_id = $1 order by relation <> 'primary', relation <> 'spouse'`, [hh]),
          sql(`select e.*, s.name as preparer_name from bw_engagements e left join bw_staff s on s.id = e.preparer where client_ref = $1 order by tax_year desc, due desc`, [hh]),
          sql(`select count(*) filter (where status = 'requested')::int as requested, count(*) filter (where status = 'received')::int as received from bw_documents where client_ref = $1`, [hh]),
          sql(`select count(*) filter (where status in ('open','overdue','partial'))::int as open, coalesce(sum(amount_cents - paid_cents) filter (where status in ('open','overdue','partial')), 0)::bigint as due from bw_invoices where client_ref = $1`, [hh]),
          sql(`select a.id, a.starts, a.minutes, a.kind, a.mode, a.location, s.name as staff_name from bw_appointments a left join bw_staff s on s.id = a.staff_id where client_ref = $1 and starts >= now() and status = 'booked' order by starts limit 5`, [hh]),
          sql(`select count(*) filter (where unread_client > 0)::int as unread from bw_threads where client_ref = $1`, [hh]),
          sql(`select id, code, title, response_due, status from bw_notices where client_ref = $1 and status <> 'resolved' order by response_due`, [hh]),
        ]);
        if (!h[0]) return json({ error: 'not found' }, 404);
        const { notes: _n, risk: _r, tags: _t, ...household } = h[0]; // staff-only fields stay on the staff side
        return json({ household, people, returns: ret.map((e: any) => ({ ...e, stage_label: STAGE_LABEL[e.stage] })), documents: docs[0], invoices: { open: inv[0].open, due: money(Number(inv[0].due)) },
          appointments: appts, unread: threads[0].unread, notices, sample: true });
      }
      if (path === '/api/portal/documents') return json({ documents: await sql('select id, engagement_id, name, form, status, requested, received, size_kb, source, file_id is not null as has_file from bw_documents where client_ref = $1 order by status = $2 desc, requested desc', [hh, 'requested']) });
      if (path === '/api/portal/invoices') return json({ invoices: await sql('select i.*, (select json_agg(p order by p.paid) from bw_payments p where p.invoice_id = i.id) as payments from bw_invoices i where client_ref = $1 order by issued desc', [hh]) });
      if (path === '/api/portal/messages') return json({ threads: await sql('select t.*, s.name as staff_name from bw_threads t left join bw_staff s on s.id = t.staff_id where client_ref = $1 order by updated desc', [hh]) });
      if (path === '/api/portal/thread') {
        const id = clip(u.get('id'), 20);
        const t = (await sql('select * from bw_threads where id = $1 and client_ref = $2', [id, hh]))[0];
        if (!t) return json({ error: 'not found' }, 404);
        await sql('update bw_threads set unread_client = 0 where id = $1', [id]);
        return json({ thread: t, messages: await sql('select * from bw_messages where thread_id = $1 order by sent', [id]) });
      }
      if (path === '/api/portal/appointments') return json({ appointments: await sql('select a.*, s.name as staff_name from bw_appointments a left join bw_staff s on s.id = a.staff_id where client_ref = $1 order by starts desc limit 40', [hh]) });
      if (path === '/api/portal/organizer') {
        const e = (await sql(`select id, tax_year from bw_engagements where client_ref = $1 and form = '1040' order by tax_year desc limit 1`, [hh]))[0];
        const docs = e ? await sql('select id, name, form, status, received from bw_documents where engagement_id = $1 order by status desc, name', [e.id]) : [];
        const h = (await sql('select tags, filing_status, dependents from bw_households where id = $1', [hh]))[0];
        const items = h ? await sql('select * from bw_checklist_items where situation = any($1) order by situation, sort', [['basics', ...(h.dependents ? ['kids'] : []), ...h.tags.map((t: string) => ({ rental: 'rental', 'self-employed': 'self', crypto: 'crypto', retired: 'retirement', education: 'education', HSA: 'hsa', 'equity comp': 'investments' } as Record<string, string>)[t]).filter(Boolean)]]) : [];
        return json({ taxYear: e?.tax_year ?? 2025, engagement: e?.id ?? null, documents: docs, checklist: items });
      }
      return json({ error: 'not found' }, 404);
    }

    // ---- staff CRM
    if (path.startsWith('/api/staff/')) {
      const me = tokens.read(req, 'staff');
      if (!me) return json({ error: 'sign in first' }, 401);
      if (path === '/api/staff/me') return json({ staff: (await sql('select id, name, title, credentials, role, office, avatar from bw_staff where id = $1', [me]))[0] });
      if (path === '/api/staff/staff') return json({ staff: await sql('select id, name, title, credentials, role, office, avatar from bw_staff order by sort') });
      if (path === '/api/staff/dashboard') return json(await dashboard(me));
      if (path === '/api/staff/clients') return json(await clientList(u));
      if (path === '/api/staff/client') {
        const id = clip(u.get('id'), 12).toUpperCase();
        const c = /^(HH|BZ)-\d{5}$/.test(id) ? await clientDetail(id) : null;
        if (!c) return json({ error: 'not found' }, 404);
        audit(me, 'staff', 'client.viewed', c.kind, id, null, ip);
        return json(c);
      }
      if (path === '/api/staff/find') {
        // "open the Garcia household": the best few matches by name, for the copilot and the quick search
        const q = clip(u.get('q'), 80).trim().replace(/\b(the|household|family|business|company|client)\b/gi, '').trim();
        if (q.length < 2) return json({ matches: [] });
        return json({ matches: await sql(`select id, kind, name, city, score from (
            select h.id, 'household' as kind, h.name, h.city, case when lower(h.name) = lower($1 || ' household') then 3 when h.name ilike $1 || '%' then 2 else 1 end as score from bw_households h
              where h.name ilike '%' || $1 || '%' or exists (select 1 from bw_clients c where c.household_id = h.id and c.full_name ilike '%' || $1 || '%')
            union all select b.id, 'business', b.name, b.city, case when lower(b.name) = lower($1) then 3 when b.name ilike $1 || '%' then 2 else 1 end from bw_businesses b where b.name ilike '%' || $1 || '%') x
            order by score desc, name limit 8`, [q]) });
      }
      if (path === '/api/staff/engagements') {
        const p = pageOf(u);
        const rows = await sql(`select e.*, s.name as preparer_name, (select count(*) from bw_documents d where d.engagement_id = e.id and d.status = 'requested')::int as missing, count(*) over() as total
          from bw_engagements e left join bw_staff s on s.id = e.preparer
          where ($1 = '' or e.stage = $1) and ($2 = 0 or e.tax_year = $2) and ($3 = '' or e.preparer = $3) and ($4 = '' or e.client_name ilike '%'||$4||'%') and ($5 = '' or e.form = $5)
            and ($6::int = 0 or (e.due <= $7::date + $6::int and e.stage not in ('efiled','accepted')))
          order by ${u.get('sort') === 'updated' ? 'e.updated desc' : 'e.due, e.id'} limit $8 offset $9`,
          [clip(u.get('stage'), 20), int(u.get('year'), 0, 0, 2030), clip(u.get('preparer'), 10), clip(u.get('q'), 60), clip(u.get('form'), 12), int(u.get('due_within'), 0, 0, 365), today(), p.size, p.offset]);
        return json(paged(rows, p));
      }
      if (path === '/api/staff/pipeline') {
        const year = int(u.get('year'), 2025, 2020, 2030), prep = clip(u.get('preparer'), 10);
        const cols = await Promise.all(STAGES.map(async s => {
          const rows = await sql(`select e.id, e.client_ref, e.client_name, e.form, e.due, e.priority, e.updated, e.preparer, (select count(*) from bw_documents d where d.engagement_id = e.id and d.status = 'requested')::int as missing, count(*) over() as total
            from bw_engagements e where e.tax_year = $1 and e.stage = $2 and ($3 = '' or e.preparer = $3) order by e.due, e.id limit 30`, [year, s, prep]);
          return { stage: s, label: STAGE_LABEL[s], total: rows.length ? Number(rows[0].total) : 0, cards: rows.map(({ total: _t, ...r }: any) => r) };
        }));
        return json({ year, columns: cols });
      }
      if (path === '/api/staff/queue') {
        const p = pageOf(u, 50);
        return json(paged(await sql(`select e.id, e.client_ref, e.client_name, e.form, e.tax_year, e.stage, e.due, e.priority, e.preparer, s.name as preparer_name, ($1::date - e.due) as days_late,
            (select count(*) from bw_documents d where d.engagement_id = e.id and d.status = 'requested')::int as missing, count(*) over() as total
          from bw_engagements e left join bw_staff s on s.id = e.preparer where e.stage not in ('efiled','accepted') and ($2 = '' or e.preparer = $2) and e.due <= $1::date + $3::int
          order by e.due, e.priority = 'high' desc limit $4 offset $5`, [today(), clip(u.get('preparer'), 10), int(u.get('days'), 60, 0, 400), p.size, p.offset]), p));
      }
      if (path === '/api/staff/documents') {
        const p = pageOf(u);
        return json(paged(await sql(`select d.*, e.client_name, e.form as engagement_form, e.tax_year, ($3::date - d.requested) as days_waiting, count(*) over() as total from bw_documents d join bw_engagements e on e.id = d.engagement_id
          where ($1 = '' or d.status = $1) and ($2 = '' or e.client_name ilike '%'||$2||'%' or d.name ilike '%'||$2||'%') order by d.status = 'requested' desc, d.requested limit $4 offset $5`,
          [clip(u.get('status'), 12), clip(u.get('q'), 60), today(), p.size, p.offset]), p));
      }
      if (path === '/api/staff/notices') {
        const p = pageOf(u);
        const within = int(u.get('due_within'), 0, 0, 365);
        return json(paged(await sql(`select n.*, s.name as assigned_name, (n.response_due - $1::date) as days_left, count(*) over() as total from bw_notices n left join bw_staff s on s.id = n.assigned
          where ($2 = '' or n.status = $2 or ($2 = 'open' and n.status not in ('resolved','response sent'))) and ($3::int = 0 or (n.response_due between $1::date and $1::date + $3::int and n.status not in ('resolved','response sent')))
            and ($4 = '' or n.code = upper($4) or n.client_name ilike '%'||$4||'%') order by n.status = 'resolved', n.response_due limit $5 offset $6`,
          [today(), clip(u.get('status'), 20), within, clip(u.get('q'), 40), p.size, p.offset]), p));
      }
      if (path === '/api/staff/calendar') {
        const from = /^\d{4}-\d{2}-\d{2}$/.test(u.get('from') ?? '') ? u.get('from')! : today();
        const days = int(u.get('days'), 7, 1, 31);
        return json({ from, days, appointments: await sql(`select a.*, s.name as staff_name from bw_appointments a left join bw_staff s on s.id = a.staff_id where starts >= $1::date and starts < $1::date + $2::int and ($3 = '' or staff_id = $3) and status <> 'cancelled' order by starts limit 1000`, [from, days, clip(u.get('staff'), 10)]) });
      }
      if (path === '/api/staff/invoices') {
        const p = pageOf(u);
        return json(paged(await sql(`select i.*, count(*) over() as total from bw_invoices i where ($1 = '' or status = $1) and ($2 = '' or client_name ilike '%'||$2||'%' or number = $2) order by issued desc, number desc limit $3 offset $4`,
          [clip(u.get('status'), 12), clip(u.get('q'), 60), p.size, p.offset]), p));
      }
      if (path === '/api/staff/threads') {
        const p = pageOf(u);
        return json(paged(await sql(`select t.*, s.name as staff_name, count(*) over() as total from bw_threads t left join bw_staff s on s.id = t.staff_id where ($1 = '' or t.staff_id = $1) and ($2 = 0 or t.unread_staff > 0) and ($3 = '' or t.client_name ilike '%'||$3||'%' or t.subject ilike '%'||$3||'%') order by updated desc limit $4 offset $5`,
          [u.get('mine') === '1' ? me : '', u.get('unread') === '1' ? 1 : 0, clip(u.get('q'), 60), p.size, p.offset]), p));
      }
      if (path === '/api/staff/thread') {
        const id = clip(u.get('id'), 20);
        const t = (await sql('select * from bw_threads where id = $1', [id]))[0];
        if (!t) return json({ error: 'not found' }, 404);
        if (t.staff_id === me) await sql('update bw_threads set unread_staff = 0 where id = $1', [id]);
        return json({ thread: t, messages: await sql('select * from bw_messages where thread_id = $1 order by sent', [id]) });
      }
      if (path === '/api/staff/tasks') {
        const p = pageOf(u);
        return json(paged(await sql(`select t.*, s.name as assignee_name, count(*) over() as total from bw_tasks t left join bw_staff s on s.id = t.assignee where ($1 = '' or assignee = $1) and ($2 = '' or status = $2 or ($2 = 'open' and status <> 'done')) order by status = 'done', due limit $3 offset $4`,
          [u.get('assignee') === 'me' ? me : clip(u.get('assignee'), 10), clip(u.get('status'), 12), p.size, p.offset]), p));
      }
      if (path === '/api/staff/submissions') {
        const p = pageOf(u);
        return json(paged(await sql(`select id, form, ref, created, status, client_ref, data, count(*) over() as total from bw_submissions where ($1 = '' or form = $1) order by created desc limit $2 offset $3`, [clip(u.get('form'), 20), p.size, p.offset]), p));
      }
      if (path === '/api/staff/reports') return json(await reports());
      if (path === '/api/staff/audit') {
        const p = pageOf(u, 50);
        return json(paged(await sql(`select a.*, s.name as actor_name, count(*) over() as total from bw_audit a left join bw_staff s on s.id = a.actor where ($1 = '' or a.actor = $1) and ($2 = '' or a.entity = $2) and ($3 = '' or a.action like $3 || '%') order by a.at desc limit $4 offset $5`,
          [clip(u.get('actor'), 20), clip(u.get('entity'), 20), clip(u.get('action'), 30), p.size, p.offset]), p));
      }
      return json({ error: 'not found' }, 404);
    }
    return null;
  }

  async function post(path: string, b: any, req: Request, ip: string): Promise<Response | null> {
    if (path === '/api/forms/draft') {
      const form = clip(b.form, 30);
      if (!FORMS[form] && !STAFF_FORMS[form]) return json({ error: 'unknown form' }, 404);
      const id = /^[a-f0-9-]{36}$/.test(String(b.id ?? '')) ? String(b.id) : crypto.randomUUID();
      const data = Object.fromEntries(Object.entries(b.data ?? {}).slice(0, 40).map(([k, v]) => [clip(k, 40), Array.isArray(v) ? v.slice(0, 20).map(x => clip(x, 200)) : clip(v, 4000)]));
      await sql('insert into bw_drafts (id, form, data, updated) values ($1, $2, $3, now()) on conflict (id) do update set data = excluded.data, updated = now()', [id, form, JSON.stringify(data)]);
      return json({ ok: true, id });
    }
    if (path === '/api/forms/submit') {
      if (limits.hit(`submit:${ip}`, 12, 600_000)) return json({ error: 'Too many submissions from this connection. Try again in a few minutes.' }, 429);
      return submit(clip(b.form, 30), b.data ?? {}, ip, tokens.read(req, 'portal'));
    }
    if (path === '/api/newsletter') {
      if (limits.hit(`submit:${ip}`, 12, 600_000)) return json({ error: 'Too many requests. Try again in a few minutes.' }, 429);
      const email = clip(b.email, 120).trim().toLowerCase();
      if (!EMAIL.test(email)) return json({ error: 'invalid', errors: { email: 'Enter a valid email address, like name@example.com.' } }, 422);
      const topics = (Array.isArray(b.topics) ? b.topics : []).map((t: unknown) => clip(t, 30)).filter((t: string) => ['deadlines', 'individuals', 'business', 'payroll', 'news'].includes(t));
      await sql('insert into bw_newsletter (email, topics, ip) values ($1, $2, $3) on conflict (email) do update set topics = excluded.topics', [email, topics, ip]);
      await audit('visitor', 'visitor', 'newsletter.subscribed', 'newsletter', null, null, ip);
      return json({ ok: true, message: "You're on the list. Demo site: no email will ever be sent." });
    }
    if (path === '/api/portal/session') {
      let hh = '';
      let client = '';
      if (b.call) { client = d.verifiedClient(clip(b.call, 64)); if (!client) return json({ error: 'This call is not verified.' }, 403); }
      else if (b.demo) client = 'BW-10042';
      else return json({ error: 'Verify on a call, or use the demo login.' }, 400);
      hh = (await sql('select household_id from bw_clients where id = $1', [client]))[0]?.household_id ?? '';
      if (!hh) return json({ error: 'not found' }, 404);
      const who = (await sql('select first_name from bw_clients where id = $1', [client]))[0];
      await audit(client, 'client', b.call ? 'portal.login.verified-call' : 'portal.login.demo', 'household', hh, null, ip);
      return json({ ok: true, token: tokens.sign('portal', hh), household: hh, firstName: who?.first_name ?? '', sample: true });
    }
    if (path === '/api/staff/session') {
      const id = /^st-[a-z]{3}$/.test(String(b.staff ?? '')) ? String(b.staff) : 'st-pra';
      const s = (await sql('select id, name, title from bw_staff where id = $1', [id]))[0];
      if (!s) return json({ error: 'not found' }, 404);
      await audit(id, 'staff', 'staff.login.demo', 'staff', id, null, ip);
      return json({ ok: true, token: tokens.sign('staff', id), staff: s });
    }
    if (path === '/api/portal/message') {
      const hh = tokens.read(req, 'portal');
      if (!hh) return json({ error: 'sign in first' }, 401);
      const v = validate(STAFF_FORMS.message, b, today());
      if (!v.ok) return json({ error: 'invalid', errors: v.errors }, 422);
      if (!v.data.thread && !v.data.subject) return json({ error: 'invalid', errors: { subject: 'Add a subject for a new message.' } }, 422);
      const head = (await sql(`select c.id, c.full_name, h.preparer from bw_households h join bw_clients c on c.id = h.primary_client where h.id = $1`, [hh]))[0];
      let thread = String(v.data.thread || '');
      if (thread && !(await sql('select 1 from bw_threads where id = $1 and client_ref = $2', [thread, hh])).length) return json({ error: 'not found' }, 404);
      if (!thread) {
        thread = `TH-${Date.now()}`;
        await sql(`insert into bw_threads (id, client_ref, client_name, subject, staff_id, updated, status, unread_staff, unread_client) select $1, $2, name, $3, preparer, now(), 'open', 1, 0 from bw_households where id = $2`, [thread, hh, v.data.subject]);
      } else await sql(`update bw_threads set updated = now(), unread_staff = unread_staff + 1, status = 'open' where id = $1`, [thread]);
      await sql('insert into bw_messages (id, thread_id, sender, sender_name, sent, body) values ($1,$2,$3,$4,now(),$5)', [`MS-${crypto.randomUUID().slice(0, 12)}`, thread, head.id, head.full_name, v.data.body]);
      await audit(head.id, 'client', 'message.sent', 'thread', thread, null, ip);
      return json({ ok: true, thread });
    }
    if (path.startsWith('/api/staff/')) {
      const me = tokens.read(req, 'staff');
      if (!me) return json({ error: 'sign in first' }, 401);
      if (limits.hit(`staffw:${me}`, 60, 60_000)) return json({ error: 'slow down' }, 429);
      const form = path.slice('/api/staff/'.length);
      const rules = STAFF_FORMS[form];
      if (!rules) return json({ error: 'not found' }, 404);
      const v = validate(rules, b, '2099-12-31');
      if (!v.ok) return json({ error: 'invalid', errors: v.errors }, 422);
      const x = v.data as Record<string, any>;
      if (form === 'engagement') {
        const c = (await sql(`select name from bw_households where id = $1 union all select name from bw_businesses where id = $1`, [x.client_ref]))[0];
        if (!c) return json({ error: 'invalid', errors: { client_ref: "That client isn't in the client list." } }, 422);
        const id = `EN-${Date.now().toString().slice(-7)}`;
        await sql(`insert into bw_engagements (id, client_kind, client_ref, client_name, kind, form, tax_year, stage, preparer, reviewer, due, extended, fee_cents, opened, updated, priority, notes)
          values ($1, $2, $3, $4, $5, $6, $7, 'organizer_sent', $8, $9, $10, false, $11, current_date, current_date, 'normal', $12)`,
          [id, x.client_ref.startsWith('BZ') ? 'business' : 'household', x.client_ref, c.name, x.kind, x.form, Number(x.tax_year), x.preparer, x.reviewer || null, x.due, Math.round(Number(x.fee) * 100), x.notes || null]);
        await audit(me, 'staff', 'engagement.created', 'engagement', id, `${x.form} ${x.tax_year} for ${x.client_ref}`, ip);
        return json({ ok: true, id, message: `Engagement ${id} created.` });
      }
      if (form === 'task') {
        const id = `TK-${Date.now().toString().slice(-8)}`;
        const c = x.client_ref ? (await sql(`select name from bw_households where id = $1 union all select name from bw_businesses where id = $1`, [x.client_ref]))[0] : null;
        await sql(`insert into bw_tasks (id, title, assignee, client_ref, client_name, due, status, priority, created) values ($1,$2,$3,$4,$5,$6,'open',$7,current_date)`, [id, x.title, x.assignee, x.client_ref || null, c?.name ?? null, x.due, x.priority]);
        await audit(me, 'staff', 'task.created', 'task', id, x.title, ip);
        return json({ ok: true, id });
      }
      if (form === 'task-status') { await sql('update bw_tasks set status = $2 where id = $1', [x.id, x.status]); await audit(me, 'staff', 'task.status', 'task', x.id, x.status, ip); return json({ ok: true }); }
      if (form === 'stage') {
        const r = await sql(`update bw_engagements set stage = $2, updated = current_date, efiled = case when $2 = 'efiled' then current_date else efiled end, accepted = case when $2 = 'accepted' then current_date else accepted end where id = $1 returning id`, [x.id, x.stage]);
        if (!r.length) return json({ error: 'not found' }, 404);
        await audit(me, 'staff', 'engagement.stage', 'engagement', x.id, STAGE_LABEL[x.stage], ip);
        return json({ ok: true });
      }
      if (form === 'doc-request') {
        const e = (await sql('select client_ref from bw_engagements where id = $1', [x.engagement_id]))[0];
        if (!e) return json({ error: 'not found' }, 404);
        const id = `DC-${Date.now().toString().slice(-8)}`;
        await sql(`insert into bw_documents (id, engagement_id, client_ref, name, form, status, requested) values ($1,$2,$3,$4,$5,'requested',current_date)`, [id, x.engagement_id, e.client_ref, x.name, x.form]);
        await audit(me, 'staff', 'document.requested', 'document', id, x.name, ip);
        return json({ ok: true, id });
      }
      if (form === 'message') {
        let thread = String(x.thread || '');
        const s = (await sql('select name from bw_staff where id = $1', [me]))[0];
        if (!thread) {
          if (!x.client_ref || !x.subject) return json({ error: 'invalid', errors: { subject: 'A new message needs a client and a subject.' } }, 422);
          thread = `TH-${Date.now()}`;
          await sql(`insert into bw_threads (id, client_ref, client_name, subject, staff_id, updated, status, unread_staff, unread_client)
            select $1, $2, name, $3, $4, now(), 'open', 0, 1 from (select name from bw_households where id = $2 union all select name from bw_businesses where id = $2) c`, [thread, x.client_ref, x.subject, me]);
        } else await sql(`update bw_threads set updated = now(), unread_client = unread_client + 1 where id = $1`, [thread]);
        await sql('insert into bw_messages (id, thread_id, sender, sender_name, sent, body) values ($1,$2,$3,$4,now(),$5)', [`MS-${crypto.randomUUID().slice(0, 12)}`, thread, me, s?.name ?? me, x.body]);
        await audit(me, 'staff', 'message.sent', 'thread', thread, null, ip);
        return json({ ok: true, thread });
      }
    }
    return null;
  }

  async function uploadFile(req: Request, ip: string): Promise<Response> {
    if (limits.hit(`upload:${ip}`, 20, 600_000)) return json({ error: 'Too many uploads. Try again in a few minutes.' }, 429);
    const u = new URL(req.url);
    const name = clip(u.searchParams.get('name'), 120).replace(/[^\w .()-]/g, '_') || 'upload';
    const form = clip(u.searchParams.get('form'), 30);
    const ext = name.toLowerCase().split('.').pop() ?? '';
    if (!['pdf', 'jpg', 'jpeg', 'png', 'heic', 'txt', 'csv', 'docx', 'xlsx'].includes(ext)) return json({ error: 'invalid', errors: { file: 'Upload a PDF, photo (JPG, PNG, HEIC), or a Word, Excel, CSV or text file.' } }, 422);
    const buf = Buffer.from(await req.arrayBuffer());
    if (!buf.length) return json({ error: 'invalid', errors: { file: 'That file is empty.' } }, 422);
    if (buf.length > 8 * 1024 * 1024) return json({ error: 'invalid', errors: { file: 'Files must be 8 MB or smaller.' } }, 413);
    const hh = tokens.read(req, 'portal');
    const fileId = await d.upload(`bw-upload-${crypto.randomUUID()}-${name}`, 'application/octet-stream', buf, { form, kind: ext, sample: 'true' });
    const id = `UP-${crypto.randomBytes(6).toString('hex')}`;
    await sql('insert into bw_uploads (id, file_id, name, size_kb, kind, form, client_ref) values ($1,$2,$3,$4,$5,$6,$7)', [id, fileId, name, Math.ceil(buf.length / 1024), ext, form || null, hh]);
    const docId = clip(u.searchParams.get('document'), 20);
    if (hh && /^DC-\d+$/.test(docId)) await sql(`update bw_documents set status = 'received', received = current_date, file_id = $3, size_kb = $4, source = 'portal upload' where id = $1 and client_ref = $2`, [docId, hh, fileId, Math.ceil(buf.length / 1024)]);
    await audit(hh ?? 'visitor', hh ? 'client' : 'visitor', 'file.uploaded', 'upload', id, `${name} (${Math.ceil(buf.length / 1024)} KB)`, ip);
    return json({ ok: true, id, name, sizeKb: Math.ceil(buf.length / 1024) });
  }

  return {
    owns: (path: string) => /^\/api\/(site|forms|slots|portal|staff|files|newsletter)(\/|$)/.test(path),
    async handle(req: Request, ip: string): Promise<Response> {
      const url = new URL(req.url);
      const path = url.pathname;
      try {
        if (req.method === 'GET') {
          if (limits.hit(`read:${ip}`, 240, 60_000)) return json({ error: 'slow down' }, 429);
          return (await get(path, url.searchParams, req, ip)) ?? json({ error: 'not found' }, 404);
        }
        if (req.method !== 'POST') return json({ error: 'GET or POST only' }, 405);
        if (limits.hit(`write:${ip}`, 30, 60_000)) return json({ error: 'slow down' }, 429);
        if (path === '/api/files') return await uploadFile(req, ip);
        const raw = await req.text();
        if (raw.length > 64_000) return json({ error: 'too large' }, 413);
        let b: any;
        try { b = JSON.parse(raw || '{}'); } catch { return json({ error: 'bad json' }, 400); }
        return (await post(path, b, req, ip)) ?? json({ error: 'not found' }, 404);
      } catch (e) {
        log(`${path} failed: ${(e as Error).message}`);
        return json({ error: 'The practice database is unavailable right now. Please try again.' }, 503);
      }
    },
  };
}
