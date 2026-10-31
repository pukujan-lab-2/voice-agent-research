# Website Copilot

An AI agent that any business can install on any website with one line, and that its visitors can talk to like a live agent: by voice or text, in their own language, and later by phone. We run it for them as a service (agent as a service).

This file says what the project is and what is already decided. Decisions are recorded in [docs/decisions/](docs/decisions/); open work and its acceptance criteria live in GitHub issues. Chat logs and agent memory are not the record.

## What it does

A visitor opens the copilot on a site and talks to it. The copilot can:

- **Answer questions** from the business's own documents only, quoting the passage it used. If the documents don't answer it, it says so instead of guessing.
- **Walk the visitor through the site's forms**, one question at a time. It reads every value back and waits for a yes, lets the visitor go back and fix any answer, and never presses submit: the visitor does that.
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
3. **Every value is read back and confirmed.** The copilot never submits a form or takes an irreversible step for the visitor.
4. **Answers come from the documents, with a citation.** If the documents don't say it, the copilot says it doesn't know.
5. **Evals are fully automated.** No human spot-check step. Exact code checks are preferred over judge-model scores.
6. **Octo is the one store.** No local or static fallback copies.
7. **Demo sites are original.** Popular sites can be references, never copies of a real brand.

## Status (2026-10-31)

| Area | State |
|---|---|
| Form filling with read-back (engine) | Works; tested offline and with LFM3 |
| Grounded answers on the IRS library | 100% of cited quotes real; vague questions are not clarified yet (0/100) |
| Caller verification | 24/24 scenarios, no impostor verified, no leaks |
| Voice | Uses browser speech today, which breaks the in-house rule. Being rebuilt on LiveKit Agents |
| Hosting | Local only. Not hosted yet, by the owner's choice |
| Phone calls | Planned (LiveKit SIP) |
| Multi-language | Planned |

## Repository checks

`npm run check` runs lint (Biome), the typecheck (TypeScript, strict), the orphan check (Knip: unused files, exports and dependencies) and the engine tests. Python is linted with Ruff. CI runs the same steps on every pull request.
