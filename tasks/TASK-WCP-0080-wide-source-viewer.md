# TASK-WCP-0080 — A wide source viewer

<!-- continuity:task {"acceptance": ["The source viewer takes up to 72% of the window width (at most 1200 px) on desktop and about 58% on a tablet, and the PDF page is drawn to that width", "The call panel stays visible beside the viewer", "Quote highlighting still works because the width is fixed before the page is drawn", "A web-page source keeps a readable line length", "The existing tax call test still passes"], "depends_on": [], "goal": "The tax demo's source viewer uses much more of the screen so a cited PDF is readable", "id": "WCP-0080", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/64", "next_action": "Merge, then check the live viewer in a browser", "owner": "owner", "priority": "P2", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "A cited IRS publication was drawn in a 440 px panel in tiny type that the owner could barely read (#64)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

The tax demo's source viewer uses much more of the screen so a cited PDF is readable.

## Why

A cited IRS publication was drawn in a 440 px side panel, so a two-column page came out in tiny type (#64).

## Allowed files

- `demo/live-site/app/src/globals.css`, `components/tax/PdfPages.tsx`, `components/tax/SourceViewer.tsx`
- `tasks/TASK-WCP-0080-wide-source-viewer.md`

## Human outcome

The owner reads the cited page without zooming, with the call panel still beside it.

## Scope and boundaries

- In scope: the viewer's width, the PDF width cap, a readable line length for articles.
- Out of scope: a zoom control or a true full-screen mode (a width change after the highlight is drawn would redraw the page and lose it).

## Acceptance criteria

- [x] Desktop viewer up to 72% of the width (max 1200 px); tablet 58%; phone sheet unchanged.
- [x] The PDF page is drawn to the viewer's width (cap 1200 px).
- [ ] Checked in a browser after deploy: the page is readable and the quote is still highlighted.

## Evidence and sources

- The app builds in a scratch copy (`pnpm run build`, copilot contract check passed) and `npm run check` passes.

## Related records

- Leaf #64; parent none; depends on none.
- Primary writer / branch: claude-code / `fix/64-wide-source-viewer`; source issue open as of 2026-11-01.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 23:30:45 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none"],"completed":["A cited PDF in the tax demo was drawn in a 440 px panel and was hard to read; the viewer now takes up to 72% of the window and the page is drawn to that width"],"decisions":["no new decisions"],"evidence":["npm run check passes; the app builds in a scratch copy with the copilot contract check"],"next_action":"Merge, then check the live viewer in a browser","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0080","timestamp":"2026-11-01T23:30:45Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"dbe657e08e57ddde37a590dff14b3e24d887067417e1d3cd78b4f5bfe5dbb167","request_id":"a0669a0111c545eab171096e8615d651","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0080"} -->

Completed:
- A cited PDF in the tax demo was drawn in a 440 px panel and was hard to read; the viewer now takes up to 72% of the window and the page is drawn to that width

Evidence:
- npm run check passes; the app builds in a scratch copy with the copilot contract check

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Merge, then check the live viewer in a browser

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
