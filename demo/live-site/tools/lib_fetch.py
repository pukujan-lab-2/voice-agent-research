"""The large tax library (public-domain U.S. government works) beyond the first 296 IRS pages, one manifest per source:

  irc     Title 26 U.S. Code (Internal Revenue Code), one document per section   govinfo.gov USCODE package (USLM XML)
  cfr     26 CFR (Treasury regulations), one document per section               eCFR versioner API (full title XML)
  forms   every IRS form, instruction and publication PDF not already loaded   irs.gov "Forms, instructions & publications"
  irb     Internal Revenue Bulletin items: revenue rulings, procedures, notices irs.gov/irb/<yyyy-nn>_IRB pages
  irm     Internal Revenue Manual, one document per subsection                 irs.gov/irm/part<n> and its section pages

Each writes build/lib/<source>/docs.jsonl, one document per line:
  {doc, prefix, kind: "article"|"pdf", source, title, url, category, sections: [{heading, level, anchor}],
   body: {sections: [{heading, level, anchor, url, blocks: [{p}]}]} | null, file: <pdf path> | null, pages,
   passages: [{n, section, anchor, url, page, text}]}
Raw downloads are kept in build/lib/raw/<source> so a re-run fetches only what's missing. One request a second to
irs.gov; the bulk XML sources are one download each. tools/lib_ingest.py loads the manifests into Octo.

Usage: build/.venv/bin/python tools/lib_fetch.py irc|cfr|forms|irb|irm [--years 2019-2026]
"""
import io, json, pathlib, re, sys, time, unicodedata, urllib.request, zipfile
from xml.etree import ElementTree as ET

from bs4 import BeautifulSoup

HERE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE / "tools"))
from irs_corpus import chunks, ws  # noqa: E402

LIB = HERE / "build" / "lib"
UA = "Mozilla/5.0 (Macintosh) BrindlewickDemoCorpus/1.0 (public-domain tax library for a demo)"
_last = [0.0]


def get(url, dest=None, polite=1.0, compressed=False, timeout=120):
    """GET with a cache file and a pause between requests to the same kind of host."""
    if dest and dest.exists() and dest.stat().st_size > 0:
        return dest.read_bytes()
    wait = polite - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    headers = {"User-Agent": UA}
    if compressed:
        headers["Accept-Encoding"] = "gzip"
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=timeout) as r:
                data = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    import gzip
                    data = gzip.decompress(data)
            break
        except urllib.error.HTTPError as e:
            if e.code in (403, 404, 410):
                raise
            time.sleep(5 * (attempt + 1))
        except Exception:  # noqa: BLE001
            time.sleep(5 * (attempt + 1))
    else:
        raise RuntimeError(f"failed: {url}")
    _last[0] = time.time()
    if dest:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
    return data


def slug(s):
    return re.sub(r"[^a-z0-9.]+", "-", unicodedata.normalize("NFKD", s).lower()).strip("-")


def article(doc, prefix, source, title, url, category, secs):
    """secs: [(heading, level, anchor, [paragraph strings])] -> a manifest line with its passages."""
    body, passages, n = [], [], 0
    for heading, level, anchor, paras in secs:
        paras = [ws(p) for p in paras if ws(p)]
        if not paras:
            continue
        body.append({"heading": heading, "level": level, "anchor": anchor, "url": f"{url}#{anchor}" if anchor else url, "blocks": [{"p": p} for p in paras]})
        for t in chunks(paras):
            passages.append({"n": n, "section": heading, "anchor": anchor or None, "url": f"{url}#{anchor}" if anchor else url, "page": None, "text": t})
            n += 1
    if not passages:
        return None
    return {"doc": doc, "prefix": prefix, "kind": "article", "source": source, "title": title, "url": url, "category": category,
            "sections": [{"heading": s["heading"], "level": s["level"], "anchor": s["anchor"]} for s in body][:400],
            "body": {"sections": body}, "file": None, "pages": None, "passages": passages}


