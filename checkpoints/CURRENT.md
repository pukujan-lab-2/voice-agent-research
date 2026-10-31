# Current Repository Checkpoint

<!-- continuity:current {"active_task":null,"active_task_file":null,"protocol_version":"0.1.0-draft","schema":"project-continuity.current.v1"} -->

This is an as-of projection (2026-10-31); live GitHub issues own progression. Link the owning leaf, parent ancestry and dependencies for active work.

Older state: [`history/2026-10.md`](history/2026-10.md) and earlier months in `history/`.

## Program state

Phase: demo build. The copilot runs locally on fictional demo sites; nothing is hosted (decision 0007, #9).

## Active

- Voice rebuild on LiveKit Agents (#11), by the live-demo-site session.
- IRS library load into Octo (#18), running with 4 workers.

## Queued

- Clarifying questions (#12), follow-up context (#13), advice hand-off (#14), eval re-baseline (#15).
- v2 desk merge (#16), call logger and insights (#17), offline scene test (#19).
- Move CI from the Pro stopgap to the VPS once it exists (#25). On the Pro, the stack-train check (not required) fails in `setup-python`.

## Blockers

- `continuity validate` fails on the folder layout: PCM's managed-worktrees mode wants `<project>/main` with task worktrees under `<project>/worktrees/`, and the Claude app keeps worktrees inside the checkout (`.claude/worktrees`). Needs the owner's decision before `continuity worktree migrate`. `single-checkout` is not an option: it forbids linked worktrees. The migrate also refuses while worktrees hold uncommitted or unpushed work, and moving the checkout breaks Claude app sessions bound to `~/Documents/chatbots`.

## Next atomic action

Get the owner's decision on the folder layout, then run `continuity worktree migrate --root ~/Documents/chatbots` (dry run first).
