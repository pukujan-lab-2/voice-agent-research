# 0001. Open models only in the product

**Status:** Accepted · **Date:** 2026-10-29

## Decision

The copilot that runs on a customer's site uses open-weight models (LFM3, Qwen and similar) and the Jev decisions API. Claude can help us build, test and write code, but it never runs inside a customer's copilot.

## Why

Customers keep their data in house, and we can run the whole product on our own hardware without a per-call bill from a closed model.

## Consequences

Model picks are limited to open weights. `docs/08-speech-model-licenses.md` tracks which ones are safe to sell.
