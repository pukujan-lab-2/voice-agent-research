// Declared record lookups: a business says, in its config, which questions about its own tables the copilot may answer
// (order status by order number, appointment times for the caller, the price of a product), and code runs exactly those.
//   - The model never writes SQL. It picks a lookup by name and supplies typed values; code checks each value against the
//     declaration and binds it as a parameter of a statement built only from the declaration.
//   - Only the declared fields come back. The spoken line is composed by code from those fields, not by the model.
//   - A business's rows only: a lookup can be bound to a business column that code always adds, and a lookup about a person
//     only ever returns that caller's own rows, after the caller has been verified (code-side, not by the model).
//   - Each lookup carries a risk score from 1 to 100 (decision 0011): from RISK_LOCK up it needs a recorded yes first, from
//     RISK_PERSON up a person must approve it and the copilot never runs it.
export const RISK_LOCK = 56;    // same numbers as RISK_BANDS in desk.ts (a test keeps them equal)
export const RISK_PERSON = 91;
export const LOOKUP_HINT = `
- For an order, appointment, price or other record you have a lookup_ tool for, call it with the values the caller gave. Code runs it and says the result; never state a record yourself. If it says to verify the caller first, tell them that.`;
export const DEFAULT_RISK = { public: 5, person: 45 } as const;
export const MAX_ROWS = 5;
export const MAX_FIELDS = 12;
export const MAX_VALUE_CHARS = 200;

export type ParamType = 'string' | 'integer' | 'number' | 'date' | 'enum';
export type LookupParam = { name: string; type: ParamType; description?: string; values?: string[]; pattern?: string; min?: number; max?: number; upper?: boolean };
export type LookupField = { column: string; label: string };
export type LookupDecl = {
  id: string;                         // the tool is lookup_<id>
  description: string;
  table: string;
  // Each parameter is compared for equality with a column of the table.
  params: (LookupParam & { column: string })[];
  fields: LookupField[];              // the only columns that may be read out
  about?: 'person' | 'none';          // 'person': needs a verified caller and returns only that caller's rows
  ownerColumn?: string;               // the column holding the verified caller's id (required when about is 'person')
  risk?: number;
  limit?: number;
  say?: string;                       // how a row is spoken: "Order {order_number} is {status}." (labels in braces); default lists label: value
};
export type BusinessLookups = {
  business: string;
  businessColumn?: string;            // when the tables are shared between businesses: always `and <column> = <business>`
  lookups: LookupDecl[];
};

export type Caller = { verified: boolean; clientId?: string };
export type Sql = (text: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
export type LookupResult =
  | { status: 'ok'; text: string; rows: Record<string, string>[]; risk: number; sql: string }
  | { status: 'not_found'; text: string; risk: number }
  | { status: 'needs_verification' | 'needs_confirmation' | 'needs_person' | 'bad_input' | 'unknown_lookup' | 'error'; text: string; risk: number };

const IDENT = /^[a-z_][a-z0-9_]{0,62}$/;
const ID = /^[a-z][a-z0-9_]{0,40}$/;
const BUSINESS = /^[a-z0-9][a-z0-9-]{1,39}$/;
const quote = (ident: string) => `"${ident}"`;

export class DeclarationError extends Error {}
function must(ok: unknown, msg: string): asserts ok { if (!ok) throw new DeclarationError(msg); }

// Checks a business's declarations once, when they are loaded, so nothing odd ever reaches a statement.
export function validate(b: BusinessLookups): BusinessLookups {
  must(BUSINESS.test(b.business), `bad business id: ${b.business}`);
  must(!b.businessColumn || IDENT.test(b.businessColumn), `bad business column: ${b.businessColumn}`);
  const seen = new Set<string>();
  for (const d of b.lookups) {
    must(ID.test(d.id) && !seen.has(d.id), `bad or repeated lookup id: ${d.id}`);
    seen.add(d.id);
    must(IDENT.test(d.table), `${d.id}: bad table name`);
    must(d.fields.length >= 1 && d.fields.length <= MAX_FIELDS, `${d.id}: declare 1-${MAX_FIELDS} fields`);
    for (const f of d.fields) must(IDENT.test(f.column) && f.label.trim() && f.label.length <= 40 && !/[{}]/.test(f.label), `${d.id}: bad field ${f.column}`);
    must(new Set(d.fields.map(f => f.label)).size === d.fields.length, `${d.id}: field labels must differ`);
    const names = new Set<string>();
    for (const p of d.params) {
      must(ID.test(p.name) && !names.has(p.name), `${d.id}: bad or repeated parameter ${p.name}`);
      names.add(p.name);
      must(IDENT.test(p.column), `${d.id}: bad column for ${p.name}`);
      must(['string', 'integer', 'number', 'date', 'enum'].includes(p.type), `${d.id}: bad type for ${p.name}`);
      must(p.type !== 'enum' || (p.values?.length ?? 0) > 0, `${d.id}: enum ${p.name} needs values`);
      if (p.pattern) { try { new RegExp(p.pattern); } catch { throw new DeclarationError(`${d.id}: bad pattern for ${p.name}`); } }
    }
    must(d.params.length >= 1 || d.about === 'person', `${d.id}: a lookup with no parameter must be about the caller`);
    must(d.about !== 'person' || (d.ownerColumn && IDENT.test(d.ownerColumn)), `${d.id}: a lookup about a person needs ownerColumn`);
    must(d.about === 'person' || !d.ownerColumn, `${d.id}: ownerColumn only makes sense for a lookup about a person`);
    const risk = d.risk ?? DEFAULT_RISK[d.about === 'person' ? 'person' : 'public'];
    must(Number.isInteger(risk) && risk >= 1 && risk <= 100, `${d.id}: risk must be 1-100`);
    must(d.about !== 'person' || risk >= DEFAULT_RISK.person, `${d.id}: a lookup about a person cannot score below ${DEFAULT_RISK.person}`);
    must(!d.limit || (d.limit >= 1 && d.limit <= MAX_ROWS), `${d.id}: limit is 1-${MAX_ROWS}`);
  }
  return b;
}

// The tool list for a business: one function per declaration, parameters typed from it.
export function lookupTools(b: BusinessLookups): unknown[] {
  return b.lookups.map(d => ({
    type: 'function',
    function: {
      name: `lookup_${d.id}`,
      description: d.description + (d.about === 'person' ? ' Only for a verified caller, and only about their own records.' : ''),
      parameters: {
        type: 'object',
        properties: Object.fromEntries(d.params.map(p => [p.name, { type: p.type === 'enum' ? 'string' : p.type === 'date' ? 'string' : p.type, ...(p.type === 'enum' ? { enum: p.values } : {}), ...(p.description ? { description: p.description } : {}) }])),
        required: d.params.map(p => p.name),
      },
    },
  }));
}

function coerce(p: LookupParam, raw: unknown): string | number | null {
  if (p.type === 'integer' || p.type === 'number') {
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^-?\d{1,15}(\.\d{1,6})?$/.test(raw.trim()) ? Number(raw) : NaN;
    if (!Number.isFinite(n) || (p.type === 'integer' && !Number.isInteger(n))) return null;
    if ((p.min !== undefined && n < p.min) || (p.max !== undefined && n > p.max)) return null;
    return n;
  }
  if (typeof raw !== 'string') return null; // objects, arrays, booleans, null: never a value
  let v = raw.replace(/\s+/g, ' ').trim();
  if (!v || v.length > 80) return null;
  if (p.upper) v = v.toUpperCase();
  if (p.type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;
  if (p.type === 'enum') return p.values!.includes(v) ? v : null;
  if (p.pattern && !new RegExp(`^(?:${p.pattern})$`).test(v)) return null;
  return v;
}

const show = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, ' ').trim().slice(0, MAX_VALUE_CHARS);
};

