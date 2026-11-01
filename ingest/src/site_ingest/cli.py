"""site-ingest --business acme --sitemap https://acme.com/sitemap.xml [--docs ./manuals] [--start-url URL]

Loads (or re-crawls) a business's site and documents into its own Octo prefix and prints what was indexed."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import pipeline
from .octo import Octo
from .sources import HttpFetcher, doc_sources, web_sources
from .store import SiteStore


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="site-ingest", description=__doc__)
    ap.add_argument("--business", required=True, help="the business's prefix: 2-40 lowercase letters, digits, dashes")
    ap.add_argument("--sitemap")
    ap.add_argument("--start-url")
    ap.add_argument("--docs", type=Path, help="a folder of .html, .md, .txt and .pdf files")
    ap.add_argument("--max-pages", type=int, default=5000)
    ap.add_argument("--max-depth", type=int, default=3)
    ap.add_argument("--include", action="append", default=[], help="regex; only matching addresses")
    ap.add_argument("--exclude", action="append", default=[], help="regex; skip matching addresses")
    ap.add_argument("--page-type", action="append", default=[], metavar="FRAGMENT=TYPE", help="e.g. /shop/=product")
    ap.add_argument("--language", default="en", help="language when a page does not say")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--delay", type=float, default=0.0, help="seconds between requests to the site")
    ap.add_argument("--allow-mass-delete", action="store_true")
    ap.add_argument("--key-env", default="octo_db_chatbots")
    ap.add_argument("--workspace-env", default="octo_db_chatbots_workspace")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    if not (a.sitemap or a.start_url or a.docs):
        ap.error("give --sitemap, --start-url or --docs")
    cfg = pipeline.Config(a.business, workers=a.workers, default_language=a.language, allow_mass_delete=a.allow_mass_delete,
                          page_types=dict(x.split("=", 1) for x in a.page_type))
    sources = []
    if a.sitemap or a.start_url:
        sources += web_sources(HttpFetcher(a.delay), a.sitemap, a.start_url, a.max_pages, a.max_depth, a.include, a.exclude)
    if a.docs:
        sources += doc_sources(a.docs)
    octo = Octo.from_env(a.key_env, a.workspace_env)
    rep = pipeline.run(cfg, SiteStore(octo, a.business, a.workers), sources)
    print(json.dumps(rep.__dict__, indent=1) if a.json else rep.summary())
    for e in rep.errors[:10]:
        print("  !", e, file=sys.stderr)
    return 1 if rep.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
