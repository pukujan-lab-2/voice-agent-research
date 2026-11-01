"""Where a business's pages and passages are kept: search documents in Octo (one per passage, titled
<business>/<language>/<page type>/<id>) and two tables in the workspace's own database that hold the metadata and
what was crawled when. Plain SQL only, with $n parameters, so the same statements run on Octo's Postgres and in tests."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Protocol

from .models import PageRow, PassageRow

SCHEMA = [
    """create table if not exists site_pages (
  business text not null, url text not null, content_hash text not null, title text, page_type text, language text, kind text,
  etag text, last_modified text, dup_of text, passage_count int not null default 0, crawled_at text not null,
  primary key (business, url))""",
    "create index if not exists site_pages_hash on site_pages (business, content_hash)",
    """create table if not exists site_passages (
  id text primary key, business text not null, url text not null, seq int not null, title text, section text, page_type text,
  language text, last_modified text, text_hash text not null, text text not null, doc_id text)""",
    "create index if not exists site_passages_url on site_passages (business, url)",
    "create index if not exists site_passages_hash on site_passages (business, text_hash)",
]
PAGE_COLS = ["url", "content_hash", "title", "page_type", "language", "kind", "etag", "last_modified", "dup_of", "passage_count"]
PASSAGE_COLS = ["id", "business", "url", "seq", "title", "section", "page_type", "language", "last_modified", "text_hash", "text", "doc_id"]


class Backend(Protocol):
    def sql(self, text: str, params: list | None = None) -> dict: ...
    def put_document(self, title: str, text: str) -> str: ...
    def delete_document(self, doc_id: str) -> None: ...


def _marks(start: int, n: int) -> str:
    return ",".join(f"${start + i}" for i in range(n))


class SiteStore:
    def __init__(self, backend: Backend, business: str, workers: int = 4, now=None):
        self.b, self.business, self.workers = backend, business, workers
        import time
        self._now = now or (lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))

    def ensure_schema(self) -> None:
        for stmt in SCHEMA:
            self.b.sql(stmt)

    def _rows(self, text: str, params: list) -> list[dict]:
        return self.b.sql(text, params).get("rows", [])

    # ----- pages -----
    def pages(self) -> dict[str, PageRow]:
        out: dict[str, PageRow] = {}
        for r in self._rows(f"select {','.join(PAGE_COLS)} from site_pages where business = $1", [self.business]):
            out[r["url"]] = PageRow(**{c: (r[c] if r[c] is not None else ("" if c != "passage_count" else 0)) for c in PAGE_COLS})
        return out

    def page_with_hash(self, content_hash: str, not_url: str) -> str | None:
        rows = self._rows("select url from site_pages where business = $1 and content_hash = $2 and url <> $3 and coalesce(dup_of, '') = '' limit 1",
                          [self.business, content_hash, not_url])
        return rows[0]["url"] if rows else None

    def save_page(self, p: PageRow) -> None:
        vals = [self.business, *[getattr(p, c) for c in PAGE_COLS], self._now()]
        cols = ["business", *PAGE_COLS, "crawled_at"]
        sets = ",".join(f"{c} = excluded.{c}" for c in cols if c not in ("business", "url"))
        self.b.sql(f"insert into site_pages ({','.join(cols)}) values ({_marks(1, len(cols))}) on conflict (business, url) do update set {sets}", vals)

    def delete_page(self, url: str) -> None:
        self.b.sql("delete from site_pages where business = $1 and url = $2", [self.business, url])

    # ----- passages -----
    def passages(self, url: str) -> list[PassageRow]:
        rows = self._rows(f"select {','.join(PASSAGE_COLS)} from site_passages where business = $1 and url = $2 order by seq", [self.business, url])
        return [PassageRow(**{c: (r[c] if r[c] is not None else "") for c in PASSAGE_COLS}) for r in rows]

    def hashes_elsewhere(self, hashes: list[str], not_url: str) -> set[str]:
        """Which of these passage texts are already indexed on another page of this business."""
        found: set[str] = set()
        for i in range(0, len(hashes), 200):
            part = hashes[i:i + 200]
            for r in self._rows(f"select distinct text_hash from site_passages where business = $1 and url <> $2 and text_hash in ({_marks(3, len(part))})",
                                [self.business, not_url, *part]):
                found.add(r["text_hash"])
        return found

    def add_passages(self, rows: list[PassageRow]) -> None:
        """Search documents first (in parallel), then the rows, so a row never points at a missing document."""
        def put(r: PassageRow) -> None:
            r.doc_id = self.b.put_document(r.id, f"{r.title} - {r.section}\n{r.text}" if r.section else f"{r.title}\n{r.text}")
        with ThreadPoolExecutor(self.workers) as ex:
            list(ex.map(put, rows))
        for i in range(0, len(rows), 60):
            part = rows[i:i + 60]
            params: list = []
            for r in part:
                params += [getattr(r, c) for c in PASSAGE_COLS]
            groups = ",".join(f"({_marks(1 + j * len(PASSAGE_COLS), len(PASSAGE_COLS))})" for j in range(len(part)))
            sets = ",".join(f"{c} = excluded.{c}" for c in PASSAGE_COLS if c != "id")
            self.b.sql(f"insert into site_passages ({','.join(PASSAGE_COLS)}) values {groups} on conflict (id) do update set {sets}", params)

    def update_positions(self, rows: list[PassageRow]) -> None:
        for r in rows:
            self.b.sql("update site_passages set seq = $3, last_modified = $4 where business = $1 and id = $2", [self.business, r.id, r.seq, r.last_modified])

    def remove_passages(self, rows: list[PassageRow]) -> None:
        with ThreadPoolExecutor(self.workers) as ex:
            list(ex.map(lambda r: r.doc_id and self.b.delete_document(r.doc_id), rows))
        for i in range(0, len(rows), 200):
            part = rows[i:i + 200]
            self.b.sql(f"delete from site_passages where business = $1 and id in ({_marks(2, len(part))})", [self.business, *[r.id for r in part]])

    def counts(self) -> tuple[int, int]:
        p = self._rows("select count(*) as n from site_pages where business = $1 and coalesce(dup_of, '') = ''", [self.business])
        q = self._rows("select count(*) as n from site_passages where business = $1", [self.business])
        return int(p[0]["n"]), int(q[0]["n"])
