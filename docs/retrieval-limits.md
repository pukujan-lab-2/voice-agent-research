# Limits of the knowledge and data layer

What the copilot can do on a very large site, and what was measured. All figures were observed on 2026-11-01 unless they say otherwise; "inference" marks anything that was not measured. The design is decision [0018](decisions/0018-huge-sites-search-prose-declared-lookups-records.md).

## Search at size

`eval/size/bench.py` builds Octo's RAG tables in a scratch pgvector database, copies Octo's current `octo.match_chunks_hybrid` out of its migrations unchanged, loads a synthetic site (every passage names a unique product, feature, region and accessory; a second small business shares the workspace) and times the function the way `/api/rag/query` calls it. Embeddings are feature-hashed bags of words, so the recall figures say the index and the filters find a planted passage among look-alikes, not how good an embedding model is. The reranker is not in this path. 100 queries per row, one backend on a 2-CPU Docker VM, so only compare rows with each other.

| Passages | Load + index | No filter | One business's whole prefix | Business + language | Business + language + page type | By section (ids + prefix) | A 2,000-passage business in the same workspace |
|---|---|---|---|---|---|---|---|
| 10,000 | 8 s | 23 ms | 53 ms | 37 ms | 15 ms | 15 ms | 18 ms |
| 50,000 | 55 s | 71 ms | 363 ms | 189 ms | 59 ms | 56 ms | 39 ms |
| 200,000 | 138 s | 238 ms | **2,112 ms** | 1,788 ms | 375 ms | 267 ms | 209 ms |

(median latency; the files are `eval/out/synthetic-<n>/latency.json`.)

Recall (ranx through `eval/retrieval.py`, all queries and filters together): recall@5 / recall@10 / MRR were 1.0 / 1.0 / 1.0 at 10,000, 1.0 / 1.0 / 0.998 at 50,000 and 0.997 / 0.997 / 0.993 at 200,000. The unfiltered row at 200,000 is the lowest (0.98 / 0.98 / 0.955); every filtered row stayed at 1.0 because the filter removes the look-alikes.

**What is slow, and where it is filed.** A filtered search costs time in proportion to the number of chunks under the prefix, not the workspace: 4x the chunks (50,000 to 200,000) took 5.8x as long, while a small business in the same workspace stayed at 39 to 209 ms. At 200,000 chunks under one prefix the 2.1 s splits into three parts of about 0.75 s each: building the allowed set, the filtered vector arm (an exact scan because of `ORDER BY distance + 0`; 787 ms, against 2 ms on the HNSW index with iterative scans) and the filtered lexical arm. Written up with these numbers on Pukujan-lab/octo-database#391. Metadata filters (section, page type, language) and batch ingest do not exist in Octo; filed as octo-database#459. The copilot works around neither with a local copy: language and page type go in the title prefix, the section goes through document ids, and the rest waits for Octo.

- **1,000,000 passages was not measured**: the scratch VM has 2 GB. If the cost keeps growing with the chunks under one prefix, a business that large would see about 10 s per whole-site search (inference). A filter by language and page type, or by section, narrows the allowed set and stays far lower. Until Octo ships the fix on #391, a business near that size should be searched with a language and page type filter.
- The earlier IRS note in `guide.ts` ("about 15 s of 25 s on 32,000 passages") was measured on 2026-10-30, before Octo's access-check fix.

## The IRS library on the live Octo

`node eval/size/irs-live.ts` replays 80 gold-labelled casual questions through `OctoRetriever` (hybrid search, reranker on, five title prefixes), one at a time.

| | Before (eval run of 2026-10-31) | After (2026-11-01, 145,519 indexed passages) |
|---|---|---|
| Search time, p50 / p90 / max | 8.8 s / 11.6 s / 13.9 s (40 questions) | 1.5 s / 2.4 s / 3.3 s (80 questions) |
| recall@5 / recall@10 / MRR, casual questions | 0.83 / 0.89 / 0.72 (100 questions) | 0.76 / 0.84 / 0.70 (80 questions, a different sample) |

The search speed-up is Octo's, not this change's. The recall difference is within the noise of two different samples of a library that grew from 32,000 to 145,519 passages; it was not re-run on the same questions.

## Loading a site

`ingest/` (see [ingest.md](ingest.md)): the cost is the embedding. A live `POST /api/rag/documents` took about 0.4 s for one passage, so with 4 parallel callers a 100,000-passage site is roughly 3 hours (inference from that rate). A re-crawl of an unchanged site writes nothing: the site answers 304 and the content hashes match. An edited page replaces only the passages whose text changed.

## Tool calls per turn

These are caps in code, tested.

| Limit | Value | Where |
|---|---|---|
| `search_site` results per call | 4, each cut to 400 characters (the model-facing text stays under 2,600 characters whatever the site size) | `copilot-engine/src/search-site.ts` |
| `search_site` calls per turn | 3; the fourth is refused with a note | same |
| Trips back to the model per turn while it only searches | 3, then its answer is used | `Desk.chatRounds` |
| `answer_question` and record lookups per turn, together | 3; the rest are refused | `Desk.apply` |
| Rows per record lookup | at most 5; values cut to 200 characters | `copilot-engine/src/lookups.ts` |
| Fields per record lookup | at most 12 declared | same |

A filter the model asks for (a section or page type) that finds nothing is dropped once and the search repeated, in `search_site` and in `answer_question`, so a wrong guess does not turn into "I don't know".

## Checks that run without keys

`node eval/hugesite.ts` (and `eval/tests/hugesite.test.ts` in CI): 94 simulated callers on two businesses, fact callers cite the gold passage 100% of the time at 3,000 and at 20,000 passages (25,000 including the second business); 0 failures on citation, word-for-word quote, private values (canary strings), other-business data, declared statements, size and call caps. The retriever there is a word-overlap stand-in, so this shows the guarantees hold, not retrieval quality.

## Not measured

- 1,000,000 passages (above); the reranker's time on the synthetic site; Jev's time per passage pick at size; real embeddings on the synthetic site.
- Docling and large PDFs at volume; JavaScript-rendered sites (Crawl4AI is not included).
- The live site does not use any of this yet: wiring waits for the per-business config (#103).
