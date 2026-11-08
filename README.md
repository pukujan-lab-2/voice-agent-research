# Voice & Chat Agent Research

See [PROJECT.md](PROJECT.md) for what this product is and [docs/decisions](docs/decisions/) for what is decided.

<!-- pcm:github-progression:start -->
## GitHub-owned progression

GitHub Issues are required for PCM-governed project work and own task scope, acceptance, priority, ownership, dependencies, lifecycle and durable project progression. Merged default-branch history owns accepted code and normative/domain documents; PR checks and merge records own delivery facts. Checked-in PROJECT/CURRENT/TASK/checkpoint/handoff documents are mandatory versioned projections for task state, not a parallel authority. Local files, registries, context packs and chat are ephemeral execution aids. Domain-document ownership stays with the target project.

Every issue progress update MUST link the leaf child issue that owns the work, its parent ancestry and dependencies (or explicitly none). A top-level deliverable identifies itself as the leaf and says parent: none. Create one child per independently deliverable scope, never one per comment. Record task ID, primary writer and branch on the issue before creating its repository projection. Re-read live issues and relevant source revisions before resuming; the issue verifier checks identity/status, not semantic agreement.

Authorized owner/user direction can revise intent: record it on the owning GitHub issue with a correction/supersession link before dependent work. It cannot alter observed CI/merge facts or waive required gates. Stale projections yield to their field's authority. If direction, ownership or evidence conflicts remain unresolved, pause affected work and record uncertainty; continue independent safe work. One primary writer owns each task branch/checkpoint stream. Coordinate shared-document edits through linked issues/PRs, re-read the current base and reconcile concurrent changes; never force-push or overwrite another writer. Issue prose is not an atomic lock.

Label observed results, repository/external evidence, agent reports and inference separately. Preserve contradictory evidence with source/revision and mark conclusions disputed or unknown until resolved. Append correction/supersession evidence; never rewrite checkpoint history. An upstream correction MUST identify affected descendants and assumptions on their issues; pause, re-plan and revalidate dependent work before resuming. Follow explicit parent/dependency links within the affected scope; cycles or unknown lineage block affected claims. No graph database, local canonical ledger or autonomous polling agent is required.

Before every push, synchronize relevant docs and task/checkpoint projections, CURRENT/HANDOFF when affected, and reviewed catalog/generated index. Record leaf/parent/dependency links, source issue/comment revision, as-of status, evidence, blockers and next action. Commit product/docs first; `continuity checkpoint` then commits and synchronously pushes the checkpoint with a stable request ID. After every successful push, manually publish a leaf issue receipt keyed by request ID and exact pushed SHA, linking changed docs/checkpoint, PR, tests and pending gates; add a linked parent progression update. Retry a missing receipt without another checkpoint/push; inspect for the same key before posting. --receipt-repo and --receipt-issue are opt-in and still require a proven lookup; omit them and the receipt stays manual. Automatic issue-comment synchronization is not implemented; issue #67 is CLOSED (owner freeze decision 2026-09-25) and its unmet guaranteed-completion acceptance transferred to #110.

Required CI and GitHub auto-merge are mandatory. Arm auto-merge only after the increment's final push: a later push races the merge window and strands outside accepted history. Verify protection, required reviews/checks on the exact current-base or merge-queue candidate, and auto-merge; missing, failed, skipped, stale or unverified gates fail closed: no completion or cleanup. After CI/merge, append the exact check results, PR/merge SHA and live issue status to the leaf and link the parent update; fetch and verify accepted history. Reconcile material doc/status corrections in a new synchronized increment. Receipt-only transitions need no recursive doc commit: docs retain an explicit as-of/pending state and point to the live issue. Never label local-only or merely pushed work delivered. Preserve unsafe resources and keep incomplete issues open.
<!-- pcm:github-progression:end -->

<!-- pcm:issue-log-format:start -->
## Issue log format (issue-log-format 1.3.0)

<!-- pcm:policy {"id":"issue-log-format","policy_version":"1.3.0","protocol_version":"0.1.0-draft"} -->

