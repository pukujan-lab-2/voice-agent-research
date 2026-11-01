"""Crawl -> clean -> split -> load, and re-crawl only what changed.

For each source: ask the site if it changed (ETag / Last-Modified), clean it, hash the text. Same hash: nothing is
written. Changed: only the passages whose text changed are replaced (a passage's id holds a hash of its text, so an
unchanged passage keeps its search document). Gone (404, or no longer listed): its passages are removed, unless that
would remove most of the site, which looks like a broken sitemap and needs allow_mass_delete."""
from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from urllib.parse import urlsplit

from . import chunk, extract
from .models import Doc, PageRow, PassageRow, Report, business_slug, sha
from .sources import Source
from .store import SiteStore


@dataclass
class Config:
    business: str
    max_chars: int = 900
    min_chars: int = 80
    workers: int = 4
    default_language: str = "en"
    page_types: dict[str, str] = field(default_factory=dict)   # address fragment -> page type, tried before the rules
    allow_mass_delete: bool = False
    delete_guard: float = 0.5                                  # refuse to delete more than this share of known pages
    pdf_reader: extract.PdfReader | None = None

    def __post_init__(self) -> None:
        business_slug(self.business)


def passage_id(business: str, doc: Doc, url_hash: str, identity: str) -> str:
    """The search document's title. The prefix carries language and page type (Octo filters by title prefix); the tail
    is the page address plus a hash of the passage's title, section and text, so an edit makes a new id."""
    return f"{business}/{doc.language}/{doc.page_type}/{url_hash}-{identity}"


def run(cfg: Config, store: SiteStore, sources: list[Source]) -> Report:
    rep = Report(discovered=len(sources))
    store.ensure_schema()
    known = store.pages()
    lock = threading.Lock()
    claimed: dict[str, str] = {}      # content hash -> url, for pages handled in this run
    claimed_text: dict[str, str] = {} # passage text hash -> url, so two pages loading at once do not both index one passage

    def handle(src: Source) -> None:
        prev = known.get(src.url)
        f = src.fetch(prev)
        if f.status in (404, 410):
            if prev:
                _delete(src.url)
            else:
                with lock: rep.skipped += 1
            return
        if f.status == 304:
            with lock: rep.unchanged += 1
            return
        if f.status != 200:
            with lock:
                rep.failed += 1 if f.status != 403 else 0
                rep.skipped += 1 if f.status == 403 else 0
                if f.status != 403: rep.errors.append(f"{src.url}: {f.error or f.status}")
            return
        try:
            doc = extract.extract(f, cfg.default_language, cfg.page_types, cfg.pdf_reader)
        except Exception as e:  # noqa: BLE001
            with lock: rep.failed += 1; rep.errors.append(f"{src.url}: extract failed: {e}")
            return
        if doc is None:
            with lock: rep.skipped += 1
            return
        chash = sha(doc.markdown)
        if prev and prev.content_hash == chash and not prev.dup_of:
            if (prev.etag, prev.last_modified) != (f.etag, f.last_modified):
                store.save_page(PageRow(**{**prev.__dict__, "etag": f.etag, "last_modified": f.last_modified}))
            with lock: rep.unchanged += 1
            return
        with lock:
            other = claimed.get(chash)
            if other is None:
                claimed[chash] = src.url
        other = other or store.page_with_hash(chash, src.url)
        row = PageRow(src.url, chash, doc.title, doc.page_type, doc.language, doc.kind, f.etag, f.last_modified)
        if other:                     # the same text lives at another address: indexed once
            if prev and not prev.dup_of: _drop_passages(src.url)
            row.dup_of = other
            store.save_page(row)
            with lock: rep.duplicate_pages += 1
            return
        drafts = chunk.split(doc.markdown, doc.title, cfg.max_chars, cfg.min_chars)
        uh = sha(src.url, 8)
        wanted: dict[str, PassageRow] = {}
        for d in drafts:
            th = sha(d.text, 16)
            pid = passage_id(cfg.business, doc, uh, sha(f"{doc.title}\n{d.section}\n{d.text}", 16))
            if pid in wanted:
                continue
            wanted[pid] = PassageRow(pid, cfg.business, src.url, d.seq, doc.title, d.section, doc.page_type, doc.language, doc.last_modified, th, d.text)
        old = {p.id: p for p in store.passages(src.url)}
        fresh = [p for pid, p in wanted.items() if pid not in old]
        elsewhere = store.hashes_elsewhere([p.text_hash for p in fresh], src.url) if fresh else set()
        with lock:
            for p in fresh:
                if claimed_text.setdefault(p.text_hash, src.url) != src.url:
                    elsewhere.add(p.text_hash)
        dropped = [p for p in fresh if p.text_hash in elsewhere]
        fresh = [p for p in fresh if p.text_hash not in elsewhere]
        for p in fresh: old.pop(p.id, None)
        gone = [p for pid, p in old.items() if pid not in wanted]
        kept = [p for pid, p in old.items() if pid in wanted]
        for p in kept:                # same passage, possibly in a new position
            w = wanted[p.id]
            if (p.seq, p.last_modified) != (w.seq, w.last_modified):
                p.seq, p.last_modified = w.seq, w.last_modified
                fresh_meta.append(p)
        if fresh:
            store.add_passages(fresh)     # new documents first, then retire the old ones
        if gone:
            store.remove_passages(gone)
        row.passage_count = len(wanted) - len(dropped)
        store.save_page(row)
        with lock:
            rep.new += 0 if prev else 1
            rep.changed += 1 if prev else 0
            rep.passages_added += len(fresh)
            rep.passages_removed += len(gone)
            rep.passages_duplicate += len(dropped)

    fresh_meta: list[PassageRow] = []

    def _drop_passages(url: str) -> None:
        rows = store.passages(url)
        if rows:
            store.remove_passages(rows)
            with lock: rep.passages_removed += len(rows)

    def _delete(url: str) -> None:
        _drop_passages(url)
        store.delete_page(url)
        with lock: rep.deleted += 1

    def safe(src: Source) -> None:
        try:
            handle(src)
        except Exception as e:  # noqa: BLE001
            with lock: rep.failed += 1; rep.errors.append(f"{src.url}: {type(e).__name__}: {e}")

    with ThreadPoolExecutor(cfg.workers) as ex:
        list(ex.map(safe, sources))
    if fresh_meta:
        store.update_positions(fresh_meta)

    # pages that are no longer listed
    listed = {s.url for s in sources}
    missing = [u for u in known if u not in listed]
    if missing and listed:
        if len(missing) > cfg.delete_guard * len(known) and not cfg.allow_mass_delete:
            rep.deletes_blocked = len(missing)
            rep.errors.append(f"{len(missing)} of {len(known)} known pages are no longer listed; not deleted (pass allow_mass_delete to confirm)")
        else:
            for u in missing:
                _delete(u)
    elif missing:
        rep.deletes_blocked = len(missing)
        rep.errors.append("the source listed nothing; nothing deleted")
    rep.indexed_pages, rep.indexed_passages = store.counts()
    return rep


def host_of(url: str) -> str:
    return urlsplit(url).netloc
