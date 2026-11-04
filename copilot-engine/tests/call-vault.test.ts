// Each call's record locked with its own key, that key locked by its business's key (#128, decision 0021).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CallVault, OpenBaoKeys, isSealed } from '../src/call-vault.ts';
import { FakeTransit } from './fake-transit.ts';

const record = { v: 1, flow: 'booking', values: { name: 'Ana Ruiz', phone: '555 0100' }, log: [{ who: 'user', text: 'My baby has a fever' }] };

test('a sealed record holds no readable text, and its business opens it', async () => {
  const vault = new CallVault(new FakeTransit());
  const s = await vault.seal('clinic', 'call-1', record);
  assert.ok(isSealed(s));
  assert.match(s.key, /^vault:v1:/, 'the data key is stored only locked');
  assert.doesNotMatch(JSON.stringify(s), /Ana|fever|555|booking/);
  assert.deepEqual(await vault.open('clinic', 'call-1', s), record);
});

test("business A's key cannot open business B's calls, and a record moved to another call does not open", async () => {
  const transit = new FakeTransit();
  const vault = new CallVault(transit);
  const a = await vault.seal('clinic-a', 'call-1', record);
  await vault.seal('clinic-b', 'call-9', { v: 1 });
  await assert.rejects(vault.open('clinic-b', 'call-1', a), /authentication failed/);
  await assert.rejects(vault.open('clinic-a', 'call-2', a), 'bound to its call');
  await assert.rejects(new CallVault(new FakeTransit()).open('clinic-a', 'call-1', a), /not found/, 'a fresh key store has no key for it');
});

test('each call has its own data key; saves within a call reuse it', async () => {
  const transit = new FakeTransit();
  const vault = new CallVault(transit);
  const one = await vault.seal('clinic', 'call-1', record), again = await vault.seal('clinic', 'call-1', record);
  const two = await vault.seal('clinic', 'call-2', record);
  assert.equal(one.key, again.key);
  assert.notEqual(one.key, two.key);
  assert.notEqual(one.ct, again.ct, 'a fresh nonce every save');
  assert.equal(transit.requests.filter(r => r.op === 'dataKey').length, 2);
});

test('after a restart the same key store opens the same calls', async () => {
  const transit = new FakeTransit();
  const s = await new CallVault(transit).seal('clinic', 'call-1', record);
  assert.deepEqual(await new CallVault(transit).open('clinic', 'call-1', s), record);
});

test('OpenBaoKeys speaks transit through the AppRole: makes the business key once, then data keys and unlocks', async () => {
  const seen: string[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input), body = JSON.parse(String(init?.body ?? '{}')), token = new Headers(init?.headers).get('x-vault-token');
    seen.push(url.replace('http://bao.test/v1/', ''));
    const reply = (b: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(b), { status });
    if (url.endsWith('/auth/approle/login')) return body.secret_id === 'sid' ? reply({ auth: { client_token: 'tok', lease_duration: 3600 } }) : reply({ errors: ['invalid'] }, 400);
    if (token !== 'tok') return reply({ errors: ['permission denied'] }, 403);
    if (url.includes('/transit/keys/')) return reply({}, 204);
    if (url.includes('/transit/datakey/plaintext/')) return reply({ data: { plaintext: Buffer.alloc(32, 7).toString('base64'), ciphertext: 'vault:v1:abc' } });
    if (url.includes('/transit/decrypt/')) return body.ciphertext === 'vault:v1:abc' ? reply({ data: { plaintext: Buffer.alloc(32, 7).toString('base64') } }) : reply({ errors: ['cipher: message authentication failed'] }, 400);
    return reply({ errors: ['unsupported path'] }, 404);
  }) as typeof fetch;
  try {
    const keys = new OpenBaoKeys({ addr: 'http://bao.test/', roleId: 'rid', secretId: 'sid' });
    const k1 = await keys.dataKey('clinic'), k2 = await keys.dataKey('clinic');
    assert.equal(k1.locked, 'vault:v1:abc');
    assert.deepEqual(await keys.unlock('clinic', k2.locked), k1.key);
    await assert.rejects(keys.unlock('clinic', 'vault:v1:zzz'), /400/);
    assert.deepEqual(seen, ['auth/approle/login', 'transit/keys/biz-clinic', 'transit/keys/biz-clinic/config', 'transit/datakey/plaintext/biz-clinic',
      'transit/datakey/plaintext/biz-clinic', 'transit/decrypt/biz-clinic', 'transit/decrypt/biz-clinic']);
    assert.throws(() => OpenBaoKeys.keyName('../sys'), /bad business id/);
  } finally { globalThis.fetch = real; }
});

test("a call's audio locks as raw bytes and opens only as that business's call (#130)", async () => {
  const transit = new FakeTransit(), vault = new CallVault(transit);
  const audio = new TextEncoder().encode('OggS the caller said my baby has a fever');
  const s = await vault.sealBytes('clinic', 'call-1', audio);
  assert.equal(new TextDecoder().decode(s.ct).includes('fever'), false);
  assert.deepEqual(await vault.openBytes('clinic', 'call-1', s), audio);
  await assert.rejects(vault.openBytes('other', 'call-1', s));
  await assert.rejects(vault.openBytes('clinic', 'call-2', s));
});
