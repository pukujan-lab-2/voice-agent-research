// The recording queue: a finished call's audio waits in a Redis stream until this server has saved it.
//
// Before, the voice agent posted the audio to /api/call-audio once when the call ended. If this server was restarting
// (a deploy), or the key store or Octo was down, the recording was gone: the agent kept no copy. Now the agent adds
// one message to the stream `copilot:call-ended` (speech/recording.py publish_recording) and goes on. This file reads
// the stream and saves each recording through the same /api/call-audio code as before, signature check included.
//
// How the stream keeps a recording safe:
//   - A consumer group (`recording-savers`) remembers which messages were handed out but not yet acknowledged. Redis
//     calls that list the pending list.
//   - A message is acknowledged and deleted only after the recording is saved (done()).
//   - A message whose save failed stays pending. Every pass, claim() takes back pending messages that have waited
//     RETRY_MS or longer, whoever read them first, so a server that died mid-save loses nothing.
//   - A message nothing will ever save (a bad signature, an unknown business) is dropped at once. One that keeps
//     failing is dropped when it is MAX_AGE_MS old, so call audio never waits in Redis without end.
import os from 'node:os';
import { createClient, RESP_TYPES } from '@redis/client';

export const STREAM = 'copilot:call-ended';
export const GROUP = 'recording-savers';
const RETRY_MS = 60_000;             // a failed save is tried again after this long
const BLOCK_MS = 5_000;              // how long one read waits for a new message
const MAX_AGE_MS = 24 * 3_600_000;   // a recording that still can't be saved after a day is dropped
const BATCH = 4;                     // recordings can be 40 MB each, so few at a time

export type Message = { id: string; fields: Record<string, Buffer> };

// The four stream operations the worker needs; redisQueue() is the real one, the tests bring their own.
export interface Queue {
  ensureGroup(): Promise<void>;
  read(consumer: string, blockMs: number): Promise<Message[]>;    // messages nobody has read yet
  claim(consumer: string, idleMs: number): Promise<Message[]>;    // pending messages older than idleMs
  done(id: string): Promise<void>;                                // acknowledge and delete
}

export type Recording = { room: string; call: string; sig: string; type: string; audio: Buffer };
// Saves one recording and answers with /api/call-audio's HTTP status.
export type Save = (r: Recording) => Promise<number>;
export type Outcome = 'saved' | 'dropped' | 'retry';

// When the message was added: a stream id is `<milliseconds>-<sequence>`.
const addedAt = (id: string) => Number(id.split('-')[0]);

// Tries to save one message's recording and says what to do with the message.
export async function handle(m: Message, save: Save, log: (msg: string) => void, now = Date.now(), maxAgeMs = MAX_AGE_MS): Promise<Outcome> {
  const text = (k: string) => m.fields[k]?.toString() ?? '';
  const room = text('room'), call = text('call'), audio = m.fields.audio;
  if (!room || !call || !audio?.byteLength) { log(`recording queue: dropped ${m.id}, not a recording`); return 'dropped'; }
  let status = 0, why = '';
  try { status = await save({ room, call, sig: text('sig'), type: text('type') || 'audio/ogg', audio }); }
  catch (e) { why = (e as Error).message; }
  if (status >= 200 && status < 300) { log(`recording queue: saved ${call} (${audio.byteLength} bytes)`); return 'saved'; }
  // 4xx is the server saying this recording will never be accepted; 429 only means "later".
  if (status >= 400 && status < 500 && status !== 429) { log(`recording queue: dropped ${call}, the server answered ${status}`); return 'dropped'; }
  const age = now - addedAt(m.id);
  if (age >= maxAgeMs) { log(`recording queue: dropped ${call} after ${Math.round(age / 3_600_000)} h of failed saves (${why || status})`); return 'dropped'; }
  log(`recording queue: could not save ${call} (${why || status}); it stays queued`);
  return 'retry';
}

