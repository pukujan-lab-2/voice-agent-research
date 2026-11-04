# TASK-WCP-0105 — Customer Memory Per Business

<!-- continuity:task {"acceptance": ["A customer key carries the business id and is an HMAC under that business's own secret, derived from a master secret that is never in the source", "A desk given a customer store without a business id or without a secret refuses to start", "A plain-code test: two businesses, the same caller phone, two separate records; one business's forget-me leaves the other's record", "Existing memory tests and the desk simulator pass with the new keys", "Decision 0021 records the owner's opt-in choice for cross-business data use"], "depends_on": [], "goal": "Keep each business's returning-customer memory apart with its own keyed hash", "id": "WCP-0105", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/123", "next_action": "open the pull request; then phase 0's site key and allowed domains (#121)", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "customerKey hashes only the phone or email with one global salt, so two businesses would share a caller's record (#123, decision 0021 settlement 6)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Keep each business's returning-customer memory apart with its own keyed hash

## Why

customerKey hashes only the phone or email with one global salt, so two businesses would share a caller's record (#123, decision 0021 settlement 6)

## Allowed files

- `copilot-engine/src/memory.ts`
- `copilot-engine/src/desk.ts`
- `copilot-engine/tests/desk-memory.test.ts`
- `copilot-engine/tests/desk-sim.ts`
- `docs/decisions/0021-adopters-own-a-workspace.md`
- `tasks/TASK-WCP-0105-customer-memory-per-business.md`

## Human outcome

A caller who saved details at one business is never greeted with them at another, and a leaked store cannot be turned back into phone numbers without that business's secret.

## Scope and boundaries

- In scope: the customer key, the desk's customer memory, their tests; the opt-in line in decision 0021.
- Out of scope: verifying the caller (phase 3), per-business keys in OpenBao (phase 1), turning memory on in the live site.
- Dependencies/uncertainty: the live site passes no customer store today, so no stored records need moving.

## Acceptance criteria

- [ ] A customer key carries the business id and is an HMAC under that business's own secret, derived from a master secret that is never in the source
- [ ] A desk given a customer store without a business id or without a secret refuses to start
- [ ] A plain-code test: two businesses, the same caller phone, two separate records; one business's forget-me leaves the other's record
- [ ] Existing memory tests and the desk simulator pass with the new keys
- [ ] Decision 0021 records the owner's opt-in choice for cross-business data use

## Evidence and sources

- `grep -rn customers demo/live-site/*.ts` at e29fd2f finds no customer store passed to a desk; only tests and the desk simulator use one.
- `copilot-engine/src/memory.ts` at e29fd2f: `customerKey` is sha256 of `salt|kind|value`, salt from `DESK_MEMORY_SALT` or `desk-v2`.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): #123, parent #121, no dependencies
- Primary writer / branch / source issue revision / as-of status:
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
