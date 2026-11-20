// The recording queue's worker (recording-queue.ts) against a stand-in stream that keeps a pending list the way a Redis
// consumer group does: a message read but not finished stays pending and can be claimed again once it has waited.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@redis/client';
import { handle, pass, redisQueue, STREAM, type Message, type Queue, type Recording } from '../recording-queue.ts';

function stream() {
  let t = 1_700_000_000_000, seq = 0;
  const fresh: Message[] = [], pending = new Map<string, { m: Message; since: number }>(), finished: string[] = [];
  const q: Queue = {
    async ensureGroup() {},
    async read() { const out = fresh.splice(0); for (const m of out) pending.set(m.id, { m, since: t }); return out; },
    async claim(_consumer, idleMs) {
      const out = [...pending.values()].filter(p => t - p.since >= idleMs);
      for (const p of out) p.since = t;
      return out.map(p => p.m);
    },
    async done(id) { pending.delete(id); finished.push(id); },
  };
  const add = (fields: Record<string, string>) => {
    const m = { id: `${t}-${seq++}`, fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, Buffer.from(v)])) };
    fresh.push(m);
    return m;
  };
  return { q, add, pending, finished, now: () => t, later: (ms: number) => { t += ms; } };
}

const recording = { room: 'call-0a1b2c3d.clinic-test', call: 'call-0001-abcdef', sig: 'abc', type: 'audio/ogg', audio: 'OggS fake audio' };
const quiet = () => {};

test('a saved recording is finished, and the save gets every field of the message', async () => {
  const s = stream(), saved: Recording[] = [];
  s.add(recording);
  assert.equal(await pass(s.q, 'web-1', async r => { saved.push(r); return 200; }, quiet, { now: s.now }), 1);
  assert.equal(s.pending.size, 0);
  assert.equal(s.finished.length, 1);
  assert.deepEqual({ ...saved[0], audio: saved[0].audio.toString() }, recording);
});

test('a recording whose save fails stays queued and is saved on a later pass', async () => {
  const s = stream();
  s.add(recording);
  let up = false;
  const save = async () => { if (!up) throw new Error('key store unreachable'); return 200; };
  await pass(s.q, 'web-1', save, quiet, { retryMs: 60_000, now: s.now });
  assert.equal(s.pending.size, 1, 'it is still pending');
  await pass(s.q, 'web-1', save, quiet, { retryMs: 60_000, now: s.now });
  assert.equal(s.pending.size, 1, 'and is not tried again before the retry time');
  up = true;
  s.later(60_000);
  await pass(s.q, 'web-2', save, quiet, { retryMs: 60_000, now: s.now });
  assert.equal(s.pending.size, 0, 'another consumer claims and saves it');
  assert.equal(s.finished.length, 1);
});

test('a 5xx or 429 answer keeps the recording; a 4xx answer drops it', async () => {
  const s = stream();
  const m = s.add(recording);
  for (const status of [502, 503, 429]) assert.equal(await handle(m, async () => status, quiet, s.now()), 'retry', String(status));
  for (const status of [400, 403, 404, 413]) assert.equal(await handle(m, async () => status, quiet, s.now()), 'dropped', String(status));
  assert.equal(await handle(m, async () => 200, quiet, s.now()), 'saved');
});

test('a recording that still fails after the longest wait is dropped, and says so', async () => {
  const s = stream(), lines: string[] = [];
  const m = s.add(recording);
  const day = 24 * 3_600_000;
  assert.equal(await handle(m, async () => 503, quiet, s.now() + day - 1, day), 'retry');
  assert.equal(await handle(m, async () => 503, l => lines.push(l), s.now() + day, day), 'dropped');
  assert.match(lines[0], /dropped call-0001-abcdef after 24 h/);
});

test('a message that is not a recording is dropped without calling the save', async () => {
  const s = stream();
  let calls = 0;
  for (const fields of [{ room: recording.room, call: recording.call }, { ...recording, audio: '' }, { ...recording, room: '' }]) {
    assert.equal(await handle(s.add(fields), async () => { calls++; return 200; }, quiet), 'dropped');
  }
  assert.equal(calls, 0);
});

// The same worker on a real Redis, with a recording too big for one network packet. CI starts a Redis for the job and sets
// RECORDING_QUEUE_TEST_URL (.github/workflows/ci.yml); without it this is skipped.
const REDIS = process.env.RECORDING_QUEUE_TEST_URL;
test('on a real Redis a 3 MB recording survives a failed save and is saved by another consumer', { skip: !REDIS && 'RECORDING_QUEUE_TEST_URL is not set' }, async () => {
  const audio = Buffer.from(Array.from({ length: 3 * 1024 * 1024 }, (_, i) => (i * 31 + (i >> 8)) & 255));
  const writer = createClient({ url: REDIS, RESP: 2 });
  await writer.connect();
  const q = redisQueue(REDIS!, () => {});
  try {
    await writer.del(STREAM);
    await writer.xAdd(STREAM, '*', { room: recording.room, call: recording.call, sig: recording.sig, type: recording.type, audio });
    await q.connect();
    await q.ensureGroup();
    await q.ensureGroup();   // the group is there already: every restart of the site takes this path
    const seen: Recording[] = [];
    assert.equal(await pass(q, 'web-1', async r => { seen.push(r); return 503; }, quiet, { blockMs: 500 }), 1);
    assert.equal(await pass(q, 'web-1', async () => 200, quiet, { blockMs: 100 }), 0, 'not tried again before the retry time');
    assert.equal(await pass(q, 'web-2', async r => { seen.push(r); return 200; }, quiet, { blockMs: 100, retryMs: 0 }), 1);
    for (const r of seen) {
      assert.ok(r.audio.equals(audio), 'the audio comes back byte for byte');
      assert.deepEqual([r.room, r.call, r.sig, r.type], [recording.room, recording.call, recording.sig, recording.type]);
    }
    assert.equal(await writer.xLen(STREAM), 0, 'a saved recording leaves Redis');
    assert.equal((await writer.xPending(STREAM, 'recording-savers')).pending, 0);
  } finally {
    q.close();
    writer.destroy();
  }
});

