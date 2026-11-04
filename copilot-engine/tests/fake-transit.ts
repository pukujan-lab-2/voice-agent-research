// OpenBao's transit engine in memory, for tests: one real AES-256-GCM key per business, data keys locked with it in
// OpenBao's `vault:v1:` form. Unlocking with another business's key fails as it does in OpenBao.
import type { KeyStore } from '../src/call-vault.ts';

const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64');

export class FakeTransit implements KeyStore {
  keys = new Map<string, CryptoKey>();
  requests: { op: 'dataKey' | 'unlock'; business: string }[] = [];
  private async keyOf(business: string, make: boolean): Promise<CryptoKey> {
    let k = this.keys.get(business);
    if (!k && make) { k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); this.keys.set(business, k); }
    if (!k) throw new Error(`encryption key not found: biz-${business}`);
    return k;
  }
  async dataKey(business: string) {
    this.requests.push({ op: 'dataKey', business });
    const key = crypto.getRandomValues(new Uint8Array(32)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await this.keyOf(business, true), key));
    return { key, locked: `vault:v1:${b64(new Uint8Array([...iv, ...ct]))}` };
  }
  async unlock(business: string, locked: string) {
    this.requests.push({ op: 'unlock', business });
    const raw = Buffer.from(locked.replace(/^vault:v1:/, ''), 'base64');
    try {
      return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, await this.keyOf(business, false), raw.subarray(12)));
    } catch (e) { throw new Error(`cipher: message authentication failed (${(e as Error).message})`); }
  }
}
