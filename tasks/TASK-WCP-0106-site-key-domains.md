# TASK-WCP-0106 — Site Key Domains

<!-- continuity:task {"acceptance": ["A business's config may hold site: { key, origins }; put refuses a bad key, a non-origin, plain http outside localhost, more than 20 origins, or a key another business holds", "A request from the copilot's own site (no Origin, its own host, or SITE_ORIGINS) works as before", "Another origin is refused (403) on the API, the voice token and the socket unless its business's key comes from an origin that business lists", "A key for one business cannot act for another: a query or body naming a different business gets 403", "An allowed cross-site request gets Access-Control-Allow-Origin for that origin only; a preflight from an unregistered origin gets no allow headers", "Voice tokens expire after 10 minutes; caller ids stay random", "Plain-code tests cover each of these"], "depends_on": [], "goal": "Accept a business's calls only from its own domains, with a public site key", "id": "WCP-0106", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/125", "next_action": "open the pull request with Closes #125 and arm auto-merge after the final push", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "The API, voice token and socket accept any request; outside businesses can't go live until each one's site key and domains are checked (#125, decision 0021 settlement 7)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Accept a business's calls only from its own domains, with a public site key

## Why

The API, voice token and socket accept any request; outside businesses can't go live until each one's site key and domains are checked (#125, decision 0021 settlement 7)

## Allowed files

- copilot-engine/src/site-config.ts
- copilot-engine/tests/site-config.test.ts
- demo/live-site/api.ts
- demo/live-site/server.ts
- demo/live-site/tests/site-gate.test.ts
- deploy/docker-compose.vps.yml
- tasks/TASK-WCP-0106-site-key-domains.md

## Human outcome

A business that puts the copilot on its own site can be sure no other site spends its model budget or opens voice calls in its name; the copilot's own site keeps working unchanged.

## Scope and boundaries

- In scope: the config's site block, the origin and key check on the API, voice token and socket, the cross-site headers, the 10-minute voice token, tests.
- Out of scope: the widget's script tag for outside sites, abuse limits (#121 phase 3), a business's own subdomain.
- Dependencies/uncertainty: depends on #28 (merged in #50). Whether Cloudflare tunnel A passes the original Host is unknown, so the compose file names the own site in SITE_ORIGINS.

## Acceptance criteria

- [ ] A business's config may hold site: { key, origins }; put refuses a bad key, a non-origin, plain http outside localhost, more than 20 origins, or a key another business holds
- [ ] A request from the copilot's own site (no Origin, its own host, or SITE_ORIGINS) works as before
- [ ] Another origin is refused (403) on the API, the voice token and the socket unless its business's key comes from an origin that business lists
- [ ] A key for one business cannot act for another: a query or body naming a different business gets 403
- [ ] An allowed cross-site request gets Access-Control-Allow-Origin for that origin only; a preflight from an unregistered origin gets no allow headers
- [ ] Voice tokens expire after 10 minutes; caller ids stay random
- [ ] Plain-code tests cover each of these

## Evidence and sources

Starting revision 54b815d (main after #50). `node --test demo/live-site/tests/site-gate.test.ts` (6 pass) and `node --test copilot-engine/tests/site-config.test.ts` (5 pass, real Postgres via pglite).

## Reproduction details (only when needed)

Not needed.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): leaf #125; parent #121; depends on #28 (done)
- Primary writer / branch / source issue revision / as-of status: Claude Code session af5c2cec / task/WCP-0106-site-key-domains / #125 as filed 2026-11-04 / active
- Related PR/CI evidence and push receipt (request ID / SHA): pending

## Checkpoint log

No checkpoints yet.

### 2026-11-04 20:05:20 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none"],"completed":["Site key and allowed origins in each business's config; API, voice token and socket refuse other sites; voice tokens last 10 minutes"],"decisions":["no new decisions"],"evidence":["npm run check exit 0; site-gate.test.ts 6 pass; site-config.test.ts 5 pass on pglite; commit d98fb92"],"next_action":"Open the pull request with Closes #125 and arm auto-merge","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0106","timestamp":"2026-11-04T20:05:20Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"9b57d9eef7f94ef6ddf56190542ad49b3f7195bf238608ae4e5214a51f55497b","request_id":"d74f01bb30004f3f92067a1f744598ab","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0106"} -->

Completed:
- Site key and allowed origins in each business's config; API, voice token and socket refuse other sites; voice tokens last 10 minutes

Evidence:
- npm run check exit 0; site-gate.test.ts 6 pass; site-config.test.ts 5 pass on pglite; commit d98fb92

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Open the pull request with Closes #125 and arm auto-merge

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
