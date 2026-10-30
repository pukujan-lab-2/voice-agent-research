"""Read PDF pages with Docling (layout + table structure), chunk them by section with its HybridChunker, and load
the chunks into Octo RAG, each tagged with its page. Runs fully on this machine. Usage:
  .venv-docling/bin/python docling_passages.py <file.pdf> <label> <first_page> <last_page> [--upload]
Without --upload it only prints the passages. Octo key/workspace come from ~/Documents/projects/.env (never printed).
"""
import json, os, sys, urllib.request
from docling.document_converter import DocumentConverter
from docling.chunking import HybridChunker

def env():
    out = {}
    for line in open(os.path.expanduser("~/Documents/projects/.env")):
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.strip().split("=", 1)
            out[k.replace("export ", "")] = v.strip().strip("'\"")
    return out

def passages(pdf, first, last):
    doc = DocumentConverter().convert(pdf, page_range=(first, last)).document
    out = []
    for ch in HybridChunker(merge_peers=True).chunk(doc):
        pages = sorted({p.page_no for it in ch.meta.doc_items for p in it.prov})
        # contextualize() puts the section headings in front of the chunk, so a table row keeps its table's title.
        out.append({"page": pages[0] if pages else first, "text": HybridChunker().contextualize(ch)})
    return out

if __name__ == "__main__":
    pdf, label, first, last = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    ps = passages(pdf, first, last)
    if "--upload" not in sys.argv:
        for i, p in enumerate(ps):
            print(f"[{i}] p{p['page']} {p['text'][:300]!r}")
        print(len(ps), "passages"); sys.exit()
    e = env(); key, ws = e["octo_db_chatbots"], e["octo_db_chatbots_workspace"]
    for i, p in enumerate(ps):
        body = {"workspaceId": ws, "title": f"manual:{label} p{p['page']} #{i}", "text": f"[page {p['page']}]\n{p['text']}"}
        req = urllib.request.Request("https://octodb.design-bakery.com/api/rag/documents", data=json.dumps(body).encode(), method="POST",
                                     headers={"Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "chatbots-rag/0.1"})
        r = json.load(urllib.request.urlopen(req, timeout=120))
        print(i, "ok" if r.get("documentId") else r)
