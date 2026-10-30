"""Turn PaddleOCR-VL page Markdown into passages, check every number against the PDF's own text layer, and load the
passages that pass into Octo RAG, each tagged with its page. A passage with a number the PDF doesn't contain is never
loaded: the vision model may have misread it, and the copilot must not quote a number the manual doesn't say. Usage:
  paddle_passages.py <md_dir> <pages.txt> <label> <page,page,...> [--upload]
<md_dir> holds page001.md... in the order of <page,...> (original PDF page numbers); <pages.txt> is the PDF's text layer,
pages separated by form feeds. Octo key/workspace come from ~/Documents/projects/.env (never printed).
"""
import html, json, os, re, sys, urllib.request

def env():
    out = {}
    for line in open(os.path.expanduser("~/Documents/projects/.env")):
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.strip().split("=", 1)
            out[k.replace("export ", "")] = v.strip().strip("'\"")
    return out

def table_rows(t):
    """HTML table -> one line per row, cells joined by ' | '."""
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S | re.I):
        cells = [html.unescape(re.sub(r"<[^>]+>", " ", c)).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S | re.I)]
        cells = [re.sub(r"\s+", " ", c) for c in cells]
        if any(cells):
            rows.append(" | ".join(cells))
    return rows

def blocks(md):
    """Split page Markdown into (heading, lines, is_table) blocks."""
    out, heading = [], ""
    for part in re.split(r"(<table.*?</table>)", md, flags=re.S | re.I):
        if part.lower().startswith("<table"):
            out.append((heading, table_rows(part), True)); continue
        for para in re.split(r"\n\s*\n", part):
            p = para.strip()
            if not p: continue
            if p.startswith("#"):
                heading = p.lstrip("# ").strip(); continue
            p = re.sub(r"<[^>]+>", " ", p)
            out.append((heading, [re.sub(r"\s+", " ", html.unescape(p))], False))
    return out

def passages(md, page, max_chars=650):  # under Octo's 700-char chunk, so Octo never re-splits a passage (Octo #357)
    out = []
    buf, head = [], None
    def flush():
        if buf: out.append({"page": page, "text": ((head + "\n") if head else "") + "\n".join(buf)})
    for heading, lines, is_table in blocks(md):
        if is_table:
            flush(); buf, head = [], heading
            # Long tables are split by rows; each piece repeats the header row so a row keeps its column names.
            top, rest = lines[:1], lines[1:]
            piece = list(top)
            for r in rest:
                if sum(len(x) for x in piece) + len(r) > max_chars and len(piece) > 1:
                    out.append({"page": page, "text": ((heading + "\n") if heading else "") + "\n".join(piece)}); piece = list(top)
                piece.append(r)
            out.append({"page": page, "text": ((heading + "\n") if heading else "") + "\n".join(piece)})
            continue
        if heading != head or sum(len(x) for x in buf) + len(lines[0]) > max_chars:
            flush(); buf, head = [], heading
        buf.append(lines[0])
    flush()
    return out

NUM = re.compile(r"\d[\d,]*(?:\.\d+)?")

def unknown_numbers(text, layer):
    """Numbers in the passage that the PDF's text layer for that page doesn't contain (commas ignored)."""
    have = {n.replace(",", "") for n in NUM.findall(layer)}
    return sorted({n for n in NUM.findall(text) if n.replace(",", "") not in have})

if __name__ == "__main__":
    md_dir, txt, label, pages = sys.argv[1], sys.argv[2], sys.argv[3], [int(p) for p in sys.argv[4].split(",")]
    layer = open(txt).read().split("\f")
    files = sorted(f for f in os.listdir(md_dir) if f.endswith(".md"))
    ok, flagged = [], []
    for f, page in zip(files, pages):
        for p in passages(open(os.path.join(md_dir, f), encoding="utf-8").read(), page):
            bad = unknown_numbers(p["text"], layer[page - 1])
            (flagged if bad else ok).append({**p, "unknown": bad})
    print(f"{len(ok)} passages pass the number check, {len(flagged)} flagged")
    for p in flagged:
        print(f"  FLAGGED p{p['page']} numbers not in the PDF: {p['unknown']}  | {p['text'][:140]!r}")
    if "--upload" not in sys.argv:
        for i, p in enumerate(ok):
            print(f"[{i}] p{p['page']} {p['text'][:200]!r}")
        sys.exit()
    e = env(); key, ws = e["octo_db_chatbots"], e["octo_db_chatbots_workspace"]
    for i, p in enumerate(ok):
        body = {"workspaceId": ws, "title": f"manual:{label} p{p['page']} #{i}", "text": f"[page {p['page']}]\n{p['text']}"}
        req = urllib.request.Request("https://octodb.design-bakery.com/api/rag/documents", data=json.dumps(body).encode(), method="POST",
                                     headers={"Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "chatbots-rag/0.1"})
        r = json.load(urllib.request.urlopen(req, timeout=120))
        print(i, "ok" if r.get("documentId") else r)
