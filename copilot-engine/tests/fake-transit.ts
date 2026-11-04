// OpenBao's transit engine in memory, for tests: one real AES-256-GCM key per name, data keys locked with it in
// OpenBao's `vault:v1:` form. Unlocking with another key, or a destroyed one, fails as it does in OpenBao.
import type { KeyStore } from '../src/call-vault.ts';

const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64');

export class FakeTransit implements KeyStore {
  keys = new Map<string, CryptoKey>();
  requests: { op: 'dataKey' | 'unlock' | 'destroy'; name: string }[] = [];
  private async keyOf(name: string, make: boolean): Promise<CryptoKey> {
    let k = this.keys.get(name);
    if (!k && make) {
      const made = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      k = this.keys.get(name) ?? made; // creating a key that exists changes nothing, as in OpenBao
      this.keys.set(name, k);
    }
    if (!k) throw new Error(`encryption key not found: ${name}`);
    return k;
  }
  async dataKey(name: string) {
    this.requests.push({ op: 'dataKey', name });
    const key = crypto.getRandomValues(new Uint8Array(32)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await this.keyOf(name, true), key));
    return { key, locked: `vault:v1:${b64(new Uint8Array([...iv, ...ct]))}` };
  }
  async unlock(name: string, locked: string) {
    this.requests.push({ op: 'unlock', name });
    const raw = Buffer.from(locked.replace(/^vault:v1:/, ''), 'base64');
    const key = await this.keyOf(name, false);
    try {
      return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, key, raw.subarray(12)));
    } catch (e) { throw new Error(`cipher: message authentication failed (${(e as Error).message})`); }
  }
  async destroy(name: string) { this.requests.push({ op: 'destroy', name }); this.keys.delete(name); }
}
