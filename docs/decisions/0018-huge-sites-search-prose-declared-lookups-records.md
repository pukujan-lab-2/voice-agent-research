# 0018. Huge sites: search for prose, declared lookups for records

**Status:** Accepted · **Date:** 2026-11-01

## Decision

A business with a very large site or database is served by two things, both reached through tool calls that code defines:

- **Prose** (pages, manuals, PDFs) is loaded by one ingestion pipeline (`ingest/`) into the business's own prefix in Octo and found by Octo's hybrid search. The model has two tools: `answer_question` (search, Jev picks the passage, the reply is a quote with its citation) and `search_site` (look first: up to 4 passages of 400 characters, 3 searches and 3 trips to the model per turn). Both can be narrowed by section, page type and language.
- **Records** (an order, an appointment, a price) are read through **lookups the business declares** in its config. Code builds the SQL from the declaration, binds the model's values as parameters, returns only the declared fields, adds the business's own scope, and for anything about a person returns only the verified caller's own rows.

What this settles:

1. The model never writes SQL, a table, a column or a filter, and never decides who the caller is.
2. A lookup's reply is composed by code from declared fields, as an answer is composed from a quote. Nothing the model says alongside it is spoken.
3. Each lookup has a risk score under [0011](0011-model-leads-risk-sets-confirmation.md): under 56 it runs, 56 to 90 it waits for a recorded yes, 91 and up a person does it. A lookup about a person needs a verified caller first, whatever its score, and never scores below 45.
4. Octo stays the one store ([0004](0004-octo-single-store.md)). When Octo is slow or lacks a feature (metadata filters, batch ingest, filtered search at size), the gap is filed in the Octo repository; there is no local copy of a business's data to get around it.
5. A business's passages are kept apart by title prefix (`<business>/<language>/<page type>/…`) and by a table keyed by business; the retriever drops any result outside the prefix even if Octo returns it.

## Why

The owner asked how the copilot gets something to work with on huge sites: RAG, a database, or tool calls for both (#107). Prose and records need different handling: prose is long and fuzzy, so the copilot searches it and quotes; a record is exact, so it is looked up by key and read from declared fields. Making both tool calls keeps the model's job small (decision 0001's open models) and keeps code in charge of state and safety (0011).

## Consequences

- Limits measured for passages, latency per size and calls per turn are in [../retrieval-limits.md](../retrieval-limits.md).
- Wiring the retriever, `search_site` and the lookups into the live site per business waits for the per-business config (#103); until then a host builds them in code.
- Declared lookups are equality matches on one table, read only. Joins, ranges, free-text search over records and writes need a new decision.
