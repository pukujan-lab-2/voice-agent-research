# TASK-WCP-0108 — Call Encryption

<!-- continuity:task {"acceptance":["OpenBao runs on the VPS with its backups stored off the VPS","Each call is encrypted with its own key; that key is stored only locked by its business's key","A plain-code test: raw transcripts in Octo storage are ciphertext, and business A's key cannot open business B's calls","A restart of the copilot loses no keys and decrypts the same calls"],"depends_on":["WCP-0107"],"goal":"Encrypt each business's raw calls with keys kept in OpenBao","id":"WCP-0108","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/128","next_action":"open the pull request with Closes #128, confirm CI is green, arm auto-merge, then check a saved call on the VPS before and after a copilot restart","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Raw call records sit in Octo as plain text, so a database login or a leaked backup shows every caller of every business; outside businesses can't go live until each call is locked by its business's key (#128, decision 0021 settlement 3)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: WCP-0107 (#127, merged)

## Goal

Encrypt each business's raw calls with keys kept in OpenBao

## Why

Raw call records sit in Octo as plain text, so a database login or a leaked backup shows every caller of every business; outside businesses can't go live until each call is locked by its business's key (#128, decision 0021 settlement 3)

## Allowed files

- copilot-engine/src/call-vault.ts
- copilot-engine/tests/call-vault.test.ts
- copilot-engine/tests/fake-transit.ts
- copilot-engine/package.json
- demo/live-site/api.ts
- demo/live-site/server.ts
- demo/live-site/tests/own-workspace.test.ts
- deploy/docker-compose.vps.yml
- deploy/README.md
- tasks/TASK-WCP-0108-call-encryption.md

## Human outcome

A leaked Octo backup or database login no longer shows what callers said: each call's record is locked by its own key, and only its business's key in OpenBao can unlock that.

## Scope and boundaries

- In scope: OpenBao on the VPS (server-management#136, PRs #137 and #138), the per-call and per-business keys, locking resume snapshots on write and opening them on read, tests.
- Out of scope: call audio (#130), trace text (#129), who may read (#131), deleting by key (#132).
- Dependencies/uncertainty: static-key auto-unseal, the owner's choice on 2026-11-04, is weaker against someone who gets the VPS disk.

## Acceptance criteria

- [ ] OpenBao runs on the VPS with its backups stored off the VPS
- [ ] Each call is encrypted with its own key; that key is stored only locked by its business's key
- [ ] A plain-code test: raw transcripts in Octo storage are ciphertext, and business A's key cannot open business B's calls
- [ ] A restart of the copilot loses no keys and decrypts the same calls

## Evidence and sources

Starting revision c4313e6 (main after #135). The only call text the live site writes to Octo is the resume snapshot (`demo/live-site/api.ts` sessionApi, table `copilot_kv`); trace text is #129. OpenBao transit data keys: https://openbao.org/docs/secrets/transit/ .

## Reproduction details (only when needed)

Not needed.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): leaf #128; parent #121; depends on #127 (merged) and pukujan-lab-2/server-management#136 (OpenBao on the VPS)
- Primary writer / branch / source issue revision / as-of status: Claude Code side session of local_a2ffa57e / task/WCP-0108-call-encryption / #128 as filed 2026-11-04 / active
- Related PR/CI evidence and push receipt (request ID / SHA): pending

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
