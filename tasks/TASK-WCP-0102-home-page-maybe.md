# TASK-WCP-0102 — Home Page Maybe

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"The Maybe home page is a React page that reads its pictures and films from Octo","id":"WCP-0102","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/109","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The home page was one HTML file with media beside it, so changing a photo meant redeploying the page (#109)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

The Maybe home page is a React page that reads its pictures and films from Octo

## Why

The home page was one HTML file with media beside it, so changing a photo meant redeploying the page (#109)

## Allowed files

- define bounded paths before implementation.

## Human outcome

Describe what becomes easier, safer, clearer, or possible when this task is complete.

## Scope and boundaries

- In scope:
- Out of scope:
- Dependencies/uncertainty:

## Acceptance criteria

- [ ] state observable, task-specific outcomes.

## Evidence and sources

Link repository state at a revision and cite external factual claims directly. Record commands and results for claims that need verification.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none):
- Primary writer / branch / source issue revision / as-of status:
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

### 2026-11-03 08:34:39 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["demo/live-site/api.ts, demo/live-site/app/src/pages/MaybeHome.tsx, demo/live-site/app/src/styles/maybe.css, demo/live-site/tools/site_media.sql"],"completed":["Made the Maybe home page a React page at / that reads 16 picture and film slots from Octo through GET /api/site-media; uploaded and published 17 files; merged as PR 115 (21e7061); old home page moved to /dev/index"],"decisions":["Pictures and films live in Octo and are public (owner pre-approved); an unreachable Octo leaves the slots out, no fallback copy (decision 0004)"],"evidence":["PR 115 checks passed (gates, stack-train manifest) before merge; page rendered at 1440 and 390 px with no console errors; rendered text matched the approved storyboard; 149 of 150 unit tests passed in a scratch copy (stores.test.ts needs a package missing there)"],"next_action":"Check that / on copilot.design-bakery.com shows the new page after the production promote, and that the films play","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0102","timestamp":"2026-11-03T08:34:39Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"4e7ba5ddf453aa1350d5138d4178dc06b29f3e2d26d1f213cfa6345006412a76","request_id":"8532845c163b40dd887c7979fa19b6ff","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0102"} -->

Completed:
- Made the Maybe home page a React page at / that reads 16 picture and film slots from Octo through GET /api/site-media; uploaded and published 17 files; merged as PR 115 (21e7061); old home page moved to /dev/index

Evidence:
- PR 115 checks passed (gates, stack-train manifest) before merge; page rendered at 1440 and 390 px with no console errors; rendered text matched the approved storyboard; 149 of 150 unit tests passed in a scratch copy (stores.test.ts needs a package missing there)

Decisions:
- Pictures and films live in Octo and are public (owner pre-approved); an unreachable Octo leaves the slots out, no fallback copy (decision 0004)

Changed:
- demo/live-site/api.ts, demo/live-site/app/src/pages/MaybeHome.tsx, demo/live-site/app/src/styles/maybe.css, demo/live-site/tools/site_media.sql

Blocked/uncertain:
- none

Next:
- Check that / on copilot.design-bakery.com shows the new page after the production promote, and that the films play

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