**The issue-log shape is OIO's.** The canonical shape — required fields, lifecycle status, typed relations, and filer provenance — is defined by [`Pukujan/observational-issue-ops`](https://github.com/Pukujan/observational-issue-ops): [`ontology/ISSUE_LOG_ONTOLOGY.md`](https://github.com/Pukujan/observational-issue-ops/blob/main/ontology/ISSUE_LOG_ONTOLOGY.md) is the semantic definition and [`.github/ISSUE_TEMPLATE/observational-issue.yml`](https://github.com/Pukujan/observational-issue-ops/blob/main/.github/ISSUE_TEMPLATE/observational-issue.yml) is the intake form. PCM does not define a competing form; fill OIO's shape and apply the writing rules below. **PCM owns the writing:** plain language, claim-first evidence, no unexplained acronym or bare identifier on first use, diagrams (mermaid), the reader-first pull-request shape, checkpoint and CURRENT projections, and the closing-keyword rule. **What an investigation record must say** (incidents, failures, research, design issues whose cause is not yet proven): numbered symptoms, each with a bold short name and one observable sentence; hypotheses with **Status** (unverified / confirmed / refuted / inconclusive), **Would confirm**, **Would refute**, and **Experiment**; evidence with provenance that names the hypothesis it supports or undercuts, plus a **Counter-signal** when one exists; an honest caveat; problems kept separate from gaps; and a **Proposal** labelled *(proposal)* that says none of it exists unless named as existing. That is guidance on what the record must say, not a second form schema. **Pull requests open reader-first:** problem and consequence, what changes, how to verify, and what stays unchanged; lineage links; evidence and one next action; long logs collapsed or linked; progress-only references use `Refs #<number>`, and a native closing keyword (`Closes`/`Fixes`/`Resolves #<number>`) only when the merge should resolve the issue. **Diagrams (mermaid):** when a record describes a flow with 4+ ordered steps or 2+ branches, add a fenced mermaid diagram *and* keep an adjacent text list or table so the record survives render failure; default to `graph TD` (vertical) because wide `LR` flows shrink to illegible strips on phones — reserve `LR` for 4 or fewer short nodes; cap 8 nodes and 6-word labels; wrap diagrams that may exceed the container width inside `<details>` (GitHub mounts the renderer lazily on expand); preview the rendered diagram before publishing (broken syntax shows a visible parse error) and never cite renderer URLs as standalone sources. **Readability rules:** explain a reference before it carries weight; the owning rule is linked from [AGENTS.md](AGENTS.md). Write evidence as the claim first, numbers as support (“nothing this change could break failed (263 tests, same six machine-environment failures as before)”), never bare counts; no unexplained acronym or bare identifier on first use in any tier; PR openings and checkpoint Completed/Next lines start with one problem sentence a newcomer can follow; the rule set applies to CURRENT projections and checkpoint entries exactly as to issue logs. No private absolute paths or secrets; link rather than paste long logs. See `docs/ISSUE_LOG_FORMAT.md` for the full format, exemplar, and examples.
<!-- pcm:issue-log-format:end -->

Research notes for building a repeatable **chat + voice agent factory**: one shared engine, many client bots, built from a client's business data by Claude.

Collected 2026-10-28/29. Star counts, commit dates and licenses were checked live against GitHub and Hugging Face on that date. Re-check before relying on them (`scripts/check_licenses.sh`).

> **Not legal advice.** License notes reflect what each project *declares*. Have a lawyer review the final stack before selling it.

## Docs travel with the code

A pull request that changes code must also update a `README.md` (any folder's) or a file under `docs/`, or `AGENTS.md` / `HANDOFF.md`. CI enforces it (`.github/workflows/docs-check.yml`, `scripts/check-docs-updated.mjs`). Other `.md` files and lockfiles count as neither. When nothing needs documenting, add the `no-docs-needed` label or a body line `No docs needed: <why>`; editing the body re-runs the check.

## Contents

| # | Doc | What it covers |
|---|---|---|
| 01 | [How website chatbots work](docs/01-how-chatbots-work.md) | Widget → backend → system prompt → LLM; how to tell an LLM bot from a scripted one |
| 02 | [Speed and routing](docs/02-speed-and-routing.md) | Why replies take under a second; router/triage pattern for junk vs real requests |
| 03 | [LFM3-Omni for voice](docs/03-lfm3-omni-voice.md) | Liquid AI's speech-to-speech model and the hands-free loop around it |
| 04 | [Bot factory architecture](docs/04-bot-factory-architecture.md) | Bot spec, Claude builder, runtime, channels, connectors, build order |
| 05 | [Open-source platforms](docs/05-oss-platforms.md) | Which OSS is maintained and licensed for multi-tenant resale |
| 06 | [Phone calls: LiveKit vs Pipecat](docs/06-phone-calls.md) | Telephony patterns, SIP vs media streams, gotchas |
| 07 | [Dictation apps](docs/07-dictation-apps.md) | Wispr Flow and its open-source alternatives |
| 08 | [Speech model licenses](docs/08-speech-model-licenses.md) | Commercial-safe STT, TTS, translation, diarisation, LLM |
| | [Speech gateway](docs/speech-gateway.md) | One gateway on the VPS routes every project's speech: English to the Pro, other languages to the Windows GPU, a config file to switch |

## Recommended stack (summary)

| Layer | Pick | License |
|---|---|---|
| Channels + human inbox | Chatwoot | MIT (except `enterprise/`) |
| Bot logic | Langflow, or a thin custom engine | MIT |
| Voice + phone | LiveKit Agents + LiveKit SIP (Pipecat as alternative) | Apache-2.0 / BSD-2 |
| Phone numbers | Telnyx or Twilio SIP trunk | commercial service |
| Speech-to-text | Parakeet TDT v3, Whisper large-v3-turbo | CC-BY-4.0, MIT |
| Text-to-speech | Kokoro-82M, Chatterbox | Apache-2.0, MIT |
| Translation | MADLAD-400 3B | Apache-2.0 |
| Diarisation | pyannote 3.1 / community-1 | MIT / CC-BY-4.0 |
| VAD | Silero VAD | MIT |
| LLM | Open models only: LFM3, Qwen (see [decision 0001](docs/decisions/0001-open-models-only.md)) | Apache-2.0 / LFM license |
| Builder | Claude Agent SDK + MCP connectors | own code |
