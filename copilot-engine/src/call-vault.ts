// A call's raw record is locked before it reaches Octo (decision 0021 settlement 3, #128). Each call gets its own data
// key, made from two keys in OpenBao's transit engine, which never lets a key out: its business's key `biz-<business id>`
// and the call's own key `biz-<business id>.call.<hash of the call id>` (#132). The record keeps both halves only in
// their locked form. Opening it means asking OpenBao to unlock both, so destroying either key erases the call in every
// copy, backups included: the call's key for one call, the business key for every call of that business.
// No Node imports: Web Crypto and fetch only, so it also runs in a Cloudflare Pages Function.

// The key store, as the vault sees it, by key name: a fresh data key locked by a named key, a locked data key opened
// again, and a named key destroyed for good.
export interface KeyStore {
  dataKey(name: string): Promise<{ key: Uint8Array; locked: string }>;
  unlock(name: string, locked: string): Promise<Uint8Array>;
  destroy(name: string): Promise<void>;
}

// A locked record as it is stored. `key` is the call's two locked halves (OpenBao's `vault:v1:...`), business key first,
// separated by a space. A record from before #132 has only the business half.
export type Sealed = { sealed: 'a256gcm.v1'; key: string; iv: string; ct: string };

export const isSealed = (v: unknown): v is Sealed =>
  !!v && typeof v === 'object' && (v as Sealed).sealed === 'a256gcm.v1' && typeof (v as Sealed).key === 'string'
  && typeof (v as Sealed).iv === 'string' && typeof (v as Sealed).ct === 'string';

const b64 = (b: Uint8Array) => { let s = ''; for (const c of b) s += String.fromCharCode(c); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const aesKey = (raw: Uint8Array) => crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
// The record is bound to its business and call, so a locked record moved under another call or business fails to open.
const bound = (business: string, call: string) => new TextEncoder().encode(`${business}\n${call}`);
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');

// Key names in OpenBao. All start `biz-`, the only names the copilot's policy reaches.
export function businessKeyName(business: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(business)) throw new Error('bad business id');
  return `biz-${business}`;
}
export async function callKeyName(business: string, call: string): Promise<string> {
  if (!call) throw new Error('bad call id');
  return `${businessKeyName(business)}.call.${hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(call))).slice(0, 32)}`;
}

// The call's data key from its two halves: neither half alone gives it.
const both = async (biz: Uint8Array, call: Uint8Array) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array([...new TextEncoder().encode('call-key.v2\n'), ...biz, ...call])));

export class CallVault {
  private keys: KeyStore;
  // A call's data key stays in memory while the call is live, so its saves cost one key-store request, not one each.
  // Saves that arrive together for a new call share the one request.
  private live = new Map<string, { key: Promise<{ key: Uint8Array; locked: string }>; at: number }>();
  private now: () => number;
  constructor(keys: KeyStore, opts: { now?: () => number } = {}) { this.keys = keys; this.now = opts.now ?? Date.now; }

  private callKey(business: string, call: string): Promise<{ key: Uint8Array; locked: string }> {
    const id = `${business}\n${call}`, hit = this.live.get(id), t = this.now();
    if (hit && t - hit.at < 30 * 60_000) return hit.key;
    const key = (async () => {
      const [b, c] = await Promise.all([this.keys.dataKey(businessKeyName(business)), this.keys.dataKey(await callKeyName(business, call))]);
      return { key: await both(b.key, c.key), locked: `${b.locked} ${c.locked}` };
    })();
    if (this.live.size >= 2000) this.live.delete(this.live.keys().next().value!);
    this.live.set(id, { key, at: t });
    key.catch(() => { if (this.live.get(id)?.key === key) this.live.delete(id); });
    return key;
  }

  private async unlock(business: string, call: string, locked: string): Promise<Uint8Array> {
    const [b, c] = locked.split(' ');
    const biz = await this.keys.unlock(businessKeyName(business), b);
    return c ? both(biz, await this.keys.unlock(await callKeyName(business, call), c)) : biz;
  }

  // Erases one call (#132): its key is destroyed, so no copy of its record, its audio or a backup of them opens again.
  async forgetCall(business: string, call: string): Promise<void> {
    this.live.delete(`${business}\n${call}`);
    await this.keys.destroy(await callKeyName(business, call));
  }

  // Erases a whole business (#132): its key is destroyed, so none of its calls opens again, in Octo or in a backup.
  async forgetBusiness(business: string): Promise<void> {
    for (const id of [...this.live.keys()]) if (id.startsWith(`${business}\n`)) this.live.delete(id);
    await this.keys.destroy(businessKeyName(business));
  }