class Out:
    def __init__(self, src):
        self.path = LIB / src / "docs.jsonl"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.seen = set()
        if self.path.exists():
            for line in self.path.open():
                self.seen.add(json.loads(line)["doc"])
        self.f = self.path.open("a")
        self.docs = self.passages = 0

    def add(self, d):
        if not d or d["doc"] in self.seen:
            return
        self.seen.add(d["doc"])
        self.f.write(json.dumps(d, ensure_ascii=False) + "\n")
        self.f.flush()
        self.docs += 1
        self.passages += len(d["passages"])

    def done(self):
        self.f.close()
        print(f"{self.path.parent.name}: +{self.docs} documents, +{self.passages} passages ({len(self.seen)} documents in the manifest)")


# ---- Title 26 U.S. Code (govinfo USCODE package: one HTML granule per section)
def irc():
    out = Out("irc")
    z = LIB / "raw" / "irc" / "USCODE-2024-title26.zip"
    get("https://api.govinfo.gov/packages/USCODE-2024-title26/zip?api_key=DEMO_KEY", z, timeout=3600)
    with zipfile.ZipFile(z) as zf:
        for name in sorted(n for n in zf.namelist() if re.search(r"-sec[0-9A-Za-z-]+\.htm$", n)):
            html = zf.read(name).decode("utf-8", "replace")
            num = re.search(r"documentid:26_([0-9A-Za-z-]+)", html)
            body = re.search(r"<!-- field-start:statute -->(.*?)<!-- field-end:statute -->", html, re.S)
            head = re.search(r'<h3 class="section-head">(.*?)</h3>', html, re.S)
            if not num or not body or not head:
                continue
            num = num.group(1)
            head = ws(BeautifulSoup(head.group(1), "lxml").get_text(" ")).replace("§ ", "§")
            name_ = re.sub(r"^§\s*[0-9A-Za-z-]+\.\s*", "", head).rstrip(".")
            if re.match(r"^(Repealed|Omitted|Transferred|Renumbered)\b", name_) or not name_:
                continue
            soup = BeautifulSoup(body.group(1), "lxml")
            paras = [ws(el.get_text(" ")) for el in soup.find_all(["h4", "h5", "h6", "p"])]
            url = f"https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section{num}&num=0&edition=prelim"
            title = f"§ {num}. {name_}"
            out.add(article(f"irc-{num.lower()}", "irc/", f"26 U.S.C. § {num}", title, url, "code", [(title, 1, "", paras)]))
    out.done()


# ---- 26 CFR (eCFR full-title XML)
def cfr():
    out = Out("cfr")
    date = json.loads(get("https://www.ecfr.gov/api/versioner/v1/titles.json"))
    date = next(t for t in date["titles"] if t["number"] == 26)["up_to_date_as_of"]
    raw = LIB / "raw" / "cfr" / f"title-26-{date}.xml"
    data = get(f"https://www.ecfr.gov/api/versioner/v1/full/{date}/title-26.xml", raw, compressed=True, timeout=1800)
    for _, el in ET.iterparse(io.BytesIO(data), events=("end",)):
        if el.tag != "DIV8" or el.get("TYPE") != "SECTION":
            continue
        n = el.get("N", "")
        head = ws("".join(el.find("HEAD").itertext())) if el.find("HEAD") is not None else n
        paras = [ws("".join(p.itertext())) for p in el if p.tag in ("P", "FP", "NOTE", "EXTRACT", "GPOTABLE")]
        if not re.match(r"^[0-9a-z.-]+$", n.lower()) or re.search(r"\[Reserved\]", head) or not paras:
            el.clear(); continue
        url = f"https://www.ecfr.gov/current/title-26/section-{n}"
        title = re.sub(r"^§\s*", "§ ", head)
        out.add(article(f"cfr-{n.lower()}", "cfr/", f"26 CFR § {n}", title, url, "regulations", [(title, 1, "", paras)]))
        el.clear()
    out.done()


