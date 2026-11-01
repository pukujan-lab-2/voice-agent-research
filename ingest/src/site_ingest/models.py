from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field

# Prefixes the IRS library already uses in the chatbots workspace; a business may not take them.
RESERVED = {"irs", "irc", "cfr", "irm", "irb", "manual", "forms", "nyc", "zz-scratch"}
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{1,39}$")


def business_slug(name: str) -> str:
    if not SLUG.match(name) or name in RESERVED:
        raise ValueError(f"business must be 2-40 lowercase letters, digits or dashes and not reserved: {name!r}")
    return name


def sha(text: str, n: int = 64) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:n]


@dataclass
class Fetched:
    """One source fetched: status 200 (body set), 304 (unchanged since the stored validators), 404/410 (gone), or an error."""
    url: str
    status: int
    body: bytes = b""
    content_type: str = ""
    etag: str = ""
    last_modified: str = ""
    error: str = ""


@dataclass
class Doc:
    """A cleaned page or document, before it is split."""
    url: str
    title: str
    language: str
    last_modified: str
    page_type: str
    markdown: str
    kind: str  # html | markdown | pdf | text


@dataclass
class Draft:
    """One passage cut from a Doc."""
    seq: int
    section: str
    text: str


@dataclass
class PageRow:
    url: str
    content_hash: str
    title: str = ""
    page_type: str = ""
    language: str = ""
    kind: str = ""
    etag: str = ""
    last_modified: str = ""
    dup_of: str = ""
    passage_count: int = 0


@dataclass
class PassageRow:
    id: str            # also the Octo document title: <business>/<language>/<page type>/<url hash>-<text hash>
    business: str
    url: str
    seq: int
    title: str
    section: str
    page_type: str
    language: str
    last_modified: str
    text_hash: str
    text: str
    doc_id: str = ""   # the Octo document id, to delete it later


@dataclass
class Report:
    discovered: int = 0
    new: int = 0
    changed: int = 0
    unchanged: int = 0
    deleted: int = 0
    duplicate_pages: int = 0
    skipped: int = 0
    failed: int = 0
    passages_added: int = 0
    passages_removed: int = 0
    passages_duplicate: int = 0
    deletes_blocked: int = 0
    indexed_pages: int = 0
    indexed_passages: int = 0
    errors: list[str] = field(default_factory=list)

    def summary(self) -> str:
        return (f"discovered {self.discovered}: {self.new} new, {self.changed} changed, {self.unchanged} unchanged, "
                f"{self.deleted} deleted, {self.duplicate_pages} duplicate pages, {self.skipped} skipped, {self.failed} failed; "
                f"passages +{self.passages_added} -{self.passages_removed} ({self.passages_duplicate} duplicates dropped); "
                f"indexed now: {self.indexed_pages} pages, {self.indexed_passages} passages")
