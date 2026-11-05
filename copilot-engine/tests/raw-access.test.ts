// Who may open a raw call, and the log of every time someone did (#131), against real Postgres (PGlite).
import test from 'node:test';
import assert from 'node:assert/strict';
import { AccessDenied, RawAccess, type Who } from '../src/raw-access.ts';
import { pgSql } from './pg-sql.ts';

const owner: Who = { principal: 'p-owner', email: 'owner@biz.example', role: 'owner' };
const admin: Who = { principal: 'p-admin', email: 'admin@biz.example', role: 'admin' };
const reader: Who = { principal: 'p-reader', email: 'reader@biz.example', role: 'member' };
const soon = () => new Date(Date.now() + 86_400_000);

async function setup() {
  const { sql } = await pgSql();
  const ra = new RawAccess(sql);
  let opened = 0;
  const unlock = async () => { opened++; return 'the call'; };
  return { sql, ra, unlock, opened: () => opened };
}

test('a reader opens only the calls a live grant covers, and every try is in the log', async () => {
  const { ra, unlock, opened } = await setup();
  await assert.rejects(ra.open('biz', reader, 'call-1', 'record', unlock), AccessDenied);
  await ra.grant('biz', admin, { email: 'Reader@Biz.example', calls: ['call-1'], purpose: 'complaint review', until: soon() });
  assert.equal(await ra.open('biz', reader, 'call-1', 'record', unlock), 'the call');
  await assert.rejects(ra.open('biz', reader, 'call-2', 'audio', unlock), AccessDenied);
  assert.equal(opened(), 1);
  const log = (await ra.log('biz')).reverse();
  assert.deepEqual(log.map(e => [e.action, e.email, e.call, e.ok]), [
    ['read record', 'reader@biz.example', 'call-1', false],
    ['grant', 'admin@biz.example', null, true],
    ['read record', 'reader@biz.example', 'call-1', true],
    ['read audio', 'reader@biz.example', 'call-2', false],
  ]);
  assert.equal(log[2].principal, 'p-reader');
  assert.ok(log[2].grant_id);
});

test('a revoked or expired grant opens nothing', async () => {
  const { sql, ra, unlock, opened } = await setup();
  const g = await ra.grant('biz', owner, { email: reader.email, calls: null, purpose: 'audit', until: soon() });
  assert.equal(await ra.open('biz', reader, 'any-call', 'record', unlock), 'the call');
  assert.equal(await ra.revoke('biz', admin, g.id), true);
  await assert.rejects(ra.open('biz', reader, 'any-call', 'record', unlock), AccessDenied);
  const h = await ra.grant('biz', owner, { email: reader.email, calls: null, purpose: 'audit again', until: soon() });
  await sql(`update copilot_access_grants set until = now() - interval '1 second' where id = $1`, [h.id]);
  await assert.rejects(ra.open('biz', reader, 'any-call', 'record', unlock), AccessDenied);
  assert.equal(opened(), 1);
  // another business's grant is not this one's
  await ra.grant('other', owner, { email: reader.email, calls: null, purpose: 'theirs', until: soon() });
  await assert.rejects(ra.open('biz', reader, 'any-call', 'record', unlock), AccessDenied);
});

test('only the owner or an admin gives or revokes grants, within limits', async () => {
  const { ra } = await setup();
  await assert.rejects(ra.grant('biz', reader, { email: reader.email, calls: null, purpose: 'self', until: soon() }), AccessDenied);
  await assert.rejects(ra.grant('biz', admin, { email: reader.email, calls: null, purpose: 'too long', until: new Date(Date.now() + 91 * 86_400_000) }), /within 90 days/);
  await assert.rejects(ra.grant('biz', admin, { email: reader.email, calls: null, purpose: 'past', until: new Date(Date.now() - 1000) }), /within 90 days/);
  await assert.rejects(ra.grant('biz', admin, { email: 'not an email', calls: null, purpose: 'x y z', until: soon() }), /email/);
  const g = await ra.grant('biz', admin, { email: reader.email, calls: ['a'], purpose: 'okay', until: soon() });
  await assert.rejects(ra.revoke('biz', reader, g.id), AccessDenied);
});

test('the owner opens in an emergency with a reason, flagged in the log; nobody else does', async () => {
  const { ra, unlock, opened } = await setup();
  await assert.rejects(ra.open('biz', admin, 'call-9', 'record', unlock, 'a long enough reason for this'), /only the workspace owner/);
  await assert.rejects(ra.open('biz', owner, 'call-9', 'record', unlock, 'too short'), /at least 20/);
  assert.equal(await ra.open('biz', owner, 'call-9', 'audio', unlock, 'customer disputes a charge, needs it today'), 'the call');
  assert.equal(opened(), 1);
  const [last, short, wrong] = await ra.log('biz');
  assert.deepEqual([last.emergency, last.ok, last.reason, last.email], [true, true, 'customer disputes a charge, needs it today', owner.email]);
  assert.deepEqual([short.emergency, short.ok], [true, false]);
  assert.deepEqual([wrong.emergency, wrong.ok, wrong.role], [true, false, 'admin']);
});

test('nothing opens when the log entry cannot be written', async () => {
  const { sql } = await pgSql();
  let broken = false;
  const ra = new RawAccess(async (t, p) => { if (broken && /insert into copilot_access_log/.test(t)) throw new Error('octo down'); return sql(t, p); });
  await ra.grant('biz', owner, { email: reader.email, calls: null, purpose: 'audit', until: soon() });
  broken = true;
  let opened = false;
  await assert.rejects(ra.open('biz', reader, 'call-1', 'record', async () => { opened = true; }), /octo down/);
  assert.equal(opened, false);
});
