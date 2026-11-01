"""Page type from the address and title: plain rules, first match wins. A business can add its own patterns
(Config.page_types: {"/shop/": "product"}), which are tried first."""
from __future__ import annotations

import re
from urllib.parse import urlsplit

RULES: list[tuple[str, re.Pattern[str]]] = [
    ("faq", re.compile(r"(^|/)(faqs?|frequently-asked[a-z-]*|questions?)(/|$|\.)|\bfaq\b", re.I)),
    ("policy", re.compile(r"(^|/)(privacy|terms|policy|policies|returns?|refunds?|shipping|warranty|cancellation|legal|cookies?)(/|-|$|\.)", re.I)),
    ("pricing", re.compile(r"(^|/)(pricing|prices?|plans|fees|rates|cost)(/|$|\.)", re.I)),
    ("contact", re.compile(r"(^|/)(contact|locations?|hours|visit|directions|find-us)(/|-|$|\.)", re.I)),
    ("about", re.compile(r"(^|/)(about|team|our-story|careers|staff|company)(/|-|$|\.)", re.I)),
    ("product", re.compile(r"(^|/)(products?|shop|store|catalog|items?|services?)(/|$)", re.I)),
    ("blog", re.compile(r"(^|/)(blog|news|articles?|press|posts?|updates)(/|$)|/20\d\d/\d\d/", re.I)),
    ("docs", re.compile(r"(^|/)(docs?|help|support|guides?|manual|kb|knowledge-?base|how-to|tutorials?)(/|$)", re.I)),
]


def classify(url: str, title: str = "", overrides: dict[str, str] | None = None, kind: str = "html") -> str:
    path = urlsplit(url).path if "://" in url else url.removeprefix("doc:")
    for needle, ptype in (overrides or {}).items():
        if needle in url:
            return ptype
    for ptype, rx in RULES:
        if rx.search(path):
            return ptype
    if re.search(r"\b(faq|frequently asked)\b", title, re.I):
        return "faq"
    return "document" if kind in ("pdf", "markdown", "text") else "page"