// Property tests: many random histories of the same worker code. Each history has recordings arriving at random times, two
// site processes taking turns, the site going down and coming back, and acknowledgements that fail (Redis away, or the
// process dying after the save). formal/recording_queue.tla checks the same rules on a model; this checks them on pass().
function random(seed: number) {   // mulberry32: the same seed gives the same history, so a failure can be replayed
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

async function history(seed: number, opts: { workers: string[]; reverse?: boolean }) {
  const rnd = random(seed), s = stream();
  const calls = Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, i) => ({ call: `call-${seed}-${i}`, bad: rnd() < 0.25 }));
  if (opts.reverse) calls.reverse();
  const waiting = [...calls], bad = new Set(calls.filter(c => c.bad).map(c => c.call));
  const saved = new Map<string, number>(), finishedCalls = new Set<string>(), idToCall = new Map<string, string>();
  let siteUp = true, ackWorks = true;
  const save = async (r: Recording) => {
    if (!siteUp) return rnd() < 0.5 ? 503 : Promise.reject(new Error('unreachable'));
    if (bad.has(r.call)) return 403;
    saved.set(r.call, (saved.get(r.call) ?? 0) + 1);
    return 200;
  };
  const q: Queue = { ...s.q, async done(id) { if (!ackWorks) throw new Error('Redis away'); finishedCalls.add(idToCall.get(id)!); await s.q.done(id); } };
  const check = (when: string) => {
    for (const c of finishedCalls) assert.ok(saved.has(c) || bad.has(c), `seed ${seed}, ${when}: ${c} was acknowledged without being saved or refused`);
    for (const c of bad) assert.ok(!saved.has(c), `seed ${seed}, ${when}: refused recording ${c} was saved`);
  };
  const turn = async (worker: string) => { try { await pass(q, worker, save, quiet, { retryMs: 60_000, now: s.now }); } catch { /* the pass died; what it held stays pending */ } };
  for (let step = 0; step < 60; step++) {
    const r = rnd();
    if (r < 0.2 && waiting.length) { const c = waiting.shift()!; idToCall.set(s.add({ ...recording, call: c.call }).id, c.call); }
    else if (r < 0.3) siteUp = !siteUp;
    else if (r < 0.4) ackWorks = !ackWorks;
    else if (r < 0.6) s.later(Math.floor(rnd() * 90_000));
    else await turn(opts.workers[Math.floor(rnd() * opts.workers.length)]);
    check(`step ${step}`);
  }
  // The world settles: everything is up, the remaining calls end, and the workers keep going.
  siteUp = true; ackWorks = true;
  for (const c of waiting.splice(0)) idToCall.set(s.add({ ...recording, call: c.call }).id, c.call);
  for (let i = 0; i < 4; i++) { s.later(60_000); for (const w of opts.workers) await turn(w); }
  check('settled');
  for (const c of calls) if (!c.bad) assert.ok(saved.has(c.call), `seed ${seed}: ${c.call} was never saved`);
  assert.equal(s.pending.size, 0, `seed ${seed}: messages are still pending after the world settled`);
  assert.equal(s.finished.length, calls.length, `seed ${seed}: every message is acknowledged exactly once`);
  return { saved: [...saved.keys()].sort(), twice: [...saved.values()].some(n => n > 1) };
}

test('in 500 random histories no recording is acknowledged unsaved, and every good one is saved once things settle', async () => {
  let twice = 0;
  for (let seed = 1; seed <= 500; seed++) if ((await history(seed, { workers: ['web-1', 'web-2'] })).twice) twice++;
  // At-least-once delivery: some histories must save a recording twice, or the failed acknowledgements were never exercised.
  assert.ok(twice > 0, 'no history saved a recording twice: the acknowledgement failures did nothing');
});

test('what gets saved does not depend on how many workers there are or the order the calls ended in', async () => {
  for (let seed = 1; seed <= 200; seed++) {
    const two = await history(seed, { workers: ['web-1', 'web-2'] });
    assert.deepEqual((await history(seed, { workers: ['web-1'] })).saved, two.saved, `seed ${seed}: one worker`);
    assert.deepEqual((await history(seed, { workers: ['web-1', 'web-2', 'web-3'], reverse: true })).saved, two.saved, `seed ${seed}: three workers, reversed`);
  }
});
