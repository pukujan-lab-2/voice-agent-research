// A voice call's audio (decision 0021 settlement 3, #130): the voice agent records the call from the LiveKit room (the
// caller on the left channel, the copilot on the right, Ogg/Opus), and the site locks it with the call's key
// (call-vault.ts) before it reaches Octo. The locked bytes are an Octo file in the business's workspace; the row beside it
// keeps the call's data key, locked by the business key, and the IV. Without that row the file can't be opened. Recording is
// on unless the business's config says `recording: { audio: false }`. Playback is only through a grant (#131).
// No Node imports: it also runs in a Pages Function.
import type { CallVault } from './call-vault.ts';
import type { Sql } from './octo-store.ts';

// Octo's file store, in one workspace.
export interface Files {
  upload(name: string, mimeType: string, data: Uint8Array): Promise<string>;
  download(id: string): Promise<Uint8Array>;
  remove(id: string): Promise<void>;
}

export const MAX_AUDIO_BYTES = 40 * 1024 * 1024;

// Whether a business records its voice calls: on unless its config turns it off.
export const recordsAudio = (config: object | null | undefined): boolean =>
  (config as { recording?: { audio?: unknown } } | null | undefined)?.recording?.audio !== false;

export class CallAudio {
  private sql: Sql;
  private files: Files;
  private vault: CallVault;
  private table: string;
  private ready?: Promise<void>;
  constructor(sql: Sql, files: Files, vault: CallVault, opts: { table?: string } = {}) {
    this.table = opts.table ?? 'copilot_call_audio';
    if (!/^[a-z_][a-z0-9_]{0,40}$/.test(this.table)) throw new Error('bad table name');
    this.sql = sql; this.files = files; this.vault = vault;
  }

  private ensure(): Promise<void> {
    this.ready ??= (async () => {
      await this.sql(`create table if not exists ${this.table} (business text not null, call text not null, at timestamptz not null default now(), file_id text not null, mime text not null, bytes int not null, key text not null, iv text not null, primary key (business, call))`);
      await this.sql(`create index if not exists ${this.table}_age on ${this.table} (business, at)`);
    })().catch(e => { this.ready = undefined; throw e; });
    return this.ready;
  }

  // Locks a call's audio and stores it. A second recording of the same call replaces the first.
  async save(business: string, call: string, audio: Uint8Array, mime: string): Promise<{ fileId: string; bytes: number }> {
    if (audio.byteLength > MAX_AUDIO_BYTES) throw new Error(`audio over ${MAX_AUDIO_BYTES} bytes`);
    await this.ensure();
    const locked = await this.vault.sealBytes(business, call, audio);
    const fileId = await this.files.upload(`call-audio-${business}-${call}.locked`, 'application/octet-stream', locked.ct);
    const old = await this.sql(`select file_id from ${this.table} where business = $1 and call = $2`, [business, call]) as { file_id: string }[];
    await this.sql(`insert into ${this.table} (business, call, file_id, mime, bytes, key, iv) values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (business, call) do update set at = now(), file_id = excluded.file_id, mime = excluded.mime, bytes = excluded.bytes, key = excluded.key, iv = excluded.iv`,
      [business, call, fileId, mime, audio.byteLength, locked.key, locked.iv]);
    for (const o of old) await this.files.remove(o.file_id).catch(() => {});
    return { fileId, bytes: audio.byteLength };
  }

  // The call's audio, opened, if it is within the business's retention. Only a grant may call this (#131).
  async open(business: string, call: string, days: number): Promise<{ audio: Uint8Array; mime: string } | null> {
    await this.ensure();
    const [r] = await this.sql(`select file_id, mime, key, iv from ${this.table} where business = $1 and call = $2 and at > now() - $3::int * interval '1 day'`,
      [business, call, days]) as { file_id: string; mime: string; key: string; iv: string }[];
    if (!r) return null;
    return { audio: await this.vault.openBytes(business, call, { key: r.key, iv: r.iv, ct: await this.files.download(r.file_id) }), mime: r.mime };
  }

  async businesses(): Promise<string[]> {
    await this.ensure();
    return (await this.sql(`select distinct business from ${this.table}`) as { business: string }[]).map(r => r.business);
  }

  // Deletes a business's recordings older than its retention, files first; returns how many went.
  async sweep(business: string, days: number): Promise<number> {
    await this.ensure();
    const old = await this.sql(`select call, file_id from ${this.table} where business = $1 and at <= now() - $2::int * interval '1 day'`, [business, days]) as { call: string; file_id: string }[];
    let n = 0;
    for (const o of old) {
      // The row holds the only copy of the data key: once it is gone the file can't be opened, even if removing it failed.
      await this.files.remove(o.file_id).catch(() => {});
      n += (await this.sql(`delete from ${this.table} where business = $1 and call = $2 and file_id = $3 returning call`, [business, o.call, o.file_id])).length;
    }
    return n;
  }
}
