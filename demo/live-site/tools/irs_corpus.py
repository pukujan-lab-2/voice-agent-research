"""Turn the downloaded IRS pages (build/irs/raw, from tools/irs_fetch.py) into cited passages for the Brindlewick demo.
Every passage keeps its source (e.g. "IRS Pub 17"), its section heading and a deep link to irs.gov, and tables are split
by rows with the header row repeated (same splitter as the IRS table test, copilot-engine/tools/paddle_passages.py).
Outputs:
  data/irs.passages.json    every passage (id, title, section, url, text), the offline backend's corpus and the
                            ingest manifest (each id is its Octo document title)
  data/irs.faq.json         every IRS FAQ question with its answer, word for word (chips on the site, eval gold)
  data/irs.library.json     one entry per source page with its sections, for the site's Tax Guides library
Usage: build/.venv/bin/python tools/irs_corpus.py   (needs beautifulsoup4 + lxml in that venv)
"""
import json, pathlib, re, sys

from bs4 import BeautifulSoup

HERE = pathlib.Path(__file__).resolve().parent.parent
RAW = HERE / "build" / "irs" / "raw"
sys.path.insert(0, str(HERE.parent.parent / "copilot-engine" / "tools"))
import paddle_passages as pp  # noqa: E402

MAX = 480  # passage body; with its heading line it stays under Octo's 700-char chunk, so Octo never re-splits it
# Back-of-book indexes and the boilerplate every publication repeats are not answers.
SKIP = re.compile(r"^(Index|[A-Z]|How To Get Tax Help|Comments and suggestions\.?|Ordering (tax )?forms.*|Getting tax forms.*|"
                  r"Reminders|Photographs of missing children\.?|The Taxpayer Advocate Service.*|TAS (for|Can Help).*|Low Income Taxpayer Clinics.*|"
                  r"Your Rights as a Taxpayer|The Taxpayer Bill of Rights|Paperwork Reduction Act Notice.*|Privacy Act.*)$", re.I)
ws = lambda s: re.sub(r"\s+", " ", s).strip()  # noqa: E731


def label_of(path, h1):
    m = re.match(r"/publications/p(\d+)([a-z]?)$", path)
    if m:
        return f"IRS Pub {m.group(1)}{('-' + m.group(2).upper()) if m.group(2) else ''}"
    m = re.match(r"/instructions/i(.+)$", path)
    if m:
        t = re.sub(r"\s*\(\d{4}\)\s*$", "", ws(h1))
        return t if t.lower().startswith("instructions") else f"Instructions for Form {t}"
    m = re.match(r"/taxtopics/tc(\d+)$", path)
    if m:
        return f"IRS Tax Topic {m.group(1)}"
    return "IRS FAQ"


def anchor_of(el):
    a = el.find("a", attrs={"name": True})
    return a["name"] if a else el.get("id", "")


def book_sections(soup):
    """Publications and instructions: (heading path, anchor, [blocks]) in document order."""
    root = soup.select_one("div.book") or soup.find("main") or soup
    out, path, anchor, blocks = [], {}, "", []
    for el in root.find_all(["h1", "h2", "h3", "h4", "p", "li", "table", "dt", "dd"]):
        if el.find_parent("table") is not None:
            continue  # inside a table: the table is taken whole
        if el.name in ("h1", "h2", "h3", "h4"):
            t = ws(el.get_text(" "))
            if not t:
                continue
            if blocks:
                out.append((path.copy(), anchor, blocks))
            lvl = int(el.name[1])
            path = {k: v for k, v in path.items() if k < lvl}
            path[lvl] = t
            anchor, blocks = anchor_of(el) or anchor, []
            continue
        if el.name == "li" and el.find("p"):
            continue  # its paragraphs come on their own
        if el.name in ("p", "dt", "dd") and el.find_parent("li") is not None and el.find_parent("li").find("p") is None:
            continue
        if el.name == "table":
            blocks.append(str(el))
        else:
            t = ws(el.get_text(" "))
            if len(t) > 2:
                blocks.append(("• " if el.name == "li" else "") + t)
    if blocks:
        out.append((path.copy(), anchor, blocks))
    return out


