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

### Brindlewick Tax & Accounting (`/tax`): a fictional firm with a real library

A sixth, larger site: a fictional tax and accounting firm (made-up name, people, prices and address, original design)
whose assistant answers from **real IRS.gov pages** (U.S. government works, public domain). Every page's footer says
"Fictional demo firm. Tax guides come from IRS.gov (U.S. government works, public domain). Not affiliated with the IRS.
Not tax advice." The team has illustrated SVG avatars, no photos.

- Pages: Home, Services, Pricing, Team, About, **Tax Guides** (`/tax/guides`, every source searchable, each readable
  at `/tax/guides/<id>` with tables intact and a link to irs.gov), **FAQ** (the IRS FAQ, word for word, grouped), and
  **Book a consultation** (`/tax/book`, the intake form: name read back spelled out, phone, email, filing status, tax
  years, service, IRS notice yes/no, notice code read back letter by letter, e.g. "CP2000: C, P, 2, 0, 0, 0", day,
  time, notes; "none" leaves an optional field blank; the copilot never submits).
- The assistant (every page but the form, and side questions on the form) answers only from the IRS library, quoting it
  with a citation link ("IRS Pub 17, Filing Requirements" → irs.gov#anchor), or says it doesn't know. Personal advice
  ("should I…", "how much will I owe", "am I better off…") is not answered: a preparer will go through it at a
  consultation, with a link to book. Suggested-question chips are IRS FAQ questions, word for word.
- Corpus (`tools/irs_fetch.py` → `tools/irs_corpus.py` → `tools/irs_ingest.py`): 296 IRS pages (about 60
  publications, about 30 form instructions, every Tax Topic, the IRS FAQ pages), split into 32,295 passages of at most
  480 characters, each with its source, section heading and deep link; tables split by rows with the header repeated.
  Back-of-book indexes and repeated boilerplate are dropped and identical text is loaded once. Each passage is one Octo
  document titled with its id (`irs/publications-p17 #12`), searched with `filter.titlePrefix: "irs/"`. The ingest is
  resumable (skips what is in Octo or `build/irs/ingested.jsonl`; `touch build/irs/STOP` to pause) and checks the
  MacBook Pro's free memory (`ssh mac-pro memory_pressure`) before every batch, waiting while it is under 25%.
  `data/irs.passages.json` is the manifest and the source of every citation; passage ids must stay stable once loaded,
  so re-run the corpus step only together with a fresh ingest.
- **Octo is the one store** for the library: search (`/rag/query`), the `irs_docs` and `irs_passages` tables in the
  workspace's Postgres (title, kind, page, source URL, article bodies, PDF file ids) and the source PDFs (Octo file
  storage, uploaded as plain bytes so Octo doesn't index them twice). Nothing is served statically. The site reads it all
  through `api.ts`: `/api/library/search`, `/stats` (live counts), `/docs` (paged list), `/doc?doc=`, `/pdf?doc=` (the
  PDF from Octo, a small in-memory LRU) and `/faq`. `tools/irs_pdf.py` maps each passage to its printed PDF page
  (98% placed), `tools/irs_store.py` writes the tables and files.
- PDF sources open in pdf.js (`app/src/components/tax/PdfPages.tsx`) at the passage's page, with pdf.js's text layer so
  the copilot can highlight the quoted words; web-page sources (Tax Topics, FAQ pages, Title 26, 26 CFR, the IRM, the
  IRB) are drawn as articles from their body in Octo.
- **Scale-up** (`tools/lib_fetch.py <irc|cfr|forms|irb|irm>` → `build/lib/<src>/docs.jsonl`, then
  `tools/lib_ingest.py --follow`): Title 26 U.S. Code one document per section (govinfo bulk HTML granules; uscode.house.gov
  refuses automated downloads), 26 CFR per section (eCFR API), every English IRS form and instruction PDF (irs.gov
  forms index; files to Octo, one passage set per page), the IRM per subsection and the IRB's revenue rulings,
  procedures and notices. Search prefixes `irc/`, `cfr/`, `irs/forms/`, `irm/`, `irb/`. Resumable (ledger
  `build/lib/ingested.jsonl`, `touch build/lib/STOP` to pause), and it waits while the Pro has under 20% memory free.
- Search at scale: the library's prefixes are searched with one unfiltered Octo query and filtered by title here,
  because Octo's `titlePrefix` filter costs about 15 s per query at 32,000 passages. The site's search box skips
  Octo's reranker (`rerank: false`); the copilot's answers keep it.
- Eval: `node tests/irs-eval.ts` asks 100 IRS FAQ questions (spread over the FAQ categories) the way the site does and
  has Jev grade each reply against the IRS's own answer: once with the question's own FAQ entry hidden from search
  (can the publications answer it?) and once as deployed.
- Caller verification (sample data): "check on my return" on a desk page starts it. The copilot asks full name, date
  of birth, last four of the SSN and zip, reads each back for a yes, and sends the confirmed answers to `/api/verify`,
  which answers only `match`, `no_match`, `need_more` (the next field) or `locked`, never which answer was wrong. The
  server compares: exact on date of birth, last four and zip in SQL, then the name fuzzy and by sound
  (`tools/verify_match.py`, RapidFuzz + jellyfish). 3 failed tries lock the call (6 per visitor per hour), with a
  hand-off to the office. The browser and the model never get anything on file; what the caller says to a secret
  question is masked on screen and in every log. Once verified, a fictional return card shows, labelled sample data.
  The clients are 500 fictional Faker records in Octo (`bw_clients`, `bw_returns`; SSNs only in never-issued areas
  900-999, 000 and 666): `uv run --with faker==33.1.0 python tools/bw_clients.py`. Tested by `node eval/verify.ts`
  and the last step of `tests/tax-call.ts`.

## How it fits together

- **The app** (`app/`): a React + Vite + shadcn app built by ABA (app-builder-automation) from `aba/spec.md`, then
  polished by two iterate runs (`aba/fix-1.md`, `aba/fix-2.md`), all with WorkBuddy GLM-5.2. It draws the marketing page, the five sites and
  the call panel, and holds no copilot logic. Change it with another ABA iterate run where possible. The `/tax` pages
  come from a full ABA run (`aba/tax-site.md`, run `20261031-030009-tax-site`, DeepSeek V4.1 Flash via WorkBuddy):
  ABA chose React + Vite + TypeScript + Tailwind + shadcn with a Nitro server route for search; we kept its frontend
  and our own `server.ts`/`api.ts` (keys, signing, rate limits) instead of Nitro. Hand edits after that run:
  `PdfPages.tsx` (pdf.js), and the library API wiring in `pages/tax/Guide.tsx`, `Guides.tsx`, `Faq.tsx`,
  `components/tax/SourceViewer.tsx`, `lib/tax.ts`, plus the `.tax-pdf*` styles in `globals.css`. Its `build` runs
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
- **The call record** (#17): every call goes to Phoenix through Octo in full, with nothing masked (each business
  decides what it keeps). The page (`widget/calllog.ts`, through `POST /api/trace`) and the voice agent
  (`speech/telemetry.py`, straight to Octo's OTLP route) write under the same call id, so a call is one Phoenix session:
  the call (business, pages, device and browser, voice stack, language, start, end, outcome), each turn (what was heard
  and the speech model's confidence, the decision and why, model and prompt version, reply, quoted passages, timings,
  barge-ins), its tool calls, read-back confirmations, code-lock blocks and corrections, and every failure. Automated
  evals score a call or one turn with `POST /api/score {call, turn?, name, score?, label?, explanation?}`, which becomes
  a Phoenix span annotation on that span. Call audio is not recorded.
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
rules behind Jev for a local LFM. On gravebuster that is LFM3-1.7B in the Docker container `copilot-llm`
(127.0.0.1:11436, unloads after 300 s idle), set in `~/apps/copilot-demo/env`; the deploy below never touches that file.

A call opens as a compact bar (status, Mute / Keyboard / End, and the copilot's last line as a caption) so the page
and the highlighted field stay in view; the handle (tap or drag) or the caption opens the whole conversation. That bar
was written by hand in `app/src/components/copilot/CopilotWidget.tsx` and `app/src/globals.css`, after the ABA runs:
a new ABA run must keep it. Every answer is read back for a yes, and "go back" or "change the …" returns to any
earlier answer and then to the open question.

The status row shows how long the call has run (m:ss). When a call starts, the page sends `POST /api/warm` (one tiny
call to the local LFM, never Jev, not counted against the visitor's rate limit), so the model loads while the greeting
plays. If an answer still takes more than 0.6 s, a line under the status says "Warming up the assistant… about 2 s"
(no model call in the last ~5 minutes) or "Thinking… about 3 s" and counts down.

Results (2026-10-30): live 147/147, offline 145/147 (the same two manual questions as below). The `wait` scene slows
`/api/understand` to check the timer, the single warm-up ping, and both wait lines. Before that: live 141/141. The layout scene checks the compact bar at 390×664, 375×560 and 360×640: at most a
fifth of the screen in a voice call, the asked field highlighted above it, the page still scrolling, expand and
collapse by caption and handle, every control on screen when typing, and a small corner window on desktop. Other scenes
cover the three iPhone call bugs (a name the recogniser finalises twice, "you wrote the name twice, can you fix it"
mid-flow, a spaced or short spoken serial with the keyboard offered after two misses) and going back two questions
and on again. Offline 139/141: the word-overlap stand-in
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
