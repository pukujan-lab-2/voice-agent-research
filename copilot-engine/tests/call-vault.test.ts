// Each call's record locked with its own key, that key locked by its business's key (#128, decision 0021).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CallVault, OpenBaoKeys, businessKeyName, callKeyName, isSealed } from '../src/call-vault.ts';
import { FakeTransit } from './fake-transit.ts';

const record = { v: 1, flow: 'booking', values: { name: 'Ana Ruiz', phone: '555 0100' }, log: [{ who: 'user', text: 'My baby has a fever' }] };

test('a sealed record holds no readable text, and its business opens it', async () => {
  const vault = new CallVault(new FakeTransit());
  const s = await vault.seal('clinic', 'call-1', record);
  assert.ok(isSealed(s));
  assert.match(s.key, /^vault:v1:\S+ vault:v1:\S+$/, 'both halves of the data key are stored only locked');
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
  assert.equal(transit.requests.filter(r => r.op === 'dataKey').length, 4, 'a business half and a call half per call');
});

test('saves that arrive together for a new call share one key request per half', async () => {
  const transit = new FakeTransit(), vault = new CallVault(transit);
  const [a, b] = await Promise.all([vault.seal('clinic', 'call-1', record), vault.seal('clinic', 'call-1', { v: 2 })]);
  assert.equal(a.key, b.key);
  assert.equal(transit.requests.filter(r => r.op === 'dataKey').length, 2);
  assert.deepEqual(await new CallVault(transit).open('clinic', 'call-1', a), record);
});

test('after a restart the same key store opens the same calls', async () => {
  const transit = new FakeTransit();
  const s = await new CallVault(transit).seal('clinic', 'call-1', record);
  assert.deepEqual(await new CallVault(transit).open('clinic', 'call-1', s), record);
});

test('OpenBaoKeys speaks transit through the AppRole: makes a key once, then data keys, unlocks and destroys', async () => {
  const seen: string[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? 'POST', body = JSON.parse(String(init?.body ?? '{}')), token = new Headers(init?.headers).get('x-vault-token');
    seen.push(`${method} ${url.replace('http://bao.test/v1/', '')}`);
    const reply = (b: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(b), { status });
    if (url.endsWith('/auth/approle/login')) return body.secret_id === 'sid' ? reply({ auth: { client_token: 'tok', lease_duration: 3600 } }) : reply({ errors: ['invalid'] }, 400);
    if (token !== 'tok') return reply({ errors: ['permission denied'] }, 403);
    if (url.includes('/transit/keys/') && method === 'GET') return url.endsWith('biz-gone') ? reply({ errors: [] }, 404) : reply({ data: { name: 'biz-clinic' } });
    if (url.includes('/transit/keys/')) return reply({}, 204);
    if (url.includes('/transit/datakey/plaintext/')) return reply({ data: { plaintext: Buffer.alloc(32, 7).toString('base64'), ciphertext: 'vault:v1:abc' } });
    if (url.includes('/transit/decrypt/')) return body.ciphertext === 'vault:v1:abc' ? reply({ data: { plaintext: Buffer.alloc(32, 7).toString('base64') } }) : reply({ errors: ['cipher: message authentication failed'] }, 400);
    return reply({ errors: ['unsupported path'] }, 404);
  }) as typeof fetch;
  try {
    const keys = new OpenBaoKeys({ addr: 'http://bao.test/', roleId: 'rid', secretId: 'sid' });
    const k1 = await keys.dataKey('biz-clinic'), k2 = await keys.dataKey('biz-clinic');
    assert.equal(k1.locked, 'vault:v1:abc');
    assert.deepEqual(await keys.unlock('biz-clinic', k2.locked), k1.key);
    await assert.rejects(keys.unlock('biz-clinic', 'vault:v1:zzz'), /400/);
    await keys.destroy('biz-clinic');
    await keys.destroy('biz-gone');
    assert.deepEqual(seen, ['POST auth/approle/login', 'POST transit/keys/biz-clinic', 'POST transit/keys/biz-clinic/config', 'POST transit/datakey/plaintext/biz-clinic',
      'POST transit/datakey/plaintext/biz-clinic', 'POST transit/decrypt/biz-clinic', 'POST transit/decrypt/biz-clinic',
      'GET transit/keys/biz-clinic', 'POST transit/keys/biz-clinic/config', 'DELETE transit/keys/biz-clinic', 'GET transit/keys/biz-gone']);
    await assert.rejects(keys.dataKey('../sys'), /bad key name/);
    await assert.rejects(keys.dataKey('transit-other'), /bad key name/, 'only the biz-* keys its policy reaches');
    assert.throws(() => businessKeyName('../sys'), /bad business id/);
    assert.match(await callKeyName('clinic', 'call-1'), /^biz-clinic\.call\.[0-9a-f]{32}$/);
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

// Erasure by key (#132). A backup is a copy of the stored record taken before the erasure: putting it back changes
// nothing, because the key it needs is gone from OpenBao.
test('erasing one call destroys its key: the record and a backup taken before no longer open, and other calls still do', async () => {
  const transit = new FakeTransit(), vault = new CallVault(transit);
  const one = await vault.seal('clinic', 'call-1', record), two = await vault.seal('clinic', 'call-2', record);
  const audio = await vault.sealBytes('clinic', 'call-1', new TextEncoder().encode('OggS fever'));
  const backup = structuredClone({ one, audio });
  await vault.forgetCall('clinic', 'call-1');
  assert.equal(transit.keys.has(await callKeyName('clinic', 'call-1')), false);
  await assert.rejects(vault.open('clinic', 'call-1', backup.one), /not found/);
  await assert.rejects(vault.openBytes('clinic', 'call-1', backup.audio), /not found/);
  await assert.rejects(new CallVault(transit).open('clinic', 'call-1', backup.one), /not found/, 'nor after a restart');
  assert.deepEqual(await vault.open('clinic', 'call-2', two), record, 'the business key and other calls are untouched');
});

test("erasing a business destroys its key: none of its calls opens again, backups included, and other businesses' still do", async () => {
  const transit = new FakeTransit(), vault = new CallVault(transit);
  const backup = structuredClone([await vault.seal('clinic', 'call-1', record), await vault.seal('clinic', 'call-2', record)]);
  const other = await vault.seal('shop', 'call-1', record);
  await vault.forgetBusiness('clinic');
  assert.equal(transit.keys.has(businessKeyName('clinic')), false);
  for (const [i, s] of backup.entries()) await assert.rejects(vault.open('clinic', `call-${i + 1}`, s), /not found/);
  assert.deepEqual(await vault.open('shop', 'call-1', other), record);
});

test('a record locked before #132, with the business half only, still opens', async () => {
  const transit = new FakeTransit(), vault = new CallVault(transit);
  const { key, locked } = await transit.dataKey(businessKeyName('clinic'));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('clinic\ncall-1') }, k, new TextEncoder().encode(JSON.stringify(record)));
  const old = { sealed: 'a256gcm.v1' as const, key: locked, iv: Buffer.from(iv).toString('base64'), ct: Buffer.from(ct).toString('base64') };
  assert.deepEqual(await vault.open('clinic', 'call-1', old), record);
});
