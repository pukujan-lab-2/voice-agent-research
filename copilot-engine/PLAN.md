# Copilot engine: master plan (status as of 2026-10-30)

Defaults chosen so work can run without stopping to ask. Things that still need the owner: spending money,
public posting, secrets, deleting data. Everything else gets built and reported.

## Done
- [x] Direction: add-on copilot for business owners' existing sites; agent as a service; data stays in house.
- [x] Model choice: open models only, no Claude in the product. Small local model for understanding answers.
- [x] LFM3-1.7B (Q4_K_M) on the Windows PC's RTX 4060 via llama.cpp b12000 (CUDA 12.4 build; the 13.4 build
      is too new for the 592.00 driver). Idle sleep: see `ops/llama-windows.md`.
- [x] Engine core in text (`src/`): one question at a time, serial read-back, confirm card, submit gate, off-scope
      refusal, change-an-earlier-answer. Zero dependencies (Node 24 runs TS directly).
- [x] Guard rules in code (serials incl. phonetic words, yes/no with hedges, choice synonyms).
- [x] Scenarios: 7/7 with LFM3, plus 9 unit tests with a stand-in model; holdout set 16/16 (the 2 misses it found
      were fixed, so write fresh holdout cases before trusting the score again).
- [x] Octo RAG: DMV, Medicare 2027 and IRS Pub 17 loaded (38 docs); 15 questions, right passage in top 3 for 13/15.
      (Those docs were deleted on request; the 7 demo DW-500 manual passages are loaded there now.)
- [x] Jev 1.14 on-topic gate (`JevGate` in `src/models.ts`) in front of LFM3 on free-text questions. 500 conversations,
      seed 3: failed checks 117 -> 49 of ~6,900; off-topic kept out 84% -> 93.5%; safety checks 100% both ways.
      568 Jev calls cost $0.012. Model locked to Jev in code; key locked to Jev by an OpenRouter guardrail.
- [x] Fresh holdout (`tests/holdout2.ts`, 30 cases): found a real bug ("yes but change the time" submitted at the
      confirm card). Fixed: a yes with "but/except/wait..." or a field name never submits. Asking for a person is
      answered in code. Rules model 22/30, Jev + rules 27/30 before the fix to the Jev prompt. Write holdout3 next.
- [x] Manual-guidance mode core (`src/guide.ts`): steps walked one at a time, navigation in code, side questions
      answered only by quoting a manual passage (Octo search + Jev picks the passage or says none), else
      "I don't know". 21/21 with Octo + Jev (case set written with the code, not a holdout yet).

## Next, in this order (each ends with tests added to the ledger)
1. [~] Manual-guidance mode (core done): still to do: split a real manual into numbered steps offline (owner reviews), walk one step at a time,
       answer side questions from retrieval only, say "I don't know" otherwise. Pairs with the booking-flow mode.
2. [ ] Site adapter + a real demo backend (Brookside booking): the flow's `submit` calls the owner's own API.
3. [ ] Page adapter: PageAgent (alibaba/page-agent, MIT) as the in-page layer; fill-and-never-submit on a practice
       form (demoqa.com practice form), then real forms.
4. [ ] Form + manual demos: Medicare (CMS-40B + Medicare & You), DMV (address form + handbook), IRS (W-4 + Pub 17).
       Fill and answer questions about the form, never submit.
5. [ ] Voice: Pipecat, Whisper speech-to-text, engine, text-to-speech (ElevenLabs for demos). Say "let me check
       the manual" while retrieval runs (1-2 s is fine).
6. [ ] Widget: one script tag, per-site config, multi-tenant from the start, usage caps.
7. [ ] Model bake-off on the holdout set: other small open models, LFM3 8-bit, `typesafe/jev-router` (needs an
       OpenRouter key in `~/Documents/projects/.env`; must report the model used, support an allowlist).
8. [ ] Re-cut the demo video with real screen recordings of the working copilot.
9. [ ] Self-hosted tier for regulated clients; pricing; first pilot.

## Original design notes

Goal: make the copilot from the demo video real. A voice or chat guide that walks a person through a
website step by step, asks before it acts, and keeps the business's customer data in house.

## Design: one engine, two adapters

```
person (voice/chat) -> ENGINE -> adapter -> a website
```

**Engine** (the part that must be right, and is the same everywhere):
- Works from a **field list** (name, type, required, validation) and a list of allowed **actions**.
- Asks one question at a time, in plain language. Skips what it already knows.
- Reads hard identifiers back (serials, codes, emails) and accepts corrections ("L as in Lima").
- Shows a **confirm card** before any irreversible action. Never submits without a clear yes.
- Declines anything outside the allowed actions ("I can only help with X here").
- Keeps a transcript and an action log (what it filled, what was confirmed, what was sent).

**Site adapter** (the product for business owners): the owner defines actions in a config; the engine
calls the owner's own endpoints. Customer data goes to the owner's systems, not ours.

**Page adapter** (proof of concept on a third-party site): reads a page's form fields from the DOM
(label, type, options, required), builds the field list, and fills them with Playwright as the person
answers. Same engine, no owner config.

## Phases

