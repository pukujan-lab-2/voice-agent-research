# 0017. The model sees a window of the form; state lives in stores with a cap

**Status:** Accepted · **Date:** 2026-11-01

## Decision

Code owns the state; the model never does, and it is only shown a fixed-size window of it.

- A form of up to 24 fields is listed to the model in full. A bigger one shows the open field, the next few, the last few filled and any field the visitor names, plus a count of the rest (`docs/scaling-limits.md`).
- State on the server lives behind the `Store` interface, with a time limit and a hard size cap. What must survive a restart or be seen by a second instance goes in Octo: caller-verification locks, resume snapshots, each business's config and its map of pages and forms.
- Two things stay in the process, capped: rate-limit counters, and caches of data Octo already holds. They hold no customer data and losing them costs a fetch or a few extra requests.

## Why

The owner asked how state is handled and what happens when a form or a site is very large. The prompt grew by about 300 characters per field in the test form (101,000 characters at 300 fields), the backend's maps had no hard cap, and a restart lost every verification lock. Decision 0004 already says Octo is the one store; this says which state that covers and which small counters it does not.

## Consequences

- Rate limits are per instance, so N instances allow N times the limit. An Octo round trip (about 67 ms) is slower than a desk turn can spare. If that matters, a shared counter can move to Octo behind the same interface.
- A field outside the window is filled when the visitor names it or when it comes up in order, not by the model guessing its name.
- Octo has no key-value surface with expiry; the table is ours, and a proposal is filed on the Octo repository (octo-database#457).
