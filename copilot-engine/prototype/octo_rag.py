"""Load manual text into the Octo 'Chatbots factory' workspace as 10-page RAG documents, and query it.
Key and workspace id come from ~/Documents/projects/.env (octo_db_chatbots, octo_db_chatbots_workspace); never printed.
Usage: octo_rag.py ingest <txt> <label> | list | query "<question>" [k]
"""
import json, os, sys, urllib.request

BASE = "https://octodb.design-bakery.com/api"

def env():
    out = {}
    for line in open(os.path.expanduser("~/Documents/projects/.env")):
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.strip().split("=", 1)
            out[k.replace("export ", "")] = v.strip().strip("'\"")
    return out["octo_db_chatbots"], out["octo_db_chatbots_workspace"]

KEY, WS = env()

def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method, headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json", "User-Agent": "chatbots-rag/0.1"},
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e:
        return {"http_error": e.code, "body": e.read().decode()[:300]}

def ingest(txt, label, pages_per_doc=10):
    pages = open(txt).read().split("\f")
    for i in range(0, len(pages), pages_per_doc):
        chunk = pages[i:i + pages_per_doc]
        # keep a page marker in the text so answers can cite it
        text = "\n".join(f"[page {i + j + 1}]\n{p}" for j, p in enumerate(chunk))
        title = f"manual:{label} pp {i + 1}-{i + len(chunk)}"
        r = call("POST", "/rag/documents", {"workspaceId": WS, "title": title, "text": text})
        print(title, "->", json.dumps(r)[:160])

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "ingest": ingest(sys.argv[2], sys.argv[3])
    elif cmd == "list":
        docs = call("GET", f"/rag/documents?workspaceId={WS}")
        print(len(docs), "documents")
        for d in docs[:40]: print(json.dumps(d)[:170])
    elif cmd == "query":
        r = call("POST", "/rag/query", {"workspaceId": WS, "query": sys.argv[2], "limit": int(sys.argv[3]) if len(sys.argv) > 3 else 4})
        print(json.dumps(r, indent=1)[:3000])