1. **Engine core, text only (no voice, no browser).** A state machine over a field list. Pure
   functions plus an LLM call for understanding answers. Unit-testable with scripted conversations.
2. **Demo site with a real backend.** Clone the Brookside Pediatrics booking flow as a small real app
   (form, validation, database). Site adapter calls its API. This is the "owner" demo made real.
3. **Page adapter.** Playwright in the Claude Chromium (`~/bin/claude-chrome`): read the form,
   build the field list, fill on confirm. Start on a **practice form we host**, then a hosted job
   application page (Greenhouse/Lever style) using the user's own details from a local profile file.
4. **Voice.** Put ElevenLabs speech in and out on top of the same engine. Last, because the engine
   is the hard part and is easier to test as text.
5. **Re-cut the demo video** with real screen recordings instead of scripted scenes.

## Safety rules (page adapter)

- The person's profile (name, address, work history) lives in a local file, never in the repo.
- Fills every field it is sure of, asks about the rest, and **stops before Submit**. The person
  presses submit, or says a clear yes to a final confirm card.
- Does not solve CAPTCHAs, accept terms for the person, or create accounts or enter passwords.
- Asks, never guesses, on legal and demographic questions (work authorisation, EEO, disability).
- Skips sites that forbid automation in their terms. No LinkedIn.

## Tests (the regression record, like the Flow ledger)

Scripted scenario conversations run against the engine with a fake adapter, each scored pass/fail:
1. Serial read-back, deliberate mishear, correction, re-confirm.
2. Off-scope request is declined, then the task resumes.
3. Person changes an earlier answer mid-flow; only that field changes.
4. Person says "yes" before the confirm card: engine still shows the card.
5. Never submits on silence, "maybe" or "wait".
6. Page adapter on the practice form: every field filled matches the answers, nothing extra.

Log each run to a JSONL ledger (scenario, engine version, prompt version, verdict) so prompt changes
can be compared over time.

## Decisions to make

- **No Claude in the product** (too expensive; Claude is for coding work only). Open-weight models only,
  behind one swappable interface, via a hosted provider first (Qwen, Llama, Mistral, DeepSeek families;
  check current versions and prices). Self-hosting only for the premium tier.
- **Cascade, not omni, by default:** speech-to-text (Whisper) -> small text model -> text-to-speech.
  Reason: a text transcript per turn is needed to validate, log and test. LFM3-Omni-2B (released
  2026-10-27, LFM Open License, tool calling unconfirmed) is tested in the comparison step; read its
  license first.
- **The system is the strength, the model is replaceable:** identifiers validated by regex in code,
  spell-back from a lookup table, structured output (JSON schema or grammar) so the model can only pick
  an allowed action, all state and the submit gate in the engine, cheap rules for easy turns, a bigger
  open model only for messy ones. Each failure becomes a new scenario.
- Language: Node/TypeScript, to share Playwright with the video-studio tools.
- Where it lives: `chatbots/copilot-engine/` in this repo.

## Model comparison step (before choosing)

Run the same scenarios on each candidate (cascade with 2-3 open text models; LFM3-Omni-2B as text brain
and as speech-to-speech). Log pass rate, latency per turn and cost per conversation in the ledger. Keep
the cheapest that passes the read-back and never-submit-without-yes scenarios.

**Decision (user, 2026-10-30): the product model is `typesafe/jev-router` on OpenRouter (paid), used for everything.** Other candidates are no longer compared. The checks below still run once a key exists.

**Jev 1.14 (the decisions model) works on OpenRouter (tested 2026-10-30):** `POST https://openrouter.ai/api/alpha/decisions`
with `{"model":"typesafe/jev-1.14","state":{...},"questions":{"name":{"type":"choice","criteria":{id:desc},"instructions":"..."}}}`.
Returns `answers.name.{choice, probabilities, confidence}` and `usage.cost`. Calling it on `/chat/completions` gives a 400.
Relevance check on the problem step: 12/12 right (incl. "I want to obtain a business loan"), ~0.27 s, ~$0.000016 per call
(about 37x cheaper than one `jev-router` chat call). Use it as the off-scope gate. Lock the OpenRouter key with a Guardrail
that allows only `typesafe/jev-1.14` plus a budget cap.

**Jev Router notes:** A router that picks the model per request (it answered with `openai/gpt-6.1-sol` in a test).
Unverified: which models it routes between, whether the response names the model that answered,
whether it can be limited to an allowlist, real price (compare page says "Free", likely launch pricing),
tool-calling quality. Use only if all three hold: it reports the model used per turn (so the ledger stays
meaningful), it supports an allowlist, and it passes the scenarios. First test: ~20 scripted turns
(serial read-back, off-scope request), check the raw response for a model field, compare cost against a
pinned open model. Needs an OpenRouter key in `~/Documents/projects/.env` (never printed or committed).

## Business model

Agent as a service: widget on the owner's site, we host the engine, flat monthly fee per site with a cap
on conversations/voice minutes. Multi-tenant from day one (per-site config, actions and logs). Premium:
self-hosted for regulated clients.

## Done when

The engine completes the Brookside booking against the real backend by chat, and fills a hosted job
application form up to the submit button from the person's answers, passing all six scenarios.
