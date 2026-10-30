# Live copilot demo sites

Five small **fictional** websites with the real copilot engine (`copilot-engine/src`) wired in, matching the five
scenes of the concept video (`demo/`), plus a marketing page for that video. Every brand, person and document is made
up; every page shows a "Demo, fictional company" banner and is `noindex`. There is no real sign-in (one click "Enter as
guest", `?guest=1`, or a made-up persona from `site/fixtures/demo-accounts.json`), and no form sends anything: pressing
the button shows "Demo: nothing was sent".

Each site is an ordinary website (menu, search, help pages, a real form), so the same task can be done the
traditional way or with the copilot: **Start voice call** (browser speech in and out, one question at a time, read-back,
fills only what you confirm, never submits) or **Type instead**.

| Scene | Form page | What the copilot does |
|---|---|---|
| Tumbleberry Children's Clinic | `/clinic/book/` | 3-step booking: fills each step, you press Next, it carries on with the next step |
| Kettlewisp HDW-500 support | `/appliance/support/` | Walks through the E24 fix from the manual; answers from it with page links or says "I don't know"; fills the service request (serial read back, "L as in Lima") |
| Larchmoss Studio pricing | `/pricing/quote/` | Quote request, including "change the budget" at the review card |
| Cobblefin IT Desk | `/itdesk/new/` | New ticket; the page's own pattern rejects a bad asset tag; off-topic requests are turned down |
| Saltmere Pension Fund | `/pension/forms/r17/` | Form R-17; side questions ("what is a payee code") answered from the R-17 guide, then back to the form |

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
npm test              # drives all 5 scenes plus a voice call (stubbed speech) end to end in Chromium, live backend
```

Key names: `openrouter_jev_only` → `OPENROUTER_JEV_KEY`, `octo_db_chatbots` → `OCTO_KEY`,
`octo_db_chatbots_workspace` → `OCTO_WORKSPACE` (environment variables of those names win). `LLAMA_URL` swaps the
rules behind Jev for a local LFM.

Results (2026-10-30): live 77/77. Offline 75/77: the word-overlap stand-in picks the wrong passage for two manual
questions, which is what Jev is there for. Layout checked at 375, 768 and 1280 px: no sideways scroll, tap targets
44 px or more, call controls stay on screen. Voice was tested with stubbed browser speech; a real iPhone mic is untested.

## Hosting

`server.ts` runs on gravebuster as the systemd user service `copilot-demo` (`~/apps/copilot-demo`, 127.0.0.1:8790,
keys in `~/apps/copilot-demo/env`, mode 600), behind its own Cloudflare Tunnel `copilot-demo`:

- `https://demo.design-bakery.com`: the five sites and `/api` on the same origin
- `https://copilot.design-bakery.com`: the marketing page (picked by Host header, `MARKETING_HOST`); the concept videos
  are copied in from `demo/out/` at build time (`VIDEO_DIR`) and served with byte ranges for Safari

Redeploy from this folder:

```bash
DEMO_ORIGIN=https://demo.design-bakery.com VIDEO_DIR=../out node build.ts
rsync -az --delete --exclude '*.test.ts' ../../copilot-engine/src/ gravebuster:apps/copilot-demo/app/copilot-engine/src/
rsync -az --delete --include server.ts --include api.ts --include package.json --include 'dist/***' --include 'data/***' --exclude '*' ./ gravebuster:apps/copilot-demo/app/demo/live-site/
ssh gravebuster systemctl --user restart copilot-demo
```

`wrangler.toml` and `functions/` are the alternative (Cloudflare Pages with the backend as a Pages Function); not used.
