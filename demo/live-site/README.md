# Live copilot demo sites

Five small **fictional** websites with the real copilot engine (`copilot-engine/src`) wired in, matching the five
scenes of the concept video (`demo/`). Every brand, person and document is made up; every page shows a
"Demo, fictional company" banner and is `noindex`. There is no real sign-in (one click "Enter as guest", or a made-up
persona from `site/fixtures/demo-accounts.json`), and no form sends anything: pressing the button shows
"Demo: nothing was sent".

| Scene | Page | What the copilot does |
|---|---|---|
| Tumbleberry Children's Clinic | `/clinic/` | 3-step booking: fills each step, you press Next, it carries on with the next step |
| Kettlewisp HDW-500 support | `/appliance/` | Walks through the E24 fix from the manual; answers from it with page links or says "I don't know"; fills the service request (serial read back, "L as in Lima") |
| Larchmoss Studio pricing | `/pricing/` | Quote request, including "change the budget" at the review card |
| Cobblefin IT Desk | `/itdesk/` | New ticket; the page's own pattern rejects a bad asset tag; off-topic requests are turned down |
| Saltmere Pension Fund | `/pension/` | Form R-17; side questions ("what is a payee code?") answered from the R-17 guide, then back to the form |

## How it fits together

- **In the page** (`widget/`, built to `dist/copilot/`): one script tag. The engine (`Copilot`, `Guide`, the page
  adapter's `readInPage`/`flowFromPage`) runs here and makes every decision in code. `DomFiller` types each confirmed
  answer in, returns the page's own validation message, and never submits. The widget sits in a shadow root so the page
  adapter never reads its own text box.
- **Backend** (`api.ts`): the only place keys live. Four narrow endpoints: Jev's on-topic gate for a free-text answer,
  Octo search inside an allow-listed demo manual (`manual:demo-hdw500 `, `manual:demo-r17 `), and Jev picking the
  answering passage and sentences. Passages are HMAC-signed when handed out, so Jev only judges real manual text.
  Per-visitor rate limit and a daily Jev cap. The same handler runs in Node (`server.ts`) and as a Cloudflare Pages
  Function (`functions/api/[[path]].ts`).
- **Documents** (`docs-src/`): a fictional HDW-500 manual and R-17 guide, with tables. `tools/docs.py` splits them with
  the existing loader `copilot-engine/tools/paddle_passages.py` (same splitter and number check as the IRS test), writes
  `site/docs/*.html` (the pages citations link to) and `data/*.passages.json`, and with `--upload` loads them into Octo.

## Run

```bash
npm i
npm start             # http://127.0.0.1:8787, live backend (keys from ~/Documents/projects/.env, never printed)
npm run start:offline # no keys: keyword search, word-overlap judge, rules
npm test              # drives all 5 scenes end to end in Chromium against the live backend
```

Key names: `openrouter_jev_only` → `OPENROUTER_JEV_KEY`, `octo_db_chatbots` → `OCTO_KEY`,
`octo_db_chatbots_workspace` → `OCTO_WORKSPACE` (environment variables of those names win). `LLAMA_URL` swaps the
rules behind Jev for a local LFM.

Results (2026-10-30): live 70/70 (twice). Offline 68/70: the word-overlap stand-in picks the wrong passage for two
manual questions, which is what Jev is there for.

## Hosting (not deployed)

Static pages on Cloudflare Pages with the backend as a Pages Function on the same origin (`wrangler.toml` has the
commands). Alternative: `server.ts` on the MacBook Pro behind a tunnel. Nothing has been created or deployed yet.
