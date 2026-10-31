"""Turn the fictional demo documents in docs-src/ into (1) page Markdown + a text layer for the existing Octo loader
copilot-engine/tools/paddle_passages.py, (2) data/<label>.passages.json, the same passages for the offline backend,
and (3) static/docs/<name>.html, the readable document the copilot's page citations link to.
Usage:
  python3 tools/docs.py            # build only, prints the passages
  python3 tools/docs.py --upload   # also load them into Octo as "manual:<label> p<page> #<i>" (skips a label already there)
Octo key/workspace come from ~/Documents/projects/.env (never printed).
"""
import html, json, pathlib, re, subprocess, sys, urllib.request

HERE = pathlib.Path(__file__).resolve().parent.parent
LOADER = HERE.parent.parent / "copilot-engine" / "tools" / "paddle_passages.py"
sys.path.insert(0, str(LOADER.parent))
import paddle_passages as pp  # noqa: E402  (the existing loader: same splitter and number check as the IRS load)

DOCS = [("hdw500-manual", "demo-hdw500"), ("r17-guide", "demo-r17")]


def pages_of(src):
    text = src.read_text(encoding="utf-8")
    title = re.search(r"<!-- title: (.*?) -->", text).group(1)
    pages = [re.sub(r"<!--.*?-->\n?", "", p).strip() for p in text.split("<!-- page -->")[1:]]
    return title, pages


def layer(md):
    """Plain text of a page, as a PDF text layer would have it (used by the loader's number check)."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", md)))


def to_html(md):
    out = []
    for block in re.split(r"\n\s*\n", md):
        b = block.strip()
        if b.startswith("<table"):
            out.append(b)
        elif b.startswith("#"):
            out.append(f"<h2>{html.escape(b.lstrip('# '))}</h2>")
        elif re.match(r"\d+\. ", b):
            lines = [re.sub(r"^\d+\.\s*", "", l) for l in b.splitlines() if re.match(r"\d+\. ", l)]
            rest = [l for l in b.splitlines() if not re.match(r"\d+\. ", l)]
            out.append("<ol>" + "".join(f"<li>{html.escape(l)}</li>" for l in lines) + "</ol>")
            out += [f"<p>{html.escape(l)}</p>" for l in rest]
        else:
            out.append(f"<p>{html.escape(b)}</p>")
    return "\n".join(out)


def page_html(title, pages):
    body = "\n".join(f'<section class="docpage" id="page-{i}"><div class="pageno">Page {i}</div>\n{to_html(p)}\n</section>'
                     for i, p in enumerate(pages, 1))
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>{html.escape(title)} (fictional)</title>
<link rel="stylesheet" href="/docs/docs.css"></head>
<body><div class="demo-banner"><b>Demo, fictional company.</b> This business, its people and its documents are made up.</div>
<main class="wrap"><h1>{html.escape(title)}</h1>
<p class="muted">A fictional document written for this demo. Nothing in it describes a real product, fund or company.</p>
{body}
</main></body></html>
"""


def octo_titles():
    e = pp.env()
    req = urllib.request.Request(f"https://octodb.design-bakery.com/api/rag/documents?workspaceId={e['octo_db_chatbots_workspace']}",
                                 headers={"Authorization": "Bearer " + e["octo_db_chatbots"], "User-Agent": "chatbots-rag/0.1"})
    return [d["title"] for d in json.load(urllib.request.urlopen(req, timeout=60))]


if __name__ == "__main__":
    upload = "--upload" in sys.argv
    have = octo_titles() if upload else []
    for name, label in DOCS:
        title, pages = pages_of(HERE / "docs-src" / f"{name}.md")
        work = HERE / "build" / "docs" / label
        work.mkdir(parents=True, exist_ok=True)
        for f in work.glob("page*.md"):
            f.unlink()
        for i, p in enumerate(pages, 1):
            (work / f"page{i:03d}.md").write_text(p, encoding="utf-8")
        (work / "pages.txt").write_text("\f".join(layer(p) for p in pages), encoding="utf-8")
        ps = [q for i, p in enumerate(pages, 1) for q in pp.passages(p, i)]
        bad = [q for q in ps if pp.unknown_numbers(q["text"], layer(pages[q["page"] - 1]))]
        assert not bad, bad
        (HERE / "data").mkdir(exist_ok=True)
        (HERE / "data" / f"{label}.passages.json").write_text(json.dumps(
            {"label": label, "title": title, "passages": [{"id": f"{label}-{i}", "page": q["page"], "text": q["text"]} for i, q in enumerate(ps)]},
            indent=1, ensure_ascii=False), encoding="utf-8")
        (HERE / "static" / "docs").mkdir(parents=True, exist_ok=True)
        (HERE / "static" / "docs" / f"{name}.html").write_text(page_html(title, pages), encoding="utf-8")
        print(f"{label}: {len(pages)} pages, {len(ps)} passages")
        for q in ps:
            print(f"   p{q['page']} {len(q['text']):3d}c {q['text'][:90]!r}")
        if upload:
            n = sum(t.startswith(f"manual:{label} ") for t in have)
            if n:
                print(f"   already in Octo ({n} documents titled 'manual:{label} ...'); not loading again")
                continue
            subprocess.run([sys.executable, str(LOADER), str(work), str(work / "pages.txt"), label,
                            ",".join(str(i) for i in range(1, len(pages) + 1)), "--upload"], check=True)
