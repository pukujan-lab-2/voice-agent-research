# Loading a business's own site into Octo

One pipeline (`ingest/`) takes a business's site and documents and makes them searchable by the copilot. It replaces
the one-off IRS loaders' copies of the Octo client and upsert code (`demo/live-site/tools/irs_*.py`, `lib_ingest.py`
now import `ingest/src/site_ingest/octo.py`); the IRS fetchers' own parsing stays where it is.

## Use

```bash
cd ingest && uv run site-ingest --business acme --sitemap https://acme.com/sitemap.xml --docs ./manuals
```

| Input | Meaning |
|---|---|
| `--business` | The business's prefix, 2-40 lowercase letters, digits and dashes. `irs`, `irc`, `cfr`, `irm`, `irb`, `manual`, `forms`, `nyc` are reserved. |
| `--sitemap` / `--start-url` | A sitemap (indexes and `.gz` followed) or a start address crawled breadth-first on the same host (`--max-pages`, `--max-depth`). robots.txt is obeyed; tracking parameters and fragments are dropped. |
| `--docs` | A folder of `.html`, `.md`, `.txt`, `.pdf`. Markdown may start with `title:`, `lang:`, `date:` front matter. |
| `--include`, `--exclude` | Regular expressions on addresses. |
| `--page-type /shop/=product` | Own page-type rules, tried before the built-in ones. |
| `--key-env`, `--workspace-env` | Which Octo key and workspace to load into (a business may have its own workspace). |

It prints what happened, for example `discovered 4: 4 new, 0 changed, 0 unchanged, 0 deleted, 0 duplicate pages ...;
indexed now: 4 pages, 11 passages`.

## What each part is (and why)

| Part | Choice | Why |
|---|---|---|
| HTML to clean text, title, date | trafilatura (Apache-2.0) | Removes navigation and footers, keeps headings and tables as Markdown, reads the page date. One dependency for extraction and metadata. |
| Sitemaps, crawling | a small module over `httpx` | Needs conditional GETs (ETag, Last-Modified), which trafilatura's own crawler does not do; that is what makes a re-crawl cheap. |
| PDF | Docling (`pip install site-ingest[pdf]`) | Layout and tables; the lab already uses it (`copilot-engine/tools/docling_passages.py`). Optional so tests and CI stay light. |
| Language | the page's `lang`, else py3langid, else `--language` | |
| JavaScript-rendered sites | Crawl4AI, **not included** | Nothing here needs it yet. The seam is `Source.fetch`: a Crawl4AI fetcher returns the same `Fetched` object. |

## What is stored

Search documents: one per passage, titled `<business>/<language>/<page type>/<url hash>-<passage hash>` (Octo filters by
title prefix, so a search can be narrowed to one business, then one language, then one page type). Text starts with
`<page title> - <section>`.

Two tables in the workspace's own database:

- `site_pages`: business, url, content hash, title, page type, language, kind, ETag, Last-Modified, `dup_of`, passage count, crawled at.
- `site_passages`: id (the document title), business, url, seq, title, section, page type, language, last modified, text hash, text, Octo document id.

Page types: faq, policy, pricing, contact, about, product, blog, docs, page (HTML), document (PDF, Markdown, text).

## Re-crawl rules

- The site is asked first (`If-None-Match`, `If-Modified-Since`); 304 means nothing is read or written.
- A page whose cleaned text hash is unchanged writes nothing.
- A changed page replaces only the passages whose title, section or text changed; the others keep their search document.
- A page that returns 404 or 410, or is no longer listed, has its passages removed from search and from the tables. If more than half of the known pages would go at once (a broken sitemap), nothing is deleted unless `--allow-mass-delete`; an empty listing never deletes.
- The same text at two addresses is indexed once (`dup_of`); a passage that already exists on another page of the business is dropped and counted.
- One failing page does not stop the run and is not recorded, so the next run retries it.

## Limits observed

- Live ingest into Octo takes about 0.4 s per passage (one HTTP call that embeds). With 4 workers that is roughly 10 passages a second, so 100,000 passages is about three hours; the load is the embedding, not this code.
- Octo's document API has no metadata or batch call. Metadata lives in `site_passages` and in the title prefix. A native metadata filter and batch ingest are filed in the Octo repository (see docs/retrieval-limits.md).
- A page with one or two sentences may keep its navigation text, because trafilatura's boilerplate removal needs some content to work with.
- Not exercised: Crawl4AI; Docling is tested only when installed.
