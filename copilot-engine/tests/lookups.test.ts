// Declared record lookups: typed values, parameterized SQL built from the declaration, declared fields only, a business's
// own rows, a verified caller for anything about a person, and a risk score that gates the rest.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { DeclarationError, DEFAULT_RISK, Lookups, RISK_LOCK, RISK_PERSON, lookupTools, validate, type BusinessLookups, type Caller, type LookupDecl, type Sql } from '../src/lookups.ts';
import { RISK_BANDS } from '../src/desk.ts';

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    create table orders (order_number text, business_id text, customer_id text, status text, eta text, internal_note text, card_last4 text);
    create table appointments (id integer primary key, business_id text, customer_id text, starts_at text, staff text, private_note text);
    create table prices (sku text, business_id text, name text, price text, cost text);
    create table secrets (business_id text, token text);
    insert into orders values ('A-1001','acme','c1','shipped','2026-11-04','VIP, refund risk','4242');
    insert into orders values ('A-1002','acme','c2','packing','2026-11-06','late payer','1111');
    insert into orders values ('A-1001','globex','g1','delivered','2026-10-01','globex only','9999');
    insert into appointments values (1,'acme','c1','2026-11-05 10:00','Dana','owes money'), (2,'acme','c1','2026-11-12 14:30','Eli',''), (3,'acme','c2','2026-11-06 09:00','Dana','');
    insert into prices values ('W1','acme','Blue widget','19.99','4.10'), ('W1','globex','Globex widget','99.00','50');
    insert into secrets values ('acme','TOP-SECRET');
  `);
  const calls: { text: string; params: unknown[] }[] = [];
  const sql: Sql = async (text, params) => {
    calls.push({ text, params });
    return { rows: db.prepare(text.replace(/\$(\d+)/g, '?$1')).all(...(params as never[])) as Record<string, unknown>[] };
  };
  return { db, sql, calls };
}

const orderStatus: LookupDecl = {
  id: 'order_status', description: 'Status of an order by its number.', table: 'orders', about: 'person', ownerColumn: 'customer_id',
  params: [{ name: 'order_number', column: 'order_number', type: 'string', pattern: '[A-Za-z0-9-]{4,16}', upper: true, description: 'order number' }],
  fields: [{ column: 'status', label: 'Status' }, { column: 'eta', label: 'Expected' }], say: 'Order {Status}, expected {Expected}.',
};
const myAppointments: LookupDecl = {
  id: 'my_appointments', description: "The caller's upcoming appointments.", table: 'appointments', about: 'person', ownerColumn: 'customer_id', params: [], limit: 3,
  fields: [{ column: 'starts_at', label: 'When' }, { column: 'staff', label: 'With' }],
};
const price: LookupDecl = {
  id: 'price', description: 'Price of a product by name.', table: 'prices', about: 'none',
  params: [{ name: 'product', column: 'name', type: 'string', description: 'product name' }],
  fields: [{ column: 'price', label: 'Price' }], say: 'It costs {Price} dollars.',
};
const acme = (extra: Partial<BusinessLookups> = {}): BusinessLookups => ({ business: 'acme', businessColumn: 'business_id', lookups: [orderStatus, myAppointments, price], ...extra });
const c1: Caller = { verified: true, clientId: 'c1' };
const stranger: Caller = { verified: false };

test('only the declared fields come back, and the sentence is composed by code', async () => {
  const { sql } = database();
  const r = await new Lookups(acme(), sql).run('lookup_order_status', { order_number: 'a-1001' }, c1);
  assert.equal(r.status, 'ok');
  if (r.status !== 'ok') return;
  assert.deepEqual(r.rows, [{ Status: 'shipped', Expected: '2026-11-04' }]);
  assert.equal(r.text, 'Order shipped, expected 2026-11-04.');
  const everything = JSON.stringify(r);
  for (const hidden of ['VIP', 'refund risk', '4242', 'internal_note', 'card_last4']) assert.ok(!everything.includes(hidden), hidden);
});

test('a database that sends back more than was asked for still shows only declared fields', async () => {
  const sloppy: Sql = async () => ({ rows: [{ status: 'shipped', eta: '2026-11-04', card_last4: '4242', internal_note: 'VIP' }] });
  const r = await new Lookups(acme(), sloppy).run('lookup_order_status', { order_number: 'A-1001' }, c1);
  assert.ok(r.status === 'ok' && !JSON.stringify(r.rows).includes('4242') && !r.text.includes('VIP'));
});

test('the statement depends on the declaration only, whatever the model sends', async () => {
  const { sql, calls } = database();
  const l = new Lookups(acme(), sql);
  for (const v of ['A-1001', 'a-1002', 'ZZZ-9999', 'B-0000']) await l.run('lookup_order_status', { order_number: v }, c1);
  assert.equal(new Set(calls.map(c => c.text)).size, 1);
  assert.equal(calls[0].text, 'select "status", "eta" from "orders" where "order_number" = $1 and "business_id" = $2 and "customer_id" = $3 limit 5');
  assert.deepEqual(calls[0].params, ['A-1001', 'acme', 'c1']);
});

test('a lookup about a person is refused for a caller who is not verified, and runs no SQL', async () => {
  const { sql, calls } = database();
  const l = new Lookups(acme(), sql);
  for (const caller of [stranger, { verified: true }, { verified: false, clientId: 'c1' }] as Caller[]) {
    const r = await l.run('lookup_order_status', { order_number: 'A-1001' }, caller);
    assert.equal(r.status, 'needs_verification');
    assert.ok(!/shipped|2026/.test(r.text));
    assert.equal((await l.run('lookup_my_appointments', {}, caller)).status, 'needs_verification');
  }
  assert.equal(calls.length, 0);
  assert.equal((await l.run('lookup_price', { product: 'Blue widget' }, stranger)).status, 'ok', 'a public lookup needs no verification');
});

test("a verified caller sees only their own rows: another client's order, or an id the model supplies, changes nothing", async () => {
  const { sql } = database();
  const l = new Lookups(acme(), sql);
  assert.equal((await l.run('lookup_order_status', { order_number: 'A-1002' }, c1)).status, 'not_found', "c2's order");
  assert.equal((await l.run('lookup_order_status', { order_number: 'A-1002', customer_id: 'c2', clientId: 'c2' }, c1)).status, 'not_found');
  const mine = await l.run('lookup_my_appointments', { customer_id: 'c2' }, c1);
  assert.ok(mine.status === 'ok' && mine.rows.length === 2 && mine.rows.every(r => r.With !== undefined));
  assert.ok(mine.status === 'ok' && !JSON.stringify(mine).includes('owes money'));
  const other = await l.run('lookup_my_appointments', {}, { verified: true, clientId: 'c2' });
  assert.ok(other.status === 'ok' && other.rows.length === 1 && other.rows[0].When === '2026-11-06 09:00');
});

test("one business never reads another's rows, even with the same order number or a business id from the model", async () => {
  const { sql, calls } = database();
  const a = new Lookups(acme(), sql);
  const g = new Lookups({ business: 'globex', businessColumn: 'business_id', lookups: [orderStatus, price] }, sql);
  const ra = await a.run('lookup_order_status', { order_number: 'A-1001' }, c1);
  assert.ok(ra.status === 'ok' && ra.rows[0].Status === 'shipped');
  const rg = await g.run('lookup_order_status', { order_number: 'A-1001' }, { verified: true, clientId: 'g1' });
  assert.ok(rg.status === 'ok' && rg.rows[0].Status === 'delivered');
  assert.equal((await g.run('lookup_order_status', { order_number: 'A-1001' }, c1)).status, 'not_found', "acme's client id means nothing at globex");
  assert.equal((await a.run('lookup_order_status', { order_number: 'A-1001', business_id: 'globex', business: 'globex' }, { verified: true, clientId: 'g1' })).status, 'not_found');
  const p = await a.run('lookup_price', { product: 'Globex widget' }, stranger);
  assert.equal(p.status, 'not_found');
  assert.ok(calls.every(c => c.params.includes('acme') || c.params.includes('globex')));
  assert.equal((await g.run('lookup_my_appointments', {}, c1)).status, 'unknown_lookup', "globex declared no such lookup");
});

test('injection attempts in any parameter change nothing and leak nothing', async () => {
  const { sql, calls, db } = database();
  const l = new Lookups(acme(), sql);
  const hostile = ["' OR '1'='1", "A-1001' OR 1=1 --", "'; DROP TABLE orders; --", 'A-1001; DELETE FROM orders', '" OR ""="', 'x\' UNION SELECT token FROM secrets --',
    '1 OR 1=1', 'A-1001/**/OR/**/1=1', 'A-1001\u0000', 'A-1001\n; select 1', '＇ OR ＇1＇=＇1', '%', '_', '*', 'A-1001 --', '$' + '{business_id}', '$1'];
  for (const v of hostile) {
    const r = await l.run('lookup_order_status', { order_number: v }, c1);
    assert.ok(['bad_input', 'not_found'].includes(r.status), `${v} -> ${r.status}`);
    const p = await l.run('lookup_price', { product: v }, stranger); // no pattern: the value is bound as is
    assert.equal(p.status, 'not_found', `${v} -> ${p.status}`);
    assert.ok(!JSON.stringify(p).includes('TOP-SECRET'));
  }
  // free text reaches the database only as a parameter; the statement text is the same one every time
  assert.equal(new Set(calls.map(c => c.text)).size, 1, 'the price lookup ran each time; the order lookup rejected all of these before SQL');
  assert.ok(calls.every(c => !hostile.filter(h => h.length > 3).some(h => c.text.includes(h))));
  assert.deepEqual(calls.map(c => c.params[0]), hostile.map(h => h.replace(/\s+/g, ' ').trim()), 'bound exactly as sent (whitespace tidied)');
  assert.equal((db.prepare('select count(*) n from orders').get() as { n: number }).n, 3);
  assert.equal((db.prepare('select count(*) n from secrets').get() as { n: number }).n, 1);
  // values that are not plain text or numbers never reach SQL
  const before = calls.length;
  for (const v of [null, undefined, {}, [], ['A-1001'], { $ne: '' }, true, 12345678901234567890n, 'x'.repeat(5000), '']) {
    assert.equal((await l.run('lookup_order_status', { order_number: v as never }, c1)).status, 'bad_input');
  }
  assert.equal(calls.length, before);
});

test('typed parameters: integers, dates, enums and ranges are checked before any SQL', async () => {
  const { sql, calls } = database();
  const d: LookupDecl = { id: 'slot', description: 'x', table: 'appointments', about: 'none', fields: [{ column: 'staff', label: 'With' }],
    params: [{ name: 'id', column: 'id', type: 'integer', min: 1, max: 1000 }, { name: 'day', column: 'starts_at', type: 'date' }, { name: 'staff', column: 'staff', type: 'enum', values: ['Dana', 'Eli'] }] };
  const l = new Lookups({ business: 'acme', businessColumn: 'business_id', lookups: [d] }, sql);
  for (const bad of [{ id: '1 OR 1=1', day: '2026-11-05', staff: 'Dana' }, { id: 0, day: '2026-11-05', staff: 'Dana' }, { id: 1.5, day: '2026-11-05', staff: 'Dana' }, { id: 1, day: '2026-13-45', staff: 'Dana' },
    { id: 1, day: '11/05/2026', staff: 'Dana' }, { id: 1, day: '2026-11-05', staff: 'Dana OR 1=1' }, { id: 1, day: '2026-11-05' }]) {
    assert.equal((await l.run('lookup_slot', bad, stranger)).status, 'bad_input', JSON.stringify(bad));
  }
  assert.equal(calls.length, 0);
  assert.equal((await l.run('lookup_slot', { id: '1', day: '2026-11-05', staff: 'Dana' }, stranger)).status, 'not_found', 'a numeric string is fine; no such row at this time');
  assert.deepEqual(calls[0].params, [1, '2026-11-05', 'Dana', 'acme']);
});

test('risk scores gate the lookup: a recorded yes from 56, a person from 91, and a person-lookup needs a verified caller always', async () => {
  const { sql, calls } = database();
  assert.equal(RISK_LOCK, RISK_BANDS[2].upTo + 1, 'matches decision 0011 / RISK_BANDS');
  assert.equal(RISK_PERSON, RISK_BANDS[4].upTo + 1);
  const high: LookupDecl = { ...orderStatus, id: 'order_status_high', risk: 60 };
  const veryHigh: LookupDecl = { ...orderStatus, id: 'order_status_person', risk: 95 };
  const l = new Lookups(acme({ lookups: [orderStatus, high, veryHigh, price] }), sql);
  assert.equal(l.riskOf('order_status'), DEFAULT_RISK.person);
  assert.equal(l.riskOf('price'), DEFAULT_RISK.public);
  assert.equal((await l.run('lookup_order_status_high', { order_number: 'A-1001' }, c1)).status, 'needs_confirmation');
  assert.equal(calls.length, 0);
  const yes = await l.run('lookup_order_status_high', { order_number: 'A-1001' }, c1, true);
  assert.equal(yes.status, 'ok');
  assert.equal((await l.run('lookup_order_status_person', { order_number: 'A-1001' }, c1, true)).status, 'needs_person', 'even with a yes');
  assert.equal((await l.run('lookup_order_status_high', { order_number: 'A-1001' }, stranger, true)).status, 'needs_verification', 'a yes does not stand in for verification');
});

test('declarations are checked when loaded', () => {
  const ok = acme();
  assert.doesNotThrow(() => validate(ok));
  const bad = (patch: Partial<LookupDecl>, b: Partial<BusinessLookups> = {}) => () => validate({ ...ok, ...b, lookups: [{ ...orderStatus, ...patch }] });
  assert.throws(bad({ table: 'orders; drop table x' }), DeclarationError);
  assert.throws(bad({ table: 'Orders' }), DeclarationError);
  assert.throws(bad({ table: '"orders"' }), DeclarationError);
  assert.throws(bad({ fields: [{ column: 'status"', label: 'S' }] }), DeclarationError);
  assert.throws(bad({ fields: [] }), DeclarationError);
  assert.throws(bad({ fields: Array.from({ length: 13 }, (_, i) => ({ column: `c${i}`, label: `L${i}` })) }), DeclarationError);
  assert.throws(bad({ fields: [{ column: 'a', label: 'has {braces}' }] }), DeclarationError);
  assert.throws(bad({ fields: [{ column: 'a', label: 'Same' }, { column: 'b', label: 'Same' }] }), DeclarationError);
  assert.throws(bad({ ownerColumn: undefined }), DeclarationError, 'a lookup about a person needs the owner column');
  assert.throws(bad({ about: 'none' }), DeclarationError, 'an owner column on a public lookup');
  assert.throws(bad({ risk: 20 }), DeclarationError, 'a person lookup below the default');
  assert.throws(bad({ risk: 101 }), DeclarationError);
  assert.throws(bad({ limit: 50 }), DeclarationError);
  assert.throws(bad({ id: 'Bad Id' }), DeclarationError);
  assert.throws(bad({ params: [] , about: 'none', ownerColumn: undefined }), DeclarationError, 'no parameter and not about the caller');
  assert.throws(bad({ params: [{ name: 'x', column: 'a b', type: 'string' }] }), DeclarationError);
  assert.throws(bad({ params: [{ name: 'x', column: 'a', type: 'enum' }] }), DeclarationError);
  assert.throws(bad({ params: [{ name: 'x', column: 'a', type: 'string', pattern: '(' }] }), DeclarationError);
  assert.throws(bad({}, { businessColumn: 'business id' }), DeclarationError);
  assert.throws(bad({}, { business: 'Acme/../x' }), DeclarationError);
  assert.throws(() => validate({ ...ok, lookups: [price, price] }), DeclarationError);
});

test('the tools the model sees are typed from the declaration and carry no SQL', () => {
  const tools = lookupTools(acme()) as { function: { name: string; description: string; parameters: { properties: Record<string, { type: string; enum?: string[] }>; required: string[] } } }[];
  assert.deepEqual(tools.map(t => t.function.name), ['lookup_order_status', 'lookup_my_appointments', 'lookup_price']);
  assert.deepEqual(tools[0].function.parameters.required, ['order_number']);
  assert.deepEqual(tools[1].function.parameters.required, []);
  assert.match(tools[0].function.description, /verified caller/);
  assert.ok(!/select|where|from \w+ /i.test(JSON.stringify(tools).replace(/Status of an order/g, '')));
  const slot = lookupTools({ business: 'acme', lookups: [{ id: 'slot', description: 'x', table: 't', params: [{ name: 'staff', column: 's', type: 'enum', values: ['A', 'B'] }], fields: [{ column: 'f', label: 'F' }] }] }) as typeof tools;
  assert.deepEqual(slot[0].function.parameters.properties.staff, { type: 'string', enum: ['A', 'B'] });
});

test('errors and unknown tools say nothing about the database', async () => {
  const boom: Sql = async () => { throw new Error('relation "orders" does not exist at /var/db/pg'); };
  const l = new Lookups(acme(), boom);
  const r = await l.run('lookup_order_status', { order_number: 'A-1001' }, c1);
  assert.equal(r.status, 'error');
  assert.ok(!/relation|orders|pg/.test(r.text));
  assert.equal((await l.run('lookup_secrets', {}, c1)).status, 'unknown_lookup');
  assert.equal((await l.run('drop_everything', {}, c1)).status, 'unknown_lookup');
});

test('rows are limited, long values cut, dates formatted', async () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ starts_at: i === 0 ? new Date('2026-11-05T10:00:00Z') : `slot ${i}`, staff: 'x'.repeat(1000) }));
  const r = await new Lookups(acme(), async () => ({ rows })).run('lookup_my_appointments', {}, c1);
  assert.ok(r.status === 'ok' && r.rows.length === 3);
  assert.ok(r.status === 'ok' && r.rows[0].When === '2026-11-05' && r.rows[0].With.length === 200);
});
