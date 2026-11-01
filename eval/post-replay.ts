// Post a live replay's result on the standing issue and open an issue for every rule whose failure count rose.
// Run: node eval/post-replay.ts <results.json>     Needs the gh CLI signed in (GH_TOKEN), and in env:
//   STANDING_ISSUE  the standing issue's number        GH_REPO  owner/name        RUN_URL  the workflow run's link (optional)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { comment, lastCounts, rises, type Run } from './lib/standing.ts';

const gh = (...a: string[]) => execFileSync('gh', a, { encoding: 'utf8' });
const run: Run = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const standing = process.env.STANDING_ISSUE!, repo = process.env.GH_REPO!;
const comments: string[] = gh('api', `repos/${repo}/issues/${standing}/comments`, '--paginate', '--jq', '.[].body | @json').split('\n').filter(Boolean).map(l => JSON.parse(l));
const rose = rises(lastCounts(comments), run.perRule);

const links: string[] = [];
for (const r of rose) {
  const title = `Replay failures rose for ${r.rule}: ${r.from} to ${r.to}`;
  const mine = run.failures.filter(f => f.rule === r.rule);
  const body = `The live replay (${process.env.RUN_URL ?? 'a scheduled run'}) found more failing cases for the rule \`${r.rule}\` than the run before: ${r.from} before, ${r.to} now. Standing issue: #${standing}. Parent: #88.\n\n${mine.map(f => `- \`${f.status}\` "${f.said}": ${f.why}`).join('\n')}\n\nThis was opened by the replay workflow; a coding session takes it through a pull request.`;
  const open = JSON.parse(gh('issue', 'list', '--repo', repo, '--state', 'open', '--search', `"Replay failures rose for ${r.rule}" in:title`, '--json', 'number,title')) as { number: number; title: string }[];
  const dup = open.find(i => i.title.startsWith(`Replay failures rose for ${r.rule}:`));
  if (dup) { gh('issue', 'comment', String(dup.number), '--repo', repo, '--body', body); links.push(`#${dup.number}`); }
  else links.push(gh('issue', 'create', '--repo', repo, '--title', title, '--body', body).trim());
}
gh('issue', 'comment', standing, '--repo', repo, '--body', comment(run, rose, links));
console.log(`posted on #${standing}; ${rose.length} rule(s) rose`);
