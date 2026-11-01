// File one issue per failure pattern from the newest flagged turns in Octo (decision 0005: the flags are plain code).
// For each rule with recent flags: open an issue titled "Flagged turns: <pattern>" if none is open; if one is open,
// comment only with flags it does not list yet. It changes no code and moves no branch.
// Run: node eval/propose.ts [--days 7] [--repo owner/name] [--only <rule>] [--dry-run]     Needs Octo keys and the gh CLI signed in.
import { execFileSync } from 'node:child_process';
import { octoSql } from './lib/corpus.ts';
import { flagMarker, groupByRule, issueBody, titleFor, type Row } from './lib/patterns.ts';

const arg = (k: string, d = '') => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const repo = arg('--repo', 'Pukujan-lab/voice-agent-research'), dry = process.argv.includes('--dry-run');
const gh = (...a: string[]) => execFileSync('gh', a, { encoding: 'utf8' });

const rows = (await octoSql(`select id, call_id, turn_n, rule, text, evidence, call_at::text from flagged_turns where last_seen > now() - ($1 || ' days')::interval order by last_seen desc limit 500`, [arg('--days', '7')])) as Row[];
// The open issues, listed rather than searched: GitHub's search index lags a new issue by a minute or more.
const open = JSON.parse(gh('issue', 'list', '--repo', repo, '--state', 'open', '--limit', '300', '--json', 'number,title,body,comments')) as { number: number; title: string; body: string; comments: { body: string }[] }[];
// GitHub's list can answer with empty pages while it is degraded; filing then would duplicate every pattern.
if (!open.length && Number(gh('api', `repos/${repo}`, '--jq', '.open_issues_count')) > 0) throw new Error('GitHub lists no open issues although the repository has some; try again later');
for (const [rule, flags] of groupByRule(rows)) {
  if (arg('--only') && rule !== arg('--only')) continue;
  const title = titleFor(rule);
  const existing = open.find(i => i.title === title);
  if (!existing) {
    console.log(`${dry ? 'would open' : 'opening'}: ${title} (${flags.length} flags)`);
    if (!dry) console.log(gh('issue', 'create', '--repo', repo, '--title', title, '--body', issueBody(rule, flags)).trim());
    continue;
  }
  const known = `${existing.body}\n${existing.comments.map(c => c.body).join('\n')}`;
  const fresh = flags.filter(f => !known.includes(flagMarker(f.id)));
  console.log(`${existing.number} is open for ${rule}: ${fresh.length} new flag(s)`);
  if (fresh.length && !dry) gh('issue', 'comment', String(existing.number), '--repo', repo, '--body', `${fresh.length} more flagged turn(s) for this pattern:\n\n${fresh.slice(0, 20).map(f => `- ${flagMarker(f.id)} call ${f.call_id.slice(0, 8)}, turn ${f.turn_n ?? 'call'}: ${f.text}\n  - ${f.evidence}`).join('\n')}`);
}
if (!rows.length) console.log('no flagged turns in the window');
