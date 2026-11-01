// How much memory the backend's per-call state takes. Each "call" is a visitor from its own address who starts a call and
// fails one verification, which is what creates a call entry, a failure record and a rate-limit record.
// Usage: node --expose-gc --no-warnings tests/state-load.ts [calls ...]   (default 10 1000 100000)
import { createApi } from '../api.ts';

globalThis.fetch = (async () => new Response(JSON.stringify({ rows: [] }), { status: 200 })) as unknown as typeof fetch;
const api = createApi({ OPENROUTER_JEV_KEY: 'k', OCTO_KEY: 'k', OCTO_WORKSPACE: 'ws', OCTO_BASE: 'http://octo.test/api', STATE_STORE: 'memory', RATE_PER_MIN: '1000000' } as never,
  { matchNames: async (_said, names) => names.map(() => false) });
const gc = (globalThis as { gc?: () => void }).gc;
if (!gc) throw new Error('run with --expose-gc');
const sizes = process.argv.slice(2).map(Number).filter(Boolean);
console.log('| calls | heap used by call state (MB) |');
console.log('|---|---|');
const call = (ip: string) => api.handle(new Request('http://x/api/verify', { method: 'POST', body: JSON.stringify({ name: 'Ann Lee', dob: '1980-01-01', ssn4: '1234', zip: '12345' }) }), ip);
for (let i = 0; i < 200; i++) await call(`192.168.0.${i}`); // warm up the JIT and the first allocations
let made = 0;
for (const n of sizes.length ? sizes : [10, 1000, 100_000]) {
  gc(); const before = process.memoryUsage().heapUsed;
  for (; made < n; made++) {
    const ip = `10.${(made >> 16) & 255}.${(made >> 8) & 255}.${made & 255}`;
    await call(ip);
  }
  gc(); const after = process.memoryUsage().heapUsed;
  console.log(`| ${n} | ${((after - before) / 1e6).toFixed(1)} |`);
}
