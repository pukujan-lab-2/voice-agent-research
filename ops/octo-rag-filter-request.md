# Handoff for the Octo session: let RAG search be limited to chosen documents

From: the chatbots / website-copilot project (an Octo adopter). This is a proposal, not a patch.
Octo's rules say adopters never change the Octo repo, so the owner decides and the Octo session builds it.
Paste the "Issue" section below into Octo's `observational-issue.yml` form, or hand this whole file to the Octo session.

## Prompt for the Octo session

> Read `ops/octo-rag-filter-request.md` in `~/Documents/chatbots` (branch `copilot-demo-video`).
> It asks for an optional filter on `POST /api/rag/query` so a search can be limited to some documents in a workspace.
> File it as an observational issue, then, if the owner accepts it, build it with tests.
> Keep the change backward compatible: a query with no filter must behave exactly as today.

## Issue

**Title:** [ISSUE]: RAG query cannot be limited to chosen documents, so apps over-fetch and filter on their side

### Summary

`POST /api/rag/query` takes only `workspaceId`, `query` and `limit` (`src/routes/rag.ts`).
`dbMatchChunksHybrid` (`src/server/db.ts`) and `octo.match_chunks_hybrid(UUID, vector, TEXT, INT)`
(`db/migrations/20261026000000_rag_hybrid_retrieval.sql`) search every chunk in the workspace.

An app that keeps more than one document in a workspace (for example, several product manuals for one customer) cannot ask
"search only manual X". Today the copilot works around it:

1. It lists documents (`GET /api/rag/documents`) and keeps the ones whose title starts with a prefix such as `manual:medicare-signup`.
2. It reads each document's version ids (`GET /api/rag/documents/<id>`).
3. It asks `/rag/query` for 5x the results it needs and drops chunks from other documents.

This wastes searches. It also fails silently once other documents crowd the top results: the right chunks are never returned,
so the copilot says "I don't know" when the manual does answer the question.
Every RAG adopter with more than one document hits this, so it passes the "two or more apps need it the same way" bar for a platform feature.

### Proposal

Add optional filters to `POST /api/rag/query`. Apply them inside the SQL search, before ranking and the limit, not after:

```json
{
  "workspaceId": "…",
  "query": "when does my enrollment period start?",
  "limit": 4,
  "filter": {
    "documentIds": ["uuid", "uuid"],
    "titlePrefix": "manual:medicare-signup",
    "latestVersionOnly": true
  }
}
```

- `documentIds`: only chunks from these documents.
- `titlePrefix`: only documents whose title starts with this text (lets an app group documents without storing ids).
- `latestVersionOnly`: skip chunks from older versions of a document (default could stay as today).
- All fields are optional; the filters combine with AND; an empty `filter` or none at all means today's behavior.
- Return `documentId` and `title` on each match, so apps don't need a second lookup.
- Add the same options to the MCP retrieval tool.

A later step, not needed now: free-form metadata on documents (`{"manual": "medicare", "page": 15}`) with an equality filter.

### Acceptance criteria

- [ ] A query with `documentIds` returns only chunks from those documents, even when other documents score higher.
- [ ] A query with `titlePrefix` returns only chunks from documents whose title starts with it.
- [ ] `latestVersionOnly: true` never returns chunks from an older version.
- [ ] A query with no `filter` returns exactly what it returns today (existing tests unchanged).
- [ ] The filter runs in SQL before the limit: with `limit: 4` and a filter, the result has up to 4 matching chunks, never fewer because of other documents.
- [ ] Workspace isolation is unchanged: a document id from another workspace returns nothing, not an error that confirms it exists.
- [ ] Each match carries `documentId` and `title`.
- [ ] The MCP tool exposes the same filter.

### Boundaries and next action

Out of scope: reranking, answer quality, "I don't know" logic. Those stay in the app (the copilot uses Jev to pick passages and quotes).
Out of scope: changing who can create workspaces or keys (that human gate is correct).

Next action: the owner accepts or declines; if accepted, the Octo session adds the filter to `octo.match_chunks_hybrid` (a new migration),
`dbMatchChunksHybrid`, the route and the MCP tool, with tests for the criteria above.

### Related

- Octo #227: uploaded files are not indexed for RAG automatically. Separate issue, same area.
- Adopter workaround: `copilot-engine/src/guide.ts`, `OctoRetriever` in the chatbots repo. It will switch to the filter once it ships.
