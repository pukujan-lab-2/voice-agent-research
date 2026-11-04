// Memory for the desk: call resume (short-lived session snapshots) and opt-in returning-customer records.
// Stores are pluggable: an in-memory Map, a JSON file (tests), or anything that implements Store (an Octo
// workspace store later). Customer records are keyed by the business and an HMAC of the normalized phone or email
// under that business's secret, so the store never holds a contact detail as a key and no business reads another's.
// No top-level Node imports: the desk also runs in the browser (the live site), where only the Store types and
// newSessionId are used. The Node-only parts (the file store, the customer key's hash) load Node's modules when called.
const node = <T>(id: string): T => (globalThis as unknown as { process: { getBuiltinModule(id: string): T } }).process.getBuiltinModule(id);
const fs = () => node<typeof import('node:fs')>('node:fs');

export interface Store {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  // Adds 1 to a counter and returns the new count. The counter expires ttlMs after its first increment: the window
  // does not slide, so an attacker can't keep it alive, and it can't straddle a boundary.
  incr(key: string, ttlMs: number): Promise<number>;
}

type Entry = { v: unknown; exp?: number };

// In-process store with a time limit per entry and a hard cap on how many it holds: past `max`, expired entries go
// first, then the oldest written. Memory is therefore bounded however many calls come in; a restart loses it.
export class MemoryStore implements Store {
  private m = new Map<string, Entry>();
  private now: () => number;
  private max: number;
  private puts = 0;
  constructor(now: () => number = Date.now, opts: { max?: number } = {}) { this.now = now; this.max = opts.max ?? Infinity; }
  get size() { return this.m.size; }
  private put(key: string, e: Entry) {
    this.m.delete(key); this.m.set(key, e); // a rewritten key becomes the newest
    if (this.m.size > this.max || ++this.puts % 256 === 0) this.trim();
  }
  private trim() {
    const t = this.now();
    for (const [k, e] of this.m) if (e.exp !== undefined && e.exp <= t) this.m.delete(k);
    for (const k of this.m.keys()) { if (this.m.size <= this.max) break; this.m.delete(k); }
  }
  async get(key: string) {
    const e = this.m.get(key);
    if (!e) return undefined;
    if (e.exp !== undefined && e.exp <= this.now()) { this.m.delete(key); return undefined; }
    return structuredClone(e.v);
  }
  async set(key: string, value: unknown, ttlMs?: number) { this.put(key, { v: structuredClone(value), exp: ttlMs ? this.now() + ttlMs : undefined }); }
  async delete(key: string) { this.m.delete(key); }
  async incr(key: string, ttlMs: number) {
    const e = this.m.get(key), t = this.now();
    if (e && typeof e.v === 'number' && (e.exp === undefined || e.exp > t)) { e.v++; return e.v; }
    this.put(key, { v: 1, exp: t + ttlMs });
    return 1;
  }
}

// Whole-file JSON store: fine for tests and a single process, not for concurrent writers.
export class JsonFileStore implements Store {
  private path: string; private now: () => number;
  constructor(path: string, now: () => number = Date.now) { this.path = path; this.now = now; }
  private read(): Record<string, Entry> {
    try { return JSON.parse(fs().readFileSync(this.path, 'utf8')); } catch { return {}; }
  }
  private write(d: Record<string, Entry>) { fs().writeFileSync(this.path, JSON.stringify(d), { mode: 0o600 }); }
  async get(key: string) {
    const d = this.read(); const e = d[key];
    if (!e) return undefined;
    if (e.exp !== undefined && e.exp <= this.now()) { delete d[key]; this.write(d); return undefined; }
    return e.v;
  }
  async set(key: string, value: unknown, ttlMs?: number) { const d = this.read(); d[key] = { v: value, exp: ttlMs ? this.now() + ttlMs : undefined }; this.write(d); }
  async delete(key: string) { const d = this.read(); delete d[key]; this.write(d); }
  async incr(key: string, ttlMs: number) {
    const d = this.read(), t = this.now(), e = d[key];
    const n = e && typeof e.v === 'number' && (e.exp === undefined || e.exp > t) ? e.v + 1 : 1;
    d[key] = { v: n, exp: n === 1 ? t + ttlMs : e.exp }; this.write(d);
    return n;
  }
}

export const SESSION_TTL_MS = 30 * 60 * 1000;

// Opaque, unguessable session id.
export function newSessionId(): string {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const hmac = (key: string, data: string) => node<typeof import('node:crypto')>('node:crypto').createHmac('sha256', key).update(data).digest('hex');

// One business's secret for its customer keys, derived from the master secret (DESK_MEMORY_SECRET) until each business's
// own key lives in a key store (decision 0021).
export function businessSecret(master: string, business: string): string {
  if (!master || !business) throw new Error('businessSecret needs a master secret and a business id');
  return hmac(master, `desk-customer|${business}`);
}

// Key for a returning customer at one business: the business id, then an HMAC of the normalized phone digits or
// lower-cased email under that business's secret. A phone number is a small space, so without the secret the hash
// can't be guessed back; and the same caller at two businesses gets two unrelated keys.
export function customerKey(business: string, secret: string, kind: 'phone' | 'email', value: string): string {
  if (!business || !secret) throw new Error('customerKey needs a business id and its secret');
  const norm = kind === 'phone' ? value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '') : value.trim().toLowerCase();
  return `cust:${business}:${hmac(secret, `${kind}|${norm}`)}`;
}

export type SessionSnapshot = {
  v: 1; flow: string; savedAt: number;
  values: Record<string, string>;
  pending: { field: string; value: string; text: string; group?: { field: string; value: string }[] } | null;
  queue: { field: string; value: string }[];
  current: string; returnTo: string[];
  log: { who: 'agent' | 'user'; text: string }[];
};

export type CustomerRecord = { v: 1; flow: string; savedAt: number; values: Record<string, string> };
