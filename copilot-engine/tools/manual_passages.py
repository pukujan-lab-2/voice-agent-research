"""Split manual pages (pdftotext output, pages separated by form feeds) into paragraph passages and load them
into Octo RAG, each tagged with its page. Usage:
  manual_passages.py <pages.txt> <label> <first_page> <last_page> [--upload]
Without --upload it only prints the passages. Octo key/workspace come from ~/Documents/projects/.env (never printed).
"""
import json, os, re, sys, urllib.request

def env():
    out = {}
    for line in open(os.path.expanduser("~/Documents/projects/.env")):
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.strip().split("=", 1)
            out[k.replace("export ", "")] = v.strip().strip("'\"")
    return out

def passages(txt, first, last, max_chars=700):
    pages = open(txt).read().split("\f")
    out = []
    for n in range(first, last + 1):
        lines = [l.strip() for l in pages[n - 1].splitlines()]
        # drop running headers, page numbers and the glossary hint
        lines = [l for l in lines if l and not re.fullmatch(r"\d+", l) and not l.startswith(("Section 1", "Need definitions?"))]
        text = re.sub(r"\s+", " ", " ".join(lines))
        # paragraphs: split on sentence ends that start a heading-like or new idea, then pack to max_chars
        sents = re.split(r"(?<=[.!?])\s+(?=[A-Z])", text)
        buf = ""
        for s in sents:
            if len(buf) + len(s) > max_chars and buf:
                out.append({"page": n, "text": buf.strip()}); buf = ""
            buf += " " + s
        if buf.strip():
            out.append({"page": n, "text": buf.strip()})
    return out

if __name__ == "__main__":
    txt, label, first, last = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    ps = passages(txt, first, last)
    if "--upload" not in sys.argv:
        for i, p in enumerate(ps):
            print(f"[{i}] p{p['page']} {p['text'][:150]}")
        print(len(ps), "passages"); sys.exit()
    e = env(); key, ws = e["octo_db_chatbots"], e["octo_db_chatbots_workspace"]
    for i, p in enumerate(ps):
        body = {"workspaceId": ws, "title": f"manual:{label} p{p['page']} #{i}", "text": f"[page {p['page']}]\n{p['text']}"}
        req = urllib.request.Request("https://octodb.design-bakery.com/api/rag/documents", data=json.dumps(body).encode(), method="POST",
                                     headers={"Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "chatbots-rag/0.1"})
        r = json.load(urllib.request.urlopen(req, timeout=120))
        print(i, "ok" if r.get("documentId") else r)
