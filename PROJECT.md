# Website Copilot

<!-- continuity:project {"id":"website-copilot","protocol_version":"0.1.0-draft","schema":"project-continuity.project.v1","title":"Website Copilot"} -->

A lab for smart, scalable AI copilot agents that make websites and many everyday tasks easy, accessible and smart. The lab builds each part of an agent as a module with versions (voice stacks, reply and decision models, and later vision and video), tests every version, and lets the owner, a business or a visitor pick and choose. Voice is a first-class feature, not an add-on.

**The main goal: no one has to explore a website again.** A visitor shouldn't have to hunt through menus or click buttons. A voice call inside the website does everything for them: it finds things, answers questions, fills forms and takes the steps they ask for, within the confirmation rules below.

This repo is the main lab and builder: other apps, websites and customers adopt what it builds. The first product is the website copilot: an agent any business installs on its website with one line, that its visitors talk to like a live agent, by voice or text, in their own language, and later by phone. We run it for them as a service (agent as a service).

This file says what the project is and what is already decided. Decisions are recorded in [docs/decisions/](docs/decisions/); open work and its acceptance criteria live in GitHub issues. Chat logs and agent memory are not the record.

## What it does

A visitor opens the copilot on a site and talks to it. The copilot can:

- **Answer questions** from the business's own documents only, quoting the passage it used. If the documents don't answer it, it says so instead of guessing.
- **Walk the visitor through the site's forms**, one question at a time. It confirms each value as much as its risk calls for, lets the visitor go back and fix any answer, and submits for them once they have given the confirmations that step needs.
- **Check who a caller is** against the business's customer records (for example the last four SSN digits and a date of birth) before talking about their account. It never reads records out, and impostors are turned away.
- **Hand off to a person** when the visitor asks, or when a question needs personal advice.

## Who it is for

- **Businesses** (the customer): install it from a single script tag. They point it at their documents and forms and get a dashboard with transcripts and failures.
- **Visitors and callers** (their users): talk to it in any language, on desktop or phone, without an account.
- **Professionals inside a business** (staff desks, CRMs): use the same copilot to fill internal forms and look things up.

## How it is built

| Part | What it is | Where |
|---|---|---|
| Engine | Turns what the visitor said into one small decision (`fill`, `change`, `ask_again`, `off_scope`) that code then carries out. No free-form tool calls. | `copilot-engine/` |
| Widget | The script tag a site installs: call panel, mic, read-backs, highlights | `demo/live-site/widget/` |
| Backend | Holds the keys and runs search, judging, verification and logging | `demo/live-site/api.ts`, `server.ts` |
| Voice | LiveKit Agents, with open speech-to-text and text-to-speech models | in progress (see decisions) |
| Store | Octo DB: documents, passages, search, customer records, call logs | Octo workspace |
| Evals | Automated tests of grounding, ambiguity, spelling and speech errors, read-backs, and verification | `eval/`, `copilot-engine/tests/`, `demo/live-site/tests/` |
| Demo sites | Fictional businesses (a tax practice, an accounting CRM, a store) used to test and show the copilot | `demo/` |

## Rules that do not change without a new decision

1. **Open models only in the product.** The runtime uses open-weight models (LFM3, Qwen and similar) and the Jev decisions API. Claude may help us build, but it never runs inside a customer's copilot.
2. **Customer data stays in house.** Keys and records stay on our backend and in Octo. Nothing goes to a third-party speech or AI service a customer didn't approve. Browser speech APIs send audio to Google, so they are not allowed.
3. **Risk sets how much the copilot confirms** ([decision 0011](docs/decisions/0011-model-leads-risk-sets-confirmation.md)). Each field or action gets a risk score from 1 to 100. Low-risk steps just happen. From 56 up, code won't run the step until the visitor has said a recorded yes. Skips and submits from 76 up are asked twice. From 91 up (payments, cancellations, anything that can't be undone), a person approves first.
4. **Answers come from the documents, with a citation.** If the documents don't say it, the copilot says it doesn't know.
5. **Evals are fully automated.** No human spot-check step. Exact code checks are preferred over judge-model scores.
6. **Octo is the one store.** No local or static fallback copies.
7. **Demo sites are original.** Popular sites can be references, never copies of a real brand.
8. **Every module is swappable.** No model or module is hard-wired. Each one is a named option with versions that the owner, a business (from its allowed list and default) or a visitor picks per task, as [decision 0012](docs/decisions/0012-swappable-voice-stacks.md) does for voice. Only the models the active config picks are loaded; changing the config swaps them out, so the lab never runs every option at once. Decision models are #74; vision, video and audio understanding is #73.

## Status (2026-11-01)

