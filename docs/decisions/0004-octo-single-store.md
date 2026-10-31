# 0004. Octo is the one store

**Status:** Accepted · **Date:** 2026-10-30

## Decision

Documents, passages, search, files, customer records and call logs live in Octo DB. There are no local or static fallback copies.

## Why

The owner said Octo is durable and asked for no fallbacks. Two copies drift.

## Consequences

If Octo is down, the copilot says it can't look that up right now. It doesn't serve stale copies.
