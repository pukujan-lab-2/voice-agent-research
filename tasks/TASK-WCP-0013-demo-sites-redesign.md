# TASK-WCP-0013 — The demo home page and company sites redesigned to a polished product standard

<!-- continuity:task {"acceptance":["Home page and every demo site share one new design system","Nothing copied from obvious.ai","Scene tests and the copilot contract pass"],"depends_on":[],"goal":"The demo home page and company sites redesigned to a polished product standard","id":"WCP-0013","next_action":"none; delivered in #67 and merged as 35b9ad1","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"completed","why":"The owner finds the demo plain next to obvious.ai"} -->

- Status: completed
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

The demo home page and company sites redesigned to a polished product standard.

## Why

The owner finds the demo plain next to obvious.ai (#64).

## Related records

- Leaf #64; parent none; depends on none.
- Primary writer / branch: claude-code / task/WCP-0013-demo-sites-redesign.

## Delivery

- Delivered in pull request #67, merged as `35b9ad1` on 2026-11-01 06:29 UTC from pushed head `96da0f2`.
- The shared sheet is `demo/live-site/app/src/styles/design.css`; the hero illustration is `components/site/SiteHeroArt.tsx`; the five business home pages use both.
- Checks on merged `main` (`da521b8`): `npm run check` passed (49 engine tests, 8 of 8 scenarios), `npm run build` passed including the copilot contract check, and the layout scene passed at 390×664, 375×560, 360×640 and 1280×800.
- Issue #64 closed as completed with the evidence in [the delivery comment](https://github.com/Pukujan-lab/voice-agent-research/issues/64#issuecomment-6554680857).
- Gaps recorded, not hidden: two offline guide lookups failed before this change and still do, and a full offline run stops in the voice scene (#69).

## Checkpoint log

No checkpoints yet.

### 2026-11-01 05:40:50 UTC — codex

<!-- continuity:checkpoint {"agent":"codex","blocked":["Phone layout, remaining site refinements and the two baseline scene failures require follow-up."],"changed":["demo/live-site/app/src, demo/live-site/app/public/Conversation.png, .content-system"],"completed":["Introduced a warm shared visual style and an original home page illustration."],"decisions":["no new decisions"],"evidence":["Repository checks and the React build passed; offline scenes passed 97 of 99 checks, with the same two document lookup failures on unchanged main."],"next_action":"Review every demo at desktop and phone widths and finish the redesign.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0013","timestamp":"2026-11-01T05:40:50Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"2784f4ca2664afaa4badfd796a96490cbb2467e042bbf1bfb89518a766c5bd09","request_id":"8b91427f0f034c668798f7d18052bb1b","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0013"} -->

Completed:
- Introduced a warm shared visual style and an original home page illustration.

Evidence:
- Repository checks and the React build passed; offline scenes passed 97 of 99 checks, with the same two document lookup failures on unchanged main.

Decisions:
- no new decisions

Changed:
- demo/live-site/app/src, demo/live-site/app/public/Conversation.png, .content-system

Blocked/uncertain:
- Phone layout, remaining site refinements and the two baseline scene failures require follow-up.

Next:
- Review every demo at desktop and phone widths and finish the redesign.

### 2026-11-01 05:50:56 UTC — codex

<!-- continuity:checkpoint {"agent":"codex","blocked":["Phone layouts and the remaining demo sites need visual review; the baseline has two offline document lookup failures."],"changed":["demo/live-site/app/src, demo/live-site/app/public/Conversation.png, .content-system"],"completed":["Reconciled the demo redesign with the merged voice lab."],"decisions":["no new decisions"],"evidence":["Repository checks and the React build passed after merging the voice changes; the home page and clinic form were previewed on desktop."],"next_action":"Inspect every demo site at desktop and phone widths and finish the redesign.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0013","timestamp":"2026-11-01T05:50:56Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"e938a0bdf4551b08c6e7ac0fa79e07639bd5b49f9584548e675d474c11d8b1d2","request_id":"826d192be6bd450a8bba17954338b2b7","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0013"} -->

Completed:
- Reconciled the demo redesign with the merged voice lab.

Evidence:
- Repository checks and the React build passed after merging the voice changes; the home page and clinic form were previewed on desktop.

Decisions:
- no new decisions

Changed:
- demo/live-site/app/src, demo/live-site/app/public/Conversation.png, .content-system

Blocked/uncertain:
- Phone layouts and the remaining demo sites need visual review; the baseline has two offline document lookup failures.

Next:
- Inspect every demo site at desktop and phone widths and finish the redesign.

### 2026-11-01 06:28:03 UTC — workbuddy

<!-- continuity:checkpoint {"agent":"workbuddy","blocked":["The phone call bar overflows at 390px and blocks the layout scene; the widget task (WCP-0014) owns that fix."],"changed":["demo/live-site/app/src/styles/design.css, demo/live-site/app/src/components/site/SiteHeroArt.tsx, demo/live-site/app/src/pages/Index.tsx, clinic/Home.tsx, appliance/Home.tsx, pricing/Plans.tsx, itdesk/Home.tsx, pension/Home.tsx"],"completed":["Finished the shared design system on the product page and the five demo sites: one hero with the site's own illustration, serif headings for the businesses, one card and button language, a navigation bar that spans the viewport, and the header's guest label no longer colliding with its Leave link."],"decisions":["The businesses' headings use the serif the tax firm already uses, because a visitor reads them as businesses; the product page keeps its grotesque because it sells software."],"evidence":["npm run check passes (lint, ruff, typecheck, knip, 49 engine tests, 8/8 scenarios). Offline scenes: 97 checks pass; two guide lookups fail (warranty page 8, processing time page 4) and the phone layout scene is blocked by the call bar overflowing at 390px, both from the voice work merged in #61. Every page was screenshotted at 1440 and 390 and read."],"next_action":"Mark pull request #67 ready and merge it, then continue the widget task on the merged design system.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0013","timestamp":"2026-11-01T06:28:03Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"b83e3ce5bf1d098651b54b85fbef99a1ab235af1b45935aef94812d51a05dc9c","request_id":"608a17afd431474fbb86ca75a4c5dc44","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0013"} -->

Completed:
- Finished the shared design system on the product page and the five demo sites: one hero with the site's own illustration, serif headings for the businesses, one card and button language, a navigation bar that spans the viewport, and the header's guest label no longer colliding with its Leave link.

Evidence:
- npm run check passes (lint, ruff, typecheck, knip, 49 engine tests, 8/8 scenarios). Offline scenes: 97 checks pass; two guide lookups fail (warranty page 8, processing time page 4) and the phone layout scene is blocked by the call bar overflowing at 390px, both from the voice work merged in #61. Every page was screenshotted at 1440 and 390 and read.

Decisions:
- The businesses' headings use the serif the tax firm already uses, because a visitor reads them as businesses; the product page keeps its grotesque because it sells software.

Changed:
- demo/live-site/app/src/styles/design.css, demo/live-site/app/src/components/site/SiteHeroArt.tsx, demo/live-site/app/src/pages/Index.tsx, clinic/Home.tsx, appliance/Home.tsx, pricing/Plans.tsx, itdesk/Home.tsx, pension/Home.tsx

Blocked/uncertain:
- The phone call bar overflows at 390px and blocks the layout scene; the widget task (WCP-0014) owns that fix.

Next:
- Mark pull request #67 ready and merge it, then continue the widget task on the merged design system.
