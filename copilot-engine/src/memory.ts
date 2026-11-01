// Memory for the desk: call resume (short-lived session snapshots) and opt-in returning-customer records.
// Stores are pluggable: an in-memory Map, a JSON file (tests), or anything that implements Store (an Octo
// workspace store later). Customer records are keyed by a salted hash of the normalized phone or email, so the
// store never holds a contact detail as a key.
// No top-level Node imports: the desk also runs in the browser (the live site), where only the Store types and
// newSessionId are used. The Node-only parts (the file store, the customer key's hash) load Node's modules when called.
const node = <T>(id: string): T => (globalThis as unknown as { process: { getBuiltinModule(id: string): T } }).process.getBuiltinModule(id);
const fs = () => node<typeof import('node:fs')>('node:fs');

export interface Store {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

type Entry = { v: unknown; exp?: number };

export class MemoryStore implements Store {
  private m = new Map<string, Entry>();
  private now: () => number;
  constructor(now: () => number = Date.now) { this.now = now; }
  async get(key: string) {
    const e = this.m.get(key);
    if (!e) return undefined;
    if (e.exp !== undefined && e.exp <= this.now()) { this.m.delete(key); return undefined; }
    return structuredClone(e.v);
  }
  async set(key: string, value: unknown, ttlMs?: number) { this.m.set(key, { v: structuredClone(value), exp: ttlMs ? this.now() + ttlMs : undefined }); }
  async delete(key: string) { this.m.delete(key); }
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
}

export const SESSION_TTL_MS = 30 * 60 * 1000;

// Opaque, unguessable session id.
export function newSessionId(): string {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Key for a returning customer: hash of the normalized phone digits or lower-cased email.
export function customerKey(kind: 'phone' | 'email', value: string, salt = globalThis.process?.env?.DESK_MEMORY_SALT ?? 'desk-v2'): string {
  const norm = kind === 'phone' ? value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '') : value.trim().toLowerCase();
  return 'cust:' + node<typeof import('node:crypto')>('node:crypto').createHash('sha256').update(`${salt}|${kind}|${norm}`).digest('hex');
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