def page_sections(soup):
    """Tax topics: the page body under its h1, split at h2/h3."""
    root = soup.select_one("main .field--name-body, main article, main") or soup
    out, head, anchor, blocks = [], "", "", []
    for el in root.find_all(["h2", "h3", "p", "li", "table"]):
        if el.find_parent("table") is not None or el.find_parent(["nav", "footer"]) is not None:
            continue
        if el.name in ("h2", "h3"):
            if blocks:
                out.append(({2: head} if head else {}, anchor, blocks))
            head, anchor, blocks = ws(el.get_text(" ")), el.get("id", ""), []
            continue
        if el.name == "li" and el.find("p"):
            continue
        if el.name == "table":
            blocks.append(str(el))
        else:
            t = ws(el.get_text(" "))
            if len(t) > 2:
                blocks.append(("• " if el.name == "li" else "") + t)
    if blocks:
        out.append(({2: head} if head else {}, anchor, blocks))
    return out


def faq_items(soup):
    """IRS FAQ pages: (question, answer-body tag) for every accordion item."""
    out = []
    for item in soup.select("div.accordion-item"):
        q, body = item.select_one(".accordion-button"), item.select_one(".accordion-body")
        if not q or not body:
            continue
        h = body.find("h4")
        if h and ws(h.get_text()).lower().startswith("answer"):
            h.decompose()
        out.append((ws(q.get_text(" ")), body))
    return out


def chunks(blocks):
    """Blocks -> passage bodies of at most MAX chars; a table is split by rows with its header repeated."""
    md = "\n\n".join(blocks)
    res = []
    for p in pp.passages(md, 0, max_chars=MAX):
        t = p["text"]
        while len(t) > MAX + 120:  # one very long paragraph: split at sentences
            cut = t.rfind(". ", 0, MAX)
            cut = cut + 1 if cut > 100 else MAX
            res.append(t[:cut].strip()); t = t[cut:].strip()
        res.append(t)
    return [r for r in res if len(r) > 25]