# ---- every IRS PDF in the forms index
def forms():
    out = Out("forms")
    have = {p.stem for p in (HERE / "build/irs/pdf").glob("*.pdf")}
    items, page = [], 0
    while True:
        html = get(f"https://www.irs.gov/forms-instructions-and-publications?items_per_page=200&page={page}", LIB / "raw" / "forms" / f"index-{page}.html").decode("utf-8", "replace")
        soup = BeautifulSoup(html, "lxml")
        rows = soup.select("table tbody tr")
        got = 0
        for tr in rows:
            a = tr.find("a", href=re.compile(r"/pub/irs-pdf/[^/]+\.pdf$"))
            tds = tr.find_all("td")
            if not a or len(tds) < 2:
                continue
            got += 1
            items.append({"name": a["href"].rsplit("/", 1)[1][:-4], "number": ws(a.get_text(" ")), "title": ws(tds[1].get_text(" ")),
                          "url": "https://www.irs.gov" + a["href"] if a["href"].startswith("/") else a["href"]})
        if not got:
            break
        page += 1
    from pypdf import PdfReader
    print(f"forms index: {len(items)} PDFs", flush=True)
    for it in items:
        name = it["name"]
        # English only: the Spanish and other-language editions would answer English questions in another language.
        if name in have or name.endswith("sp") or re.search(r"\((sp|ko|ru|vi|vie|zh|zh-s|zh-t|ht|pt|pl|ar|ja|fa|ur|tl)\)|Spanish|Espa[nñ]ol", it["number"] + " " + it["title"], re.I):
            continue
        if f"forms-{name}" in out.seen:
            continue
        dest = LIB / "raw" / "forms" / "pdf" / f"{name}.pdf"
        try:
            data = get(it["url"], dest, timeout=180)
        except Exception as e:  # noqa: BLE001
            print(f"  {name}: {e}", flush=True); continue
        if not data.startswith(b"%PDF"):
            dest.unlink(missing_ok=True); continue
        try:
            reader = PdfReader(str(dest))
            pages = [(i + 1, ws(pg.extract_text() or "")) for i, pg in enumerate(reader.pages)]
        except Exception as e:  # noqa: BLE001
            print(f"  {name}: unreadable ({e})", flush=True); continue
        kind = "Instructions" if name.startswith("i") else "Publication" if name.startswith("p") else "Form"
        source = it["number"] if it["number"].lower().startswith(("form", "pub", "inst", "notice", "sched")) else f"{kind} {it['number']}"
        passages, n = [], 0
        for pg, t in pages:
            for c in chunks([t]) if len(t) > 25 else []:
                passages.append({"n": n, "section": f"{source}, page {pg}", "anchor": None, "url": it["url"], "page": pg, "text": c}); n += 1
        if not passages:
            continue
        out.add({"doc": f"forms-{slug(name)}", "prefix": "irs/forms/", "kind": "pdf", "source": source, "title": it["title"] or source,
                 "url": it["url"], "category": "forms", "sections": [], "body": None, "file": str(dest.relative_to(HERE)), "pages": len(pages),
                 "passages": passages})
    out.done()


# ---- Internal Revenue Bulletin items
ITEM = re.compile(r"^(Rev\. Rul\.|Rev\. Proc\.|Notice)\s+(\d{4}-\d+)$")


