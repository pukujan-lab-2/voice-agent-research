"""Clean text and metadata out of HTML (trafilatura), Markdown/text, and PDF (Docling, optional)."""
from __future__ import annotations

import re
from collections.abc import Callable
from datetime import timezone
from urllib.parse import urlsplit

from .models import Doc, Fetched
from .pagetype import classify

HTML_LANG = re.compile(r"<html[^>]*\blang\s*=\s*[\"']?([A-Za-z]{2,3})", re.I)
MIN_TEXT = 40

# pdf_reader: bytes -> (title, markdown). The default needs Docling (pip install site-ingest[pdf]).
PdfReader = Callable[[bytes, str], tuple[str, str]]


def docling_pdf(data: bytes, name: str) -> tuple[str, str]:
    import tempfile
    from pathlib import Path

    from docling.document_converter import DocumentConverter

    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "doc.pdf"
        p.write_bytes(data)
        doc = DocumentConverter().convert(str(p)).document
        md = doc.export_to_markdown()
    title = next((m.group(1) for m in re.finditer(r"^#{1,2}\s+(.*\S)", md, re.M)), "")
    return title, md


def detect_language(text: str, default: str) -> str:
    if len(text) < 60:
        return default
    try:
        from py3langid.langid import classify as lid
        return lid(text[:2000])[0]
    except Exception:  # noqa: BLE001
        return default


def _iso(d: str | None) -> str:
    return (d or "")[:10]


def from_html(f: Fetched, default_language: str, overrides: dict[str, str] | None = None) -> Doc | None:
    import trafilatura

    html = f.body.decode("utf-8", errors="replace")
    md = trafilatura.extract(html, url=f.url, output_format="markdown", include_tables=True, include_links=False, favor_recall=True)
    if not md or len(md) < MIN_TEXT:
        return None
    meta = trafilatura.extract_metadata(html, default_url=f.url)
    title = (meta.title if meta and meta.title else "") or next((m.group(1) for m in re.finditer(r"^#\s+(.*\S)", md, re.M)), "") or urlsplit(f.url).path
    m = HTML_LANG.search(html[:4000])
    lang = (m.group(1).lower() if m else "") or detect_language(md, default_language)
    modified = _iso(meta.date if meta else None) or _iso(f.last_modified and _http_date(f.last_modified))
    return Doc(f.url, title.strip(), lang, modified, classify(f.url, title, overrides), md, "html")


def _http_date(s: str) -> str:
    from email.utils import parsedate_to_datetime
    try:
        return parsedate_to_datetime(s).astimezone(timezone.utc).strftime("%Y-%m-%d")
    except Exception:  # noqa: BLE001
        return ""


def from_text(f: Fetched, default_language: str, overrides: dict[str, str] | None, kind: str) -> Doc | None:
    md = f.body.decode("utf-8", errors="replace").strip()
    if len(md) < MIN_TEXT:
        return None
    fm = re.match(r"^---\n(.*?)\n---\n", md, re.S)             # optional front matter: title, lang, date
    front: dict[str, str] = {}
    if fm:
        for line in fm.group(1).splitlines():
            k, _, v = line.partition(":")
            front[k.strip().lower()] = v.strip().strip("\"'")
        md = md[fm.end():].strip()
    title = front.get("title") or next((m.group(1) for m in re.finditer(r"^#\s+(.*\S)", md, re.M)), "") or urlsplit(f.url).path.rsplit("/", 1)[-1]
    lang = (front.get("lang") or front.get("language") or "").lower() or detect_language(md, default_language)
    modified = _iso(front.get("date") or front.get("last_modified")) or _http_date(f.last_modified)
    return Doc(f.url, title, lang, modified, classify(f.url, title, overrides, kind), md, kind)


def from_pdf(f: Fetched, default_language: str, overrides: dict[str, str] | None, reader: PdfReader) -> Doc | None:
    title, md = reader(f.body, f.url)
    if len(md) < MIN_TEXT:
        return None
    title = title or urlsplit(f.url).path.rsplit("/", 1)[-1]
    return Doc(f.url, title, detect_language(md, default_language), _http_date(f.last_modified), classify(f.url, title, overrides, "pdf"), md, "pdf")


def extract(f: Fetched, default_language: str = "en", overrides: dict[str, str] | None = None, pdf_reader: PdfReader | None = None) -> Doc | None:
    """The Doc for a fetched source, or None when it has no usable text (an image, a nearly empty page)."""
    ct = f.content_type.lower()
    path = urlsplit(f.url).path.lower() if "://" in f.url else f.url.lower()
    if "pdf" in ct or path.endswith(".pdf"):
        return from_pdf(f, default_language, overrides, pdf_reader or docling_pdf)
    if path.endswith((".md", ".markdown")) or "markdown" in ct:
        return from_text(f, default_language, overrides, "markdown")
    if path.endswith(".txt") or ct.startswith("text/plain"):
        return from_text(f, default_language, overrides, "text")
    if "html" in ct or path.endswith((".html", ".htm")) or not ct:
        return from_html(f, default_language, overrides)
    return None


