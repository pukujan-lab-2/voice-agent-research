# Live copilot demo sites

Five small **fictional** websites with the real copilot engine (`copilot-engine/src`) wired in, matching the five
scenes of the concept video (`demo/`), plus a marketing page for that video at `/`. Every brand, person and document
is made up; every site page shows a "Demo, fictional company" banner, and every page is `noindex`. There is no real
sign-in (one click **Continue as guest**, or `?guest=1`), and no form sends anything: pressing the button shows
"Demo: nothing was sent".

Each site is an ordinary website (menu, search, help pages, a real form), so the same task can be done the
traditional way or with the copilot: **Start voice call** (browser speech in and out, one question at a time, read-back,
fills only what you confirm, never submits) or **Type instead**.

| Scene | Form page | What the copilot does |
|---|---|---|
| Tumbleberry Children's Clinic | `/clinic/book` | 3-step booking: fills each step, you press Next, it carries on with the next step |
| Kettlewisp HDW-500 support | `/appliance/support` | Walks through the E24 fix from the manual; answers from it with page links or says "I don't know"; fills the service request (serial read back, "L as in Lima") |
| Larchmoss Studio pricing | `/pricing/quote` | Quote request, including "change the budget" at the review card |
| Cobblefin IT Desk | `/itdesk/new` | New ticket; the page's own pattern rejects a bad asset tag; off-topic requests are turned down |
| Saltmere Pension Fund | `/pension/forms/r17` | Form R-17; side questions ("what is a payee code") answered from the R-17 guide, then back to the form |

## How it fits together

- **The app** (`app/`): a React + Vite + shadcn app built by ABA (app-builder-automation) from `aba/spec.md`, then
  polished by two iterate runs (`aba/fix-1.md`, `aba/fix-2.md`), all with WorkBuddy GLM-5.2. It draws the marketing page, the five sites and
  the call panel, and holds no copilot logic. Change it with another ABA iterate run, not by hand. Its `build` runs
  `scripts/check-copilot-contract.mjs`, which fails the build when the app breaks what the copilot relies on (exact
  form markup, steps hidden with the `hidden` attribute, the test ids).
- **The copilot in the page** (`widget/`, built to `dist/copilot/`): `sdk.ts` is a headless copilot, `window.copilot`,
  that the app draws through `subscribe`/`getSnapshot` and drives with `start`, `send`, `toggleMic`, `end`. The engine
  (`Copilot`, `Guide`, the page adapter's `readInPage`/`flowFromPage`) runs here and makes every decision in code.
  `DomFiller` types each confirmed answer in, returns the page's own validation message, and never submits. Speech is
  the browser's own (Web Speech API). The build replaces the app's stand-in `public/copilot/sdk.js` with the real one.
- **Backend** (`api.ts`): the only place keys live. Narrow endpoints: Jev's on-topic gate for a free-text answer,
  Octo search inside an allow-listed demo manual (`manual:demo-hdw500 `, `manual:demo-r17 `), and Jev picking the
  answering passage and sentences. Passages are HMAC-signed when handed out, so Jev only judges real manual text.
  Per-visitor rate limit and a daily Jev cap. The same handler runs in Node (`server.ts`) and as a Cloudflare Pages
  Function (`functions/api/[[path]].ts`).
- **Documents** (`docs-src/`): a fictional HDW-500 manual and R-17 guide, with tables. `tools/docs.py` splits them with
  the existing loader `copilot-engine/tools/paddle_passages.py` (same splitter and number check as the IRS test), writes
  `static/docs/*.html` (the pages citations link to) and `data/*.passages.json`, and with `--upload` loads them into Octo.

## Run

`node build.ts` builds `app/` with pnpm (installing it on first use), then puts together `dist/`: the app, `static/`
(the two manuals as HTML, video posters, robots.txt), the copilot at `/copilot/`, and the concept videos from
`VIDEO_DIR` (default `../out`) at `/media/`. `server.ts` serves `dist/` and `/api` on one origin, and the app's
`index.html` for every client-side route.

```bash
npm i
npm start             # http://127.0.0.1:8787, live backend (keys from ~/Documents/projects/.env, never printed)
npm run start:offline # no keys: keyword search, word-overlap judge, rules
npm test              # drives all 5 scenes plus a voice call (stubbed speech) end to end in Chromium, live backend
```

Key names: `openrouter_jev_only` → `OPENROUTER_JEV_KEY`, `octo_db_chatbots` → `OCTO_KEY`,
`octo_db_chatbots_workspace` → `OCTO_WORKSPACE` (environment variables of those names win). `LLAMA_URL` swaps the
rules behind Jev for a local LFM.

Results (2026-10-30), against the ABA app: live 109/109, including a layout scene that opens the call panel at
390×664, 375×560 and 360×640 and requires every call control to be on screen, and the three iPhone call bugs (a name
the recogniser finalises twice, "you wrote the name twice, can you fix it" mid-flow, a spaced or short spoken serial
with the keyboard offered after two misses). Offline 107/109: the word-overlap stand-in
picks the wrong passage for two manual questions, which is what Jev is there for. After deploying, both public
hostnames were checked in Chromium (desktop) and WebKit (iPhone 13): the copilot fills the clinic form and answers E24
from the live manual with a page link, with no page errors. Voice was tested with stubbed browser speech; a real
iPhone mic is untested.

## Hosting

`server.ts` runs on gravebuster as the systemd user service `copilot-demo` (`~/apps/copilot-demo`, 127.0.0.1:8790,
keys in `~/apps/copilot-demo/env`, mode 600), behind its own remotely managed Cloudflare Tunnel `copilot-demo`
(user service `copilot-demo-tunnel`, binary and token file in `~/apps/copilot-demo/tunnel/`). The tunnel's routes live
in the Cloudflare dashboard; changing the port or adding a hostname means changing them there too:

- `https://demo.design-bakery.com` and `https://copilot.design-bakery.com`: the same app (marketing page at `/`, the
  five sites, `/api`). The concept videos are served with byte ranges for Safari.

Redeploy from this folder:

```bash
VIDEO_DIR=../out node build.ts
rsync -az --delete --exclude '*.test.ts' ../../copilot-engine/src/ gravebuster:apps/copilot-demo/app/copilot-engine/src/
rsync -az --delete --include server.ts --include api.ts --include package.json --include 'dist/***' --include 'data/***' --exclude '*' ./ gravebuster:apps/copilot-demo/app/demo/live-site/
ssh gravebuster systemctl --user restart copilot-demo
```

`wrangler.toml` and `functions/` are the alternative (Cloudflare Pages with the backend as a Pages Function); not used.
