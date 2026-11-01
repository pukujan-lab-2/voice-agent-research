# 0006. Which model does what

**Status:** Replaced by [0009](0009-lfm3-writes-replies.md) · **Date:** 2026-10-31

## Decision

Qwen-Flash writes replies, Jev 1.14 makes decisions (passage picks, verification), and LFM3 runs on the GPU for the per-turn form decision. The typesafe/jev-router is dropped.

## Why

Each model does the job it is cheapest and most reliable at.

## Consequences

Recorded in commit 0b0886b. Keys stay on the backend.