  async seal(business: string, call: string, value: unknown): Promise<Sealed> {
    const { key, locked } = await this.callKey(business, call);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: bound(business, call) }, await aesKey(key), new TextEncoder().encode(JSON.stringify(value)));
    return { sealed: 'a256gcm.v1', key: locked, iv: b64(iv), ct: b64(new Uint8Array(ct)) };
  }

  // Throws when a key can't unlock its half (another business's record, or a destroyed key) or the record was moved or
  // changed.
  async open(business: string, call: string, s: Sealed): Promise<unknown> {
    const key = await this.unlock(business, call, s.key);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv), additionalData: bound(business, call) }, await aesKey(key), unb64(s.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  // Bytes (a call's audio, #130): the same call key and binding as seal(), with the ciphertext kept as raw bytes so a
  // recording isn't stored as base64.
  async sealBytes(business: string, call: string, data: Uint8Array): Promise<{ key: string; iv: string; ct: Uint8Array }> {
    const { key, locked } = await this.callKey(business, call);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: bound(business, call) }, await aesKey(key), data as BufferSource);
    return { key: locked, iv: b64(iv), ct: new Uint8Array(ct) };
  }

  async openBytes(business: string, call: string, s: { key: string; iv: string; ct: Uint8Array }): Promise<Uint8Array> {
    const key = await this.unlock(business, call, s.key);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv), additionalData: bound(business, call) }, await aesKey(key), s.ct as BufferSource));
  }
}

// OpenBao's transit engine, reached with the copilot's AppRole (server-management vps/openbao/policies/copilot.hcl, which
// reaches only `biz-*` keys). Keys are made on first use. The login token lasts an hour; a new one is fetched before it
// runs out.
export class OpenBaoKeys implements KeyStore {
  private addr: string; private roleId: string; private secretId: string; private timeoutMs: number;
  private token?: { value: string; until: number };
  private made = new Set<string>();
  constructor(o: { addr: string; roleId: string; secretId: string; timeoutMs?: number }) {
    this.addr = o.addr.replace(/\/$/, ''); this.roleId = o.roleId; this.secretId = o.secretId; this.timeoutMs = o.timeoutMs ?? 5000;
  }

  private static check(name: string): string {
    if (!/^biz-[a-z0-9][a-z0-9-]{0,39}(\.call\.[0-9a-f]{32})?$/.test(name)) throw new Error('bad key name');
    return name;
  }

  private async call(path: string, body?: unknown, o: { auth?: boolean; method?: string; missingOk?: boolean } = {}): Promise<Record<string, any>> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (o.auth !== false) headers['x-vault-token'] = await this.login();
    const r = await fetch(`${this.addr}/v1/${path}`, { method: o.method ?? 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(this.timeoutMs) });
    const text = await r.text();
    if (r.status === 404 && o.missingOk) return {};
    if (!r.ok) throw new Error(`openbao ${path.split('/').slice(0, 2).join('/')}: ${r.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : {};
  }

  private async login(): Promise<string> {
    if (this.token && this.token.until > Date.now()) return this.token.value;
    const r = await this.call('auth/approle/login', { role_id: this.roleId, secret_id: this.secretId }, { auth: false });
    const ttl = Number(r.auth?.lease_duration) || 3600;
    this.token = { value: String(r.auth?.client_token), until: Date.now() + Math.max(60, ttl - 120) * 1000 };
    return this.token.value;
  }

  private async ensure(name: string): Promise<void> {
    if (this.made.has(name)) return;
    // Creating a key that exists changes nothing; deletion is allowed so it can be destroyed to erase (#132).
    await this.call(`transit/keys/${name}`, { type: 'aes256-gcm96', exportable: false });
    await this.call(`transit/keys/${name}/config`, { deletion_allowed: true });
    this.made.add(name);
  }

  async dataKey(name: string): Promise<{ key: Uint8Array; locked: string }> {
    await this.ensure(OpenBaoKeys.check(name));
    const r = await this.call(`transit/datakey/plaintext/${name}`, { bits: 256 });
    return { key: unb64(r.data.plaintext), locked: String(r.data.ciphertext) };
  }

  async unlock(name: string, locked: string): Promise<Uint8Array> {
    const r = await this.call(`transit/decrypt/${OpenBaoKeys.check(name)}`, { ciphertext: locked });
    return unb64(r.data.plaintext);
  }

  // Destroys a key for good. A key that was never made, or is already gone, is fine.
  async destroy(name: string): Promise<void> {
    OpenBaoKeys.check(name);
    this.made.delete(name);
    if (!Object.keys(await this.call(`transit/keys/${name}`, undefined, { method: 'GET', missingOk: true })).length) return;
    await this.call(`transit/keys/${name}/config`, { deletion_allowed: true });
    await this.call(`transit/keys/${name}`, undefined, { method: 'DELETE', missingOk: true });
  }
}