export class Lookups {
  readonly spec: BusinessLookups;
  private sql: Sql;
  constructor(spec: BusinessLookups, sql: Sql) {
    this.spec = validate(spec);
    this.sql = sql;
  }

  get tools(): unknown[] { return lookupTools(this.spec); }
  riskOf(id: string): number | undefined {
    const d = this.spec.lookups.find(x => x.id === id);
    return d && (d.risk ?? DEFAULT_RISK[d.about === 'person' ? 'person' : 'public']);
  }

  // The statement a lookup runs. It depends on the declaration only, never on the values the model supplied.
  statement(d: LookupDecl): string {
    const where = d.params.map((p, i) => `${quote(p.column)} = $${i + 1}`);
    let n = d.params.length;
    if (this.spec.businessColumn) where.push(`${quote(this.spec.businessColumn)} = $${++n}`);
    if (d.about === 'person') where.push(`${quote(d.ownerColumn!)} = $${++n}`);
    return `select ${d.fields.map(f => quote(f.column)).join(', ')} from ${quote(d.table)} where ${where.join(' and ')} limit ${d.limit ?? MAX_ROWS}`;
  }

  // name: the tool name the model called (lookup_<id>). confirmed: the caller has given a recorded yes to this lookup.
  async run(name: string, args: Record<string, unknown>, caller: Caller, confirmed = false): Promise<LookupResult> {
    const d = this.spec.lookups.find(x => `lookup_${x.id}` === name);
    if (!d) return { status: 'unknown_lookup', text: "I can't look that up.", risk: 0 };
    const risk = d.risk ?? DEFAULT_RISK[d.about === 'person' ? 'person' : 'public'];
    if (d.about === 'person' && (!caller.verified || !caller.clientId)) {
      return { status: 'needs_verification', text: "I can only look that up once I've checked who you are. Would you like to do that now?", risk };
    }
    if (risk >= RISK_PERSON) return { status: 'needs_person', text: 'A person has to look that up for you. I can pass you to one of our team.', risk };
    if (risk >= RISK_LOCK && !confirmed) return { status: 'needs_confirmation', text: 'Shall I look that up for you? Please say yes to go ahead.', risk };
    const values: unknown[] = [];
    for (const p of d.params) {
      const v = coerce(p, args[p.name]);
      if (v === null) return { status: 'bad_input', text: `That doesn't look like a valid ${p.description ?? p.name.replace(/_/g, ' ')}. Could you say it again?`, risk };
      values.push(v);
    }
    if (this.spec.businessColumn) values.push(this.spec.business);
    if (d.about === 'person') values.push(caller.clientId);
    const text = this.statement(d);
    let rows: Record<string, unknown>[];
    try { rows = (await this.sql(text, values)).rows; } catch { return { status: 'error', text: "I couldn't look that up just now.", risk }; }
    if (!rows.length) return { status: 'not_found', text: "I couldn't find a record for that.", risk };
    // Only the declared fields, whatever the database sent back.
    const out = rows.slice(0, d.limit ?? MAX_ROWS).map(r => Object.fromEntries(d.fields.map(f => [f.label, show(r[f.column])])));
    return { status: 'ok', rows: out, text: out.map(r => speak(d, r)).join(' '), risk, sql: text };
  }
}

function speak(d: LookupDecl, row: Record<string, string>): string {
  if (d.say) return d.say.replace(/\{([^{}]+)\}/g, (_m, label: string) => row[label] ?? '');
  return `${d.fields.map(f => `${f.label}: ${row[f.label] || 'none'}`).join('; ')}.`;
}