// One pass: first the messages whose earlier save failed, then new ones. Returns how many it handled.
export async function pass(q: Queue, consumer: string, save: Save, log: (msg: string) => void, opts: { blockMs?: number; retryMs?: number; maxAgeMs?: number; now?: () => number } = {}): Promise<number> {
  const messages = [...await q.claim(consumer, opts.retryMs ?? RETRY_MS), ...await q.read(consumer, opts.blockMs ?? BLOCK_MS)];
  for (const m of messages) {
    if (await handle(m, save, log, (opts.now ?? Date.now)(), opts.maxAgeMs) !== 'retry') await q.done(m.id);
  }
  return messages.length;
}

// The stream on a real Redis. Replies come back as Buffers, because the audio field is raw bytes.
// connect() is separate so the worker holds the client, and can close it, while it is still trying to connect.
export type RedisQueue = Queue & { connect(): Promise<void>; close(): void };
export function redisQueue(url: string, onError: (e: Error) => void): RedisQueue {
  // Commands fail at once while Redis is away, instead of piling up; the worker's loop waits and tries again.
  const client = createClient({ url, RESP: 2, disableOfflineQueue: true, socket: { reconnectStrategy: tries => Math.min(500 * (tries + 1), 5_000) } });
  client.on('error', onError);
  const bin = client.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer });
  type Raw = { id: Buffer; message: Record<string, Buffer> };
  const message = (m: Raw): Message => ({ id: m.id.toString(), fields: { ...m.message } });
  return {
    async connect() { await client.connect(); },
    async ensureGroup() {
      // '0': the group starts at the stream's first message, so recordings queued before this server ever ran are read too.
      try { await client.xGroupCreate(STREAM, GROUP, '0', { MKSTREAM: true }); }
      catch (e) { if (!/BUSYGROUP/.test((e as Error).message)) throw e; }   // the group is already there
    },
    async read(consumer, blockMs) {
      // '>' asks for messages never handed to any consumer of the group.
      const streams = await bin.xReadGroup(GROUP, consumer, { key: STREAM, id: '>' }, { COUNT: BATCH, BLOCK: blockMs });
      return (streams ?? []).flatMap(s => (s.messages as Raw[]).map(message));
    },
    async claim(consumer, idleMs) {
      const r = await bin.xAutoClaim(STREAM, GROUP, consumer, idleMs, '0-0', { COUNT: BATCH });
      return r.messages.filter(m => m !== null).map(m => message(m as unknown as Raw));
    },
    async done(id) {
      await client.xAck(STREAM, GROUP, id);
      await client.xDel(STREAM, id);   // the audio leaves Redis as soon as it is saved
    },
    close() { try { client.destroy(); } catch { /* already closed */ } },
  };
}

// Runs the worker until stop() is called. Redis being away is not an error for the server: it says so once and keeps
// trying. One client is kept for the worker's whole life; it reconnects by itself, and the loop only waits and asks again.
export function startRecordingQueue(url: string, save: Save, log: (msg: string) => void): { stop(): void } {
  const consumer = os.hostname();
  let stopped = false, ready = false, queue: RedisQueue | null = null, lastError = '';
  const once = (msg: string) => { if (msg !== lastError) { lastError = msg; log(`recording queue: ${msg}`); } };
  const wait = (ms: number) => new Promise<void>(r => { setTimeout(r, ms).unref(); });
  void (async () => {
    while (!stopped) {
      try {
        if (!queue) {
          queue = redisQueue(url, e => once(`Redis: ${e.message}`));
          await queue.connect();
        }
        if (!ready) {
          await queue.ensureGroup();   // again after every failure: a Redis that lost its data has no group
          ready = true; lastError = '';
          log(`recording queue: reading ${STREAM} as ${consumer}`);
        }
        await pass(queue, consumer, save, log);
      } catch (e) {
        if (stopped) break;
        once(`${(e as Error).message}; trying again`);
        if (!ready) { queue?.close(); queue = null; }   // it never got as far as working: start over with a new client
        ready = false;
        await wait(5_000);
      }
    }
  })();
  return { stop() { stopped = true; queue?.close(); } };
}