| Area | State |
|---|---|
| Form filling with read-back (engine) | Works; tested offline and with LFM3 |
| Grounded answers on the IRS library | 100% of cited quotes real; vague questions are not clarified yet (0/100) |
| Caller verification | 24/24 scenarios, no impostor verified, no leaks |
| Voice | Uses browser speech today, which breaks the in-house rule. Being rebuilt on LiveKit Agents |
| Hosting | https://copilot.design-bakery.com, deployed when `production` moves (decision 0015, `deploy/`) |
| Size limits | A form of any size keeps the model's prompt at about 9,000 characters; call, rate-limit and resume state sits in capped stores (Octo for what must survive a restart); a business's config and its pages and forms live in Octo and are found by search. Limits and measurements: [docs/scaling-limits.md](docs/scaling-limits.md), decision 0017 |
| Phone calls | Planned (LiveKit SIP) |
| Multi-language | Voice: English on the default stack; English, Spanish, French, Italian, Portuguese, Hindi and Chinese on the `multilingual` stack (decision 0012); English on the one-model `lfm3-audio` stack (decision 0013). Text chat passes the visitor's words through |

<!-- pcm:github-progression:start -->
## GitHub-owned progression

GitHub Issues are required for PCM-governed project work and own task scope, acceptance, priority, ownership, dependencies, lifecycle and durable project progression. Merged default-branch history owns accepted code and normative/domain documents; PR checks and merge records own delivery facts. Checked-in PROJECT/CURRENT/TASK/checkpoint/handoff documents are mandatory versioned projections for task state, not a parallel authority. Local files, registries, context packs and chat are ephemeral execution aids. Domain-document ownership stays with the target project.

Every issue progress update MUST link the leaf child issue that owns the work, its parent ancestry and dependencies (or explicitly none). A top-level deliverable identifies itself as the leaf and says parent: none. Create one child per independently deliverable scope, never one per comment. Record task ID, primary writer and branch on the issue before creating its repository projection. Re-read live issues and relevant source revisions before resuming; the issue verifier checks identity/status, not semantic agreement.

Authorized owner/user direction can revise intent: record it on the owning GitHub issue with a correction/supersession link before dependent work. It cannot alter observed CI/merge facts or waive required gates. Stale projections yield to their field's authority. If direction, ownership or evidence conflicts remain unresolved, pause affected work and record uncertainty; continue independent safe work. One primary writer owns each task branch/checkpoint stream. Coordinate shared-document edits through linked issues/PRs, re-read the current base and reconcile concurrent changes; never force-push or overwrite another writer. Issue prose is not an atomic lock.

Label observed results, repository/external evidence, agent reports and inference separately. Preserve contradictory evidence with source/revision and mark conclusions disputed or unknown until resolved. Append correction/supersession evidence; never rewrite checkpoint history. An upstream correction MUST identify affected descendants and assumptions on their issues; pause, re-plan and revalidate dependent work before resuming. Follow explicit parent/dependency links within the affected scope; cycles or unknown lineage block affected claims. No graph database, local canonical ledger or autonomous polling agent is required.

Before every push, synchronize relevant docs and task/checkpoint projections, CURRENT/HANDOFF when affected, and reviewed catalog/generated index. Record leaf/parent/dependency links, source issue/comment revision, as-of status, evidence, blockers and next action. Commit product/docs first; `continuity checkpoint` then commits and synchronously pushes the checkpoint with a stable request ID. After every successful push, manually publish a leaf issue receipt keyed by request ID and exact pushed SHA, linking changed docs/checkpoint, PR, tests and pending gates; add a linked parent progression update. Retry a missing receipt without another checkpoint/push; inspect for the same key before posting. --receipt-repo and --receipt-issue are opt-in and still require a proven lookup; omit them and the receipt stays manual. Automatic issue-comment synchronization is not implemented; issue #67 is CLOSED (owner freeze decision 2026-09-25) and its unmet guaranteed-completion acceptance transferred to #110.

Required CI and GitHub auto-merge are mandatory. Arm auto-merge only after the increment's final push: a later push races the merge window and strands outside accepted history. Verify protection, required reviews/checks on the exact current-base or merge-queue candidate, and auto-merge; missing, failed, skipped, stale or unverified gates fail closed: no completion or cleanup. After CI/merge, append the exact check results, PR/merge SHA and live issue status to the leaf and link the parent update; fetch and verify accepted history. Reconcile material doc/status corrections in a new synchronized increment. Receipt-only transitions need no recursive doc commit: docs retain an explicit as-of/pending state and point to the live issue. Never label local-only or merely pushed work delivered. Preserve unsafe resources and keep incomplete issues open.
<!-- pcm:github-progression:end -->

## Repository checks

`npm run check` runs lint (Biome), the typecheck (TypeScript, strict), the orphan check (Knip: unused files, exports and dependencies) and the engine tests. Python is linted with Ruff. CI runs the same steps on every pull request.