def main():
    sources = json.loads((RAW.parent / "sources.json").read_text()) if (RAW.parent / "sources.json").exists() else [
        {"kind": "?", "path": "/" + f.stem.replace("__", "/")} for f in sorted(RAW.glob("*.html"))]
    passages, faqs, library, seen, asked = [], [], [], set(), set()
    for s in sources:
        path = s["path"]
        f = RAW / (path.strip("/").replace("/", "__") + ".html")
        if not f.exists():
            continue
        soup = BeautifulSoup(f.read_text(encoding="utf-8"), "lxml")
        for junk in soup.select("script, style, nav, footer, .pup-header-content-rt, .breadcrumb"):
            junk.decompose()
        h1 = soup.find("h1")
        h1t = ws(h1.get_text(" ")) if h1 else path
        src = label_of(path, h1t)
        url = "https://www.irs.gov" + path
        slug = path.strip("/").replace("/", "-")
        page_title = re.sub(r"^Topic no\. \d+,?\s*", "", h1t) if path.startswith("/taxtopics") else h1t
        entry = {"id": slug, "source": src, "title": page_title, "url": url, "kind": path.split("/")[1], "sections": []}
        article = []
        if path.startswith("/faqs"):
            cat = ws(soup.title.get_text()).split("|")[0].strip() if soup.title else h1t
            for k, (q, body) in enumerate(faq_items(soup)):
                if q.lower() in asked:
                    continue  # the same question on a category page and its sub-page
                asked.add(q.lower())
                text_blocks = [str(t) if t.name == "table" else ws(t.get_text(" "))
                               for t in body.find_all(["p", "li", "table"]) if t.find_parent("table") is None and not (t.name == "li" and t.find("p"))]
                text_blocks = [b for b in text_blocks if b]
                answer = ws(body.get_text(" "))
                if not answer:
                    continue
                fid = f"{slug}-q{k}"
                faqs.append({"id": fid, "question": q, "answer": answer, "category": cat, "url": url})
                article.append({"heading": q, "level": 3, "anchor": fid, "url": url,
                                "blocks": [{"table": [r.split(" | ") for r in pp.table_rows(b)]} if b.startswith("<table") else {"p": b} for b in (text_blocks or [answer])]})
                for i, c in enumerate(chunks(text_blocks or [answer])):
                    passages.append({"id": f"irs/{fid} #{i}", "source": "IRS FAQ", "section": q, "url": url, "text": c, "faq": fid})
            entry["title"] = cat
            entry["sections"] = [q for q, _ in faq_items(soup)][:60]
        else:
            secs = book_sections(soup) if path.startswith(("/publications", "/instructions")) else page_sections(soup)
            n = 0
            for heads, anchor, blocks in secs:
                levels = [re.sub(r"^(Publication \d+[A-Z-]*|Instructions for Form [\w-]+|[\w-]+) - (Main Contents|Introductory Material)$", "", h) for h in (heads[k] for k in sorted(heads))]
                levels = [h for h in levels if h]
                if any(SKIP.match(h) for h in levels):
                    continue
                # the h1 of a publication chapter is the chapter; keep the two most specific levels as the section name
                section = " › ".join(levels[-2:]) if levels else page_title
                if path.startswith("/taxtopics") and not levels:
                    section = page_title
                link = f"{url}#{anchor}" if anchor else url
                if levels and levels[-1] not in entry["sections"]:
                    entry["sections"].append(levels[-1])
                # the readable article for the site's library: tables as rows of cells
                article.append({"heading": levels[-1] if levels else page_title, "level": max(heads) if heads else 2, "anchor": anchor, "url": link,
                                "blocks": [{"table": [r.split(" | ") for r in pp.table_rows(b)]} if b.startswith("<table") else {"p": b} for b in blocks]})
                for c in chunks(blocks):
                    if c in seen:
                        continue  # the same text in several publications is loaded once
                    seen.add(c)
                    passages.append({"id": f"irs/{slug} #{n}", "source": src, "section": section, "url": link, "text": c})
                    n += 1
        if True:  # every source, FAQ pages included, has a readable copy for the site's viewer
            guides = HERE / "build" / "irs" / "site" / "guides"
            guides.mkdir(parents=True, exist_ok=True)
            (guides / f"{slug}.json").write_text(json.dumps({k: entry[k] for k in ("id", "source", "title", "url")} | {"sections": article},
                                                            ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        library.append(entry)
        print(f"{src:40.40s} {len(passages):6d} passages so far", end="\r")
    out = HERE / "data"
    (out / "irs.passages.json").write_text(json.dumps({"label": "irs", "passages": passages}, ensure_ascii=False, indent=0), encoding="utf-8")
    (out / "irs.faq.json").write_text(json.dumps(faqs, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "irs.library.json").write_text(json.dumps(library, ensure_ascii=False, indent=1), encoding="utf-8")
    # what the site's pages read: the library index and the FAQ (questions word for word, answers, links)
    site = HERE / "build" / "irs" / "site"
    (site / "library.json").write_text(json.dumps([{k: e[k] for k in ("id", "source", "title", "url", "kind")} | {"sections": e["sections"][:40]}
                                                   for e in library if e["kind"] != "faqs"], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (site / "faq.json").write_text(json.dumps(faqs, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    kinds = {}
    for e in library:
        kinds[e["kind"]] = kinds.get(e["kind"], 0) + 1
    print(f"\n{len(library)} source pages {kinds}, {len(passages)} passages, {len(faqs)} FAQ questions")
    longest = max(len(p["section"]) + len(p["text"]) for p in passages)
    print(f"longest passage with its heading: {longest} chars")


if __name__ == "__main__":
    main()
