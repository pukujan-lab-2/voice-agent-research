# 0009. LFM3 writes replies

**Status:** Accepted · **Date:** 2026-11-01 · Replaces [0006](0006-model-routing.md)

## Decision

LFM3 writes the copilot's replies and makes the per-turn form decision, on our GPU. Jev 1.14 makes the yes/no and passage-pick decisions. Qwen-Flash is not used, and no other reply models are being compared.

## Why

The owner doesn't want Qwen-Flash (2026-11-01, #39). LFM3 is open-weight (decision 0001), already the v2 desk's default, and it passed every safety check in the 80-conversation desk run (seed 12): 100% field accuracy, nothing submitted without a yes, 441 of 443 read-backs confirmed. It also replied faster than Qwen-Flash, with a median of 0.54 s against 1.56 s.

## Consequences

LFM3 sounds less natural than Qwen-Flash did: the judge scored it 2.26 against 2.74 as a receptionist, and 2.48 against 3.36 on how well the call was handled. That gap gets closed in code, with more code-written phrasing and tighter reply templates, not by switching models. Model routing is otherwise as 0006 said: the typesafe/jev-router stays dropped and keys stay on the backend.
