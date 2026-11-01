"""Put everything the site shows about a source into Octo, the one store for the tax library (no static copies):

  Octo files     each publication's and instruction's printed PDF (build/irs/pdf, from tools/irs_pdf.py). Stored as
                 plain bytes so Octo doesn't index the PDFs a second time (the passages are already in its search);
                 metadata.contentType says application/pdf and the site's API serves them as PDFs.
  irs_docs       one row per source: title, kind (pdf | article), irs.gov link, page count, the PDF's file id, the
                 section list for the library, and, for web-page sources (Tax Topics, FAQ pages), the article body.
  irs_passages   one row per passage (the same ids as the Octo search documents): text, section, link, anchor, and the
                 PDF page it is printed on (from build/irs/pages.json; none when it couldn't be placed exactly).
Both tables live in the workspace's own Postgres (POST /workspaces/<id>/query). Resumable: re-running upserts rows and
skips PDFs already uploaded. Usage: python3 tools/irs_store.py [--no-files]
"""
import base64, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE.parent.parent / "copilot-engine" / "tools"))
import paddle_passages as pp  # noqa: E402  (reads the Octo key/workspace from ~/Documents/projects/.env, never printed)

sys.path.insert(0, str(HERE.parent.parent / "ingest" / "src"))
from site_ingest.octo import Octo  # noqa: E402  (the one Octo client; ingest/ also loads other businesses' sites)

SITE = HERE / "build" / "irs" / "site"
_client = None


def client() -> Octo:
    global _client
    if _client is None:
        _client = Octo.from_env()
    return _client


def octo(path, body=None, timeout=300):
    c = client()
    c.timeout = timeout
    return c.request("POST" if body is not None else "GET", path, body)


def sql(ws, text, params=None):
    return octo(f"/workspaces/{ws}/query", {"sql": text, **({"params": params} if params else {})})


SCHEMA = """
create table if not exists irs_docs (
  doc text primary key, kind text not null, source text not null, title text not null, url text not null,
  category text not null, pages int, file_id text, file_name text, sections jsonb not null default '[]', body jsonb);
create table if not exists irs_passages (
  id text primary key, doc text not null, seq int not null, section text not null, url text not null,
  anchor text, page int, faq text, text text not null);
create index if not exists irs_passages_doc on irs_passages (doc, seq);
"""


def upsert(ws, table, cols, rows, key, chunk=150):
    Octo(client().key, ws, client().base, client().timeout).upsert(table, cols, rows, key, chunk, jsonb=("sections", "body"))


def main():
    ws = pp.env()["octo_db_chatbots_workspace"]
    for stmt in [s for s in SCHEMA.split(";") if s.strip()]:
        sql(ws, stmt)
    pages = json.load(open(HERE / "build/irs/pages.json"))
    library = {e["id"]: e for e in json.load(open(HERE / "data/irs.library.json"))}

    files = {f["name"]: f["id"] for f in octo(f"/files?workspaceId={ws}")}
    if "--no-files" not in sys.argv:
        for doc, info in pages.items():
            name = f"irs-{info['file']}"
            if name in files:
                continue
            data = (HERE / "build/irs/pdf" / info["file"]).read_bytes()
            r = octo("/files/upload", {"workspaceId": ws, "name": name, "mimeType": "application/octet-stream", "data": base64.b64encode(data).decode(),
                                        "dataEncoding": "base64", "metadata": {"contentType": "application/pdf", "doc": doc, "source": "irs.gov (public domain)"}})
            files[name] = r["id"]
            print(f"  uploaded {name} ({len(data) // 1024} KB)", flush=True)

    docs = []
    for g in sorted(SITE.glob("guides/*.json")):
        a = json.load(open(g))
        doc = g.stem
        e = library.get(doc, {})
        pdf = pages.get(doc)
        cat = e.get("kind") or doc.split("-")[0]
        docs.append({"doc": doc, "kind": "pdf" if pdf and f"irs-{pdf['file']}" in files else "article", "source": a["source"], "title": a["title"],
                     "url": a["url"], "category": cat, "pages": pdf["pages"] if pdf else None,
                     "file_id": files.get(f"irs-{pdf['file']}") if pdf else None, "file_name": pdf["file"] if pdf else None,
                     "sections": [{"heading": s["heading"], "anchor": s.get("anchor", ""), "level": s.get("level", 2)} for s in a["sections"]][:400],
                     # PDF sources are read in pdf.js; web-page sources are drawn from this body.
                     "body": None if pdf else a})
    upsert(ws, "irs_docs", ["doc", "kind", "source", "title", "url", "category", "pages", "file_id", "file_name", "sections", "body"], docs, "doc", chunk=20)

    rows = []
    page_of = {pid: pg for info in pages.values() for pid, pg in info["page"].items()}
    for p in json.load(open(HERE / "data/irs.passages.json"))["passages"]:
        doc = p["id"].split(" #")[0].removeprefix("irs/")
        anchor = p.get("faq") or (p["url"].split("#", 1)[1] if "#" in p["url"] else None)
        rows.append({"id": p["id"], "doc": re.sub(r"-q\d+$", "", doc), "seq": int(p["id"].rsplit("#", 1)[1]), "section": p["section"],
                     "url": p["url"], "anchor": anchor, "page": page_of.get(p["id"]), "faq": p.get("faq"), "text": p["text"]})
    upsert(ws, "irs_passages", ["id", "doc", "seq", "section", "url", "anchor", "page", "faq", "text"], rows, "id", chunk=300)
    n = sql(ws, "select (select count(*) from irs_docs) d, (select count(*) from irs_docs where kind='pdf') p, (select count(*) from irs_passages) n, (select count(page) from irs_passages) pg")["rows"][0]
    print(f"Octo: {n['d']} sources ({n['p']} PDFs), {n['n']} passages, {n['pg']} with a page")


if __name__ == "__main__":
    main()
