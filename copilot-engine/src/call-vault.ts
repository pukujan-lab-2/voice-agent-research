// A call's raw record is locked before it reaches Octo (decision 0021 settlement 3, #128). Each call gets its own data
// key; the record keeps that key only in its locked form, locked by its business's key `biz-<business id>` in OpenBao's
// transit engine, which never lets a business key out. Opening a record means asking OpenBao to unlock that one data
// key, and only the same business's key can. Deleting a business key makes every call of that business unreadable.
// No Node imports: Web Crypto and fetch only, so it also runs in a Cloudflare Pages Function.

// The key store, as the vault sees it: a fresh data key for a business, and a locked data key opened again.
export interface KeyStore {
  dataKey(business: string): Promise<{ key: Uint8Array; locked: string }>;
  unlock(business: string, locked: string): Promise<Uint8Array>;
}

// A locked record as it is stored. `key` is the call's data key locked by the business key (OpenBao's `vault:v1:...`).
export type Sealed = { sealed: 'a256gcm.v1'; key: string; iv: string; ct: string };

export const isSealed = (v: unknown): v is Sealed =>
  !!v && typeof v === 'object' && (v as Sealed).sealed === 'a256gcm.v1' && typeof (v as Sealed).key === 'string'
  && typeof (v as Sealed).iv === 'string' && typeof (v as Sealed).ct === 'string';

const b64 = (b: Uint8Array) => { let s = ''; for (const c of b) s += String.fromCharCode(c); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const aesKey = (raw: Uint8Array) => crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
// The record is bound to its business and call, so a locked record moved under another call or business fails to open.
const bound = (business: string, call: string) => new TextEncoder().encode(`${business}\n${call}`);

export class CallVault {
  private keys: KeyStore;
  // A call's data key stays in memory while the call is live, so its saves cost one key-store request, not one each.
  private live = new Map<string, { key: Uint8Array; locked: string; at: number }>();
  private now: () => number;
  constructor(keys: KeyStore, opts: { now?: () => number } = {}) { this.keys = keys; this.now = opts.now ?? Date.now; }

  private async callKey(business: string, call: string): Promise<{ key: Uint8Array; locked: string }> {
    const id = `${business}\n${call}`, hit = this.live.get(id), t = this.now();
    if (hit && t - hit.at < 30 * 60_000) return hit;
    const k = await this.keys.dataKey(business);
    if (this.live.size >= 2000) this.live.delete(this.live.keys().next().value!);
    this.live.set(id, { ...k, at: t });
    return k;
  }

  async seal(business: string, call: string, value: unknown): Promise<Sealed> {
    const { key, locked } = await this.callKey(business, call);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: bound(business, call) }, await aesKey(key), new TextEncoder().encode(JSON.stringify(value)));
    return { sealed: 'a256gcm.v1', key: locked, iv: b64(iv), ct: b64(new Uint8Array(ct)) };
  }

  // Throws when the business key can't unlock the data key (another business's record, or a deleted key) or the record
  // was moved or changed.
  async open(business: string, call: string, s: Sealed): Promise<unknown> {
    const key = await this.keys.unlock(business, s.key);
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
    const key = await this.keys.unlock(business, s.key);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv), additionalData: bound(business, call) }, await aesKey(key), s.ct as BufferSource));
  }
}

// OpenBao's transit engine, reached with the copilot's AppRole (server-management vps/openbao/policies/copilot.hcl).
// Business keys are made on first use. The login token lasts an hour; a new one is fetched before it runs out.
export class OpenBaoKeys implements KeyStore {
  private addr: string; private roleId: string; private secretId: string; private timeoutMs: number;
  private token?: { value: string; until: number };
  private made = new Set<string>();
  constructor(o: { addr: string; roleId: string; secretId: string; timeoutMs?: number }) {
    this.addr = o.addr.replace(/\/$/, ''); this.roleId = o.roleId; this.secretId = o.secretId; this.timeoutMs = o.timeoutMs ?? 5000;
  }

  static keyName(business: string): string {
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(business)) throw new Error('bad business id');
    return `biz-${business}`;
  }

  private async call(path: string, body: unknown, auth = true): Promise<Record<string, any>> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (auth) headers['x-vault-token'] = await this.login();
    const r = await fetch(`${this.addr}/v1/${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(this.timeoutMs) });
    const text = await r.text();
    if (!r.ok) throw new Error(`openbao ${path.split('/').slice(0, 2).join('/')}: ${r.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : {};
  }

  private async login(): Promise<string> {
    if (this.token && this.token.until > Date.now()) return this.token.value;
    const r = await this.call('auth/approle/login', { role_id: this.roleId, secret_id: this.secretId }, false);
    const ttl = Number(r.auth?.lease_duration) || 3600;
    this.token = { value: String(r.auth?.client_token), until: Date.now() + Math.max(60, ttl - 120) * 1000 };
    return this.token.value;
  }

  private async ensure(name: string): Promise<void> {
    if (this.made.has(name)) return;
    // Creating a key that exists changes nothing; deletion is allowed so a business can be erased (#132).
    await this.call(`transit/keys/${name}`, { type: 'aes256-gcm96', exportable: false });
    await this.call(`transit/keys/${name}/config`, { deletion_allowed: true });
    this.made.add(name);
  }

  async dataKey(business: string): Promise<{ key: Uint8Array; locked: string }> {
    const name = OpenBaoKeys.keyName(business);
    await this.ensure(name);
    const r = await this.call(`transit/datakey/plaintext/${name}`, { bits: 256 });
    return { key: unb64(r.data.plaintext), locked: String(r.data.ciphertext) };
  }

  async unlock(business: string, locked: string): Promise<Uint8Array> {
    const r = await this.call(`transit/decrypt/${OpenBaoKeys.keyName(business)}`, { ciphertext: locked });
    return unb64(r.data.plaintext);
  }
}