def irb():
    out = Out("irb")
    y0, y1 = (int(x) for x in (sys.argv[sys.argv.index("--years") + 1] if "--years" in sys.argv else "2019-2026").split("-"))
    for y in range(y0, y1 + 1):
        for i in range(1, 54):
            issue = f"{y}-{i:02d}"
            url = f"https://www.irs.gov/irb/{issue}_IRB"
            try:
                html = get(url, LIB / "raw" / "irb" / f"{issue}.html").decode("utf-8", "replace")
            except urllib.error.HTTPError:
                continue
            soup = BeautifulSoup(html, "lxml")
            for junk in soup.select("script, style, nav, footer, .pup-header-content-rt, .breadcrumb"):
                junk.decompose()
            root = soup.find("main") or soup
            cur, secs, head, anchor, paras = None, [], "", "", []

            def flush_item():
                if cur and secs:
                    kind, num = cur
                    title = f"{kind} {num}"
                    out.add(article(f"irb-{slug(kind)}-{num}", "irb/", f"{title} (IRB {issue})", title, f"{url}#{secs[0][2]}" if secs[0][2] else url,
                                    "bulletins", secs))
            for el in root.find_all(["h1", "h2", "h3", "h4", "p", "li"]):
                t = ws(el.get_text(" "))
                if el.name in ("h1", "h2") and (m := ITEM.match(t)):
                    if paras and cur:
                        secs.append((head, 2, anchor, paras))
                    flush_item()
                    cur, secs, head, anchor, paras = (m.group(1), m.group(2)), [], t, el.get("id", "") or (el.find("a", attrs={"name": True}) or {}).get("name", ""), []
                    continue
                if el.name == "h1" and cur:
                    if paras:
                        secs.append((head, 2, anchor, paras))
                    flush_item(); cur, secs, paras = None, [], []
                    continue
                if not cur:
                    continue
                if el.name in ("h2", "h3", "h4"):
                    if paras:
                        secs.append((head, 2, anchor, paras))
                    head, anchor, paras = t, el.get("id", "") or anchor, []
                elif len(t) > 2 and not (el.name == "li" and el.find("p")):
                    paras.append(t)
            if cur:
                if paras:
                    secs.append((head, 2, anchor, paras))
                flush_item()
            print(f"  IRB {issue}: {out.docs} items so far", flush=True)
    out.done()


# ---- Internal Revenue Manual, one document per subsection
SUB = re.compile(r"^(\d+\.\d+\.\d+(?:\.\d+)+)\s+(.*)$")


def irm():
    out = Out("irm")
    for part in range(1, 41):
        try:
            idx = get(f"https://www.irs.gov/irm/part{part}", LIB / "raw" / "irm" / f"part{part}.html").decode("utf-8", "replace")
        except urllib.error.HTTPError:
            continue
        pages = sorted(set(re.findall(rf"https://www\.irs\.gov/irm/part{part}/irm_[0-9a-z-]+", idx)))
        for u in pages:
            name = u.rsplit("/", 1)[1]
            try:
                html = get(u, LIB / "raw" / "irm" / f"{name}.html").decode("utf-8", "replace")
            except urllib.error.HTTPError:
                continue
            soup = BeautifulSoup(html, "lxml")
            for junk in soup.select("script, style, nav, footer, .pup-header-content-rt, .breadcrumb"):
                junk.decompose()
            # Each subsection is a div.section: its number and date in div.sectioninfo ("1.1.1.1 (07-10-2025)"), its
            # title in the heading, and its own text (not its child subsections') in the paragraphs, list items and tables.
            for sec in soup.select("div.section"):
                info = sec.find("div", class_="sectioninfo", recursive=False)
                m = re.match(r"^(\d+(?:\.\d+){2,})\b", ws(info.get_text(" "))) if info else None
                h = sec.find(["h2", "h3", "h4", "h5", "h6"])
                if not m or not h:
                    continue
                num, name_ = m.group(1), ws(h.get_text(" "))
                anchor = sec.get("id", "")
                paras = []
                for el in sec.find_all(["p", "table", "dt", "dd"]):
                    if el.find_parent("div", class_="section") is not sec or el.find_parent("table") is not None:
                        continue
                    t = ws(el.get_text(" | " if el.name == "table" else " "))
                    if len(t) > 2:
                        paras.append(t)
                title = f"IRM {num} {name_}".strip()
                out.add(article(f"irm-{num}", "irm/", f"IRM {num}", title, f"{u}#{anchor}" if anchor else u, "irm", [(title, 2, anchor, paras)]))
            print(f"  {name}: {out.docs} subsections so far", flush=True)
    out.done()


if __name__ == "__main__":
    {"irc": irc, "cfr": cfr, "forms": forms, "irb": irb, "irm": irm}[sys.argv[1]]()
