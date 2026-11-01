"""Where pages come from: a sitemap or start URL (HTTP, robots.txt respected, conditional GETs) and a folder of documents."""
from __future__ import annotations

import re
import time
from collections import deque
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib import robotparser
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import httpx

from .models import Fetched, PageRow

UA = "WebsiteCopilotIngest/0.1 (+https://copilot.design-bakery.com)"
TRACKING = re.compile(r"^(utm_|fbclid|gclid|mc_|ref$|session|sid$)", re.I)
SKIP_EXT = re.compile(r"\.(jpe?g|png|gif|svg|webp|ico|css|js|json|xml|zip|gz|mp[34]|mov|woff2?|ttf|eot)$", re.I)
DOC_EXT = {".html", ".htm", ".md", ".markdown", ".txt", ".pdf"}


def normalize(url: str) -> str:
    """One address per page: no fragment or tracking parameters, sorted query, lowercase host, no trailing slash."""
    p = urlsplit(url.strip())
    host = (p.hostname or "").lower()
    if p.port and not ((p.scheme == "http" and p.port == 80) or (p.scheme == "https" and p.port == 443)):
        host = f"{host}:{p.port}"
    q = urlencode(sorted((k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if not TRACKING.match(k)))
    path = p.path.rstrip("/") or "/"
    return urlunsplit((p.scheme.lower(), host, path, q, ""))


@dataclass
class Source:
    url: str
    fetch: Callable[[PageRow | None], Fetched]


class HttpFetcher:
    def __init__(self, delay: float = 0.0, timeout: float = 20.0, user_agent: str = UA, respect_robots: bool = True, client: httpx.Client | None = None):
        self.client = client or httpx.Client(timeout=timeout, follow_redirects=True, headers={"User-Agent": user_agent})
        self.delay, self.ua, self.respect = delay, user_agent, respect_robots
        self._robots: dict[str, robotparser.RobotFileParser | None] = {}
        self._last = 0.0

    def allowed(self, url: str) -> bool:
        if not self.respect:
            return True
        p = urlsplit(url)
        base = f"{p.scheme}://{p.netloc}"
        if base not in self._robots:
            rp = robotparser.RobotFileParser()
            try:
                r = self.client.get(base + "/robots.txt")
                rp.parse(r.text.splitlines() if r.status_code == 200 else [])
                self._robots[base] = rp
            except httpx.HTTPError:
                self._robots[base] = None
        rp = self._robots[base]
        return True if rp is None else rp.can_fetch(self.ua, url)

    def get(self, url: str, prev: PageRow | None = None) -> Fetched:
        if not self.allowed(url):
            return Fetched(url, 403, error="blocked by robots.txt")
        if self.delay:
            wait = self._last + self.delay - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
        headers = {}
        if prev and prev.etag:
            headers["If-None-Match"] = prev.etag
        if prev and prev.last_modified:
            headers["If-Modified-Since"] = prev.last_modified
        try:
            r = self.client.get(url, headers=headers)
        except httpx.HTTPError as e:
            return Fetched(url, 0, error=f"{type(e).__name__}: {e}")
        return Fetched(url, r.status_code, r.content if r.status_code == 200 else b"", r.headers.get("content-type", ""),
                       r.headers.get("etag", ""), r.headers.get("last-modified", ""))


def sitemap_urls(sitemap_url: str, fetcher: HttpFetcher, max_urls: int, _depth: int = 0) -> list[str]:
    """URLs listed in a sitemap, following sitemap indexes (and .gz files) up to three levels."""
    import gzip

    r = fetcher.client.get(sitemap_url)
    r.raise_for_status()
    body = r.content
    if body[:2] == b"\x1f\x8b":
        body = gzip.decompress(body)
    text = body.decode("utf-8", errors="replace")
    locs = [m.strip() for m in re.findall(r"<loc>\s*(.*?)\s*</loc>", text, re.S)]
    locs = [re.sub(r"^<!\[CDATA\[|\]\]>$", "", u).strip() for u in locs]
    if "<sitemapindex" in text and _depth < 3:
        out: list[str] = []
        for child in locs:
            out += sitemap_urls(child, fetcher, max_urls - len(out), _depth + 1)
            if len(out) >= max_urls:
                break
        return out[:max_urls]
    return locs[:max_urls]


LINK = re.compile(r"""<a\s[^>]*?href\s*=\s*["']([^"'#][^"']*)""", re.I)


def crawl_urls(start: str, fetcher: HttpFetcher, max_pages: int, max_depth: int) -> Iterator[str]:
    """Breadth-first links on the start URL's host, up to max_pages and max_depth."""
    start = normalize(start)
    host = urlsplit(start).netloc
    seen, queue = {start}, deque([(start, 0)])
    while queue and len(seen) <= max_pages:
        url, depth = queue.popleft()
        yield url
        if depth >= max_depth:
            continue
        f = fetcher.get(url)
        if f.status != 200 or "html" not in f.content_type.lower():
            continue
        for href in LINK.findall(f.body.decode("utf-8", errors="replace")):
            nxt = normalize(urljoin(url, href))
            if urlsplit(nxt).netloc == host and urlsplit(nxt).scheme in ("http", "https") and not SKIP_EXT.search(urlsplit(nxt).path) and nxt not in seen and len(seen) < max_pages:
                seen.add(nxt); queue.append((nxt, depth + 1))


def web_sources(fetcher: HttpFetcher, sitemap: str | None, start_url: str | None, max_pages: int, max_depth: int,
                include: list[str], exclude: list[str]) -> list[Source]:
    urls: list[str] = []
    if sitemap:
        urls += sitemap_urls(sitemap, fetcher, max_pages)
    if start_url:
        urls += list(crawl_urls(start_url, fetcher, max_pages, max_depth)) if not sitemap else [start_url]
    seen: dict[str, None] = {}
    for u in urls:
        n = normalize(u)
        if SKIP_EXT.search(urlsplit(n).path):
            continue
        if include and not any(re.search(p, n) for p in include):
            continue
        if any(re.search(p, n) for p in exclude):
            continue
        seen.setdefault(n, None)
    return [Source(u, (lambda prev, u=u: fetcher.get(u, prev))) for u in list(seen)[:max_pages]]


def doc_sources(folder: Path) -> list[Source]:
    """Every .html, .md, .txt and .pdf under the folder; the address is doc:<relative path>."""
    out: list[Source] = []
    for p in sorted(folder.rglob("*")):
        if not p.is_file() or p.suffix.lower() not in DOC_EXT:
            continue
        rel = "doc:" + p.relative_to(folder).as_posix()

        def load(prev: PageRow | None, p: Path = p, rel: str = rel) -> Fetched:
            st = p.stat()
            tag = f"{st.st_size}-{st.st_mtime_ns}"
            mod = datetime.fromtimestamp(st.st_mtime, timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
            if prev and prev.etag == tag:
                return Fetched(rel, 304, etag=tag, last_modified=mod)
            ct = {".pdf": "application/pdf", ".md": "text/markdown", ".markdown": "text/markdown", ".txt": "text/plain"}.get(p.suffix.lower(), "text/html")
            return Fetched(rel, 200, p.read_bytes(), ct, tag, mod)

        out.append(Source(rel, load))
    return out
