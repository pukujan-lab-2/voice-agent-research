// Flagged turns live in Octo (decision 0004), in the chatbots workspace's `flagged_turns` table. A flag's key is the
// call, the turn and the rule, so mining the same spans twice updates a row instead of adding one.
import { createHash } from 'node:crypto';
import { octoSql } from './corpus.ts';
import type { Flag } from './rules.ts';

const DDL = `create table if not exists flagged_turns (
  id text primary key, call_id text not null, turn_id text, turn_n int, rule text not null, text text not null, evidence text not null,
  call_at timestamptz, first_seen timestamptz not null default now(), last_seen timestamptz not null default now()
)`;
export const flagId = (f: Flag) => createHash('sha1').update(`${f.call}|${f.turn ?? ''}|${f.rule}`).digest('hex').slice(0, 20);

export async function storeFlags(flags: { flag: Flag; callAt: string }[]) {
  await octoSql(DDL);
  for (const { flag: f, callAt } of flags) {
    await octoSql(`insert into flagged_turns (id, call_id, turn_id, turn_n, rule, text, evidence, call_at) values ($1,$2,$3,$4,$5,$6,$7,$8)
      on conflict (id) do update set last_seen = now(), evidence = excluded.evidence, text = excluded.text`,
    [flagId(f), f.call, f.turn, f.n, f.rule, f.text, f.evidence, callAt]);
  }
}
