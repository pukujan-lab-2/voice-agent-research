"""Load the large library manifests (build/lib/<source>/docs.jsonl, from tools/lib_fetch.py) into Octo, source by source:
IRC, then the IRM, the IRB, 26 CFR and the forms PDFs. For each batch of documents it
  1. uploads each PDF to Octo file storage (as plain bytes, so Octo doesn't index it a second time),
  2. upserts the documents into irs_docs and their passages into irs_passages (the same tables as the first 296 pages),
  3. adds every passage to Octo search, titled "<prefix><id> #<n>" (irc/, cfr/, irm/, irb/, irs/forms/), and marks it
     indexed, which is what the site's live counts read.
Resumable: passages already loaded (build/lib/ingested.jsonl) are skipped, and the manifests may still be growing; it
picks up new lines on its next pass. Octo embeds on the MacBook Pro, so before each batch this checks the Pro's free
memory and waits while it is under the floor. It waits for tools/irs_ingest.py to finish before it starts.

Usage: python3 tools/lib_ingest.py [--floor 20] [--workers 3] [--batch 300] [--only irc,forms] [--follow]
  --follow  keep going until the fetchers are done (re-reads the manifests every pass)
"""
import argparse, base64, json, pathlib, subprocess, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE / "tools"))
from irs_ingest import pro_free  # noqa: E402
from irs_store import octo, sql  # noqa: E402
import paddle_passages as pp  # noqa: E402

LIB = HERE / "build" / "lib"
LEDGER = LIB / "ingested.jsonl"
STOP = LIB / "STOP"
# Most documents first: the IRM has ~4 passages per subsection, the forms PDFs ~120 per form, so this order passes
# 10,000 documents hours sooner than fetch order would.
ORDER = ["irc", "irm", "irb", "cfr", "forms"]


def pid(d, p):
    return f"{d['prefix']}{d['doc'].split('-', 1)[1]} #{p['n']}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--floor", type=int, default=20)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--batch", type=int, default=300)
    ap.add_argument("--only", default=",".join(ORDER))
    ap.add_argument("--follow", action="store_true")
    a = ap.parse_args()
    ws = pp.env()["octo_db_chatbots_workspace"]
    while subprocess.run(["pgrep", "-f", "irs_ingest.py"], capture_output=True).returncode == 0:
        print("waiting for irs_ingest.py to finish", flush=True)
        time.sleep(60)
    sql(ws, "alter table irs_docs add column if not exists prefix text")
    sql(ws, "alter table irs_passages add column if not exists indexed boolean not null default false")
    sql(ws, "create index if not exists irs_passages_indexed on irs_passages (indexed)")
    sql(ws, "update irs_docs set prefix = 'irs/' where prefix is null")
    sql(ws, "update irs_passages set indexed = true where id like 'irs/%' and not indexed and id not like 'irs/forms/%'")
    done = {json.loads(l)["id"] for l in LEDGER.open()} if LEDGER.exists() else set()
    files = {f["name"]: f["id"] for f in octo(f"/files?workspaceId={ws}")}
    ledger = LEDGER.open("a")
    t0, loaded = time.time(), 0

    def batches():
        for src in [s for s in ORDER if s in a.only.split(",")]:
            m = LIB / src / "docs.jsonl"
            if not m.exists():
                continue
            batch, size = [], 0
            for line in m.open():
                d = json.loads(line)
                todo = [p for p in d["passages"] if pid(d, p) not in done]
                if not todo:
                    continue
                batch.append((d, todo)); size += len(todo)
                if size >= a.batch:
                    yield src, batch
                    batch, size = [], 0
            if batch:
                yield src, batch

    size = lambda src: (LIB / src / "docs.jsonl").stat().st_size if (LIB / src / "docs.jsonl").exists() else 0  # noqa: E731
    while True:
        any_work = False
        sizes = {s: size(s) for s in ORDER}
        for src, batch in batches():
            any_work = True
            if STOP.exists():
                print("STOP file found, stopping", flush=True); return
            while (free := pro_free()) is not None and free < a.floor:
                print(f"Pro free memory {free}% < {a.floor}%, waiting", flush=True)
                time.sleep(60)
            docs = []
            for d, _ in batch:
                fid = None
                if d["kind"] == "pdf" and d.get("file"):
                    name = f"{d['prefix'].strip('/').replace('/', '-')}-{pathlib.Path(d['file']).name}"
                    fid = files.get(name)
                    if not fid:
                        data = (HERE / d["file"]).read_bytes()
                        fid = octo("/files/upload", {"workspaceId": ws, "name": name, "mimeType": "application/octet-stream",
                                                     "data": base64.b64encode(data).decode(), "dataEncoding": "base64",
                                                     "metadata": {"contentType": "application/pdf", "doc": d["doc"], "source": "irs.gov (public domain)"}})["id"]
                        files[name] = fid
                docs.append({**{k: d[k] for k in ("doc", "kind", "source", "title", "url", "category", "pages", "sections", "body", "prefix")},
                             "file_id": fid, "file_name": pathlib.Path(d["file"]).name if d.get("file") else None})
            upsert(ws, "irs_docs", ["doc", "kind", "source", "title", "url", "category", "pages", "file_id", "file_name", "sections", "body", "prefix"], docs, "doc", 20)
            rows = [{"id": pid(d, p), "doc": d["doc"], "seq": p["n"], "section": p["section"], "url": p["url"], "anchor": p["anchor"], "page": p["page"],
                     "faq": None, "text": p["text"]} for d, todo in batch for p in todo]
            upsert(ws, "irs_passages", ["id", "doc", "seq", "section", "url", "anchor", "page", "faq", "text"], rows, "id", 300)

            def put(item):
                d, p = item
                for attempt in range(4):
                    try:
                        octo("/rag/documents", {"workspaceId": ws, "title": pid(d, p), "text": f"{d['source']}: {p['section']}\n{p['text']}"})
                        return pid(d, p)
                    except Exception:  # noqa: BLE001
                        time.sleep(3 * (attempt + 1))
                return None
            with ThreadPoolExecutor(a.workers) as ex:
                ok = [x for x in ex.map(put, [(d, p) for d, todo in batch for p in todo]) if x]
            for i in range(0, len(ok), 500):
                sql(ws, "update irs_passages set indexed = true where id = any($1)", [ok[i:i + 500]])
            for x in ok:
                ledger.write(json.dumps({"id": x}) + "\n"); done.add(x)
            ledger.flush()
            loaded += len(ok)
            rate = loaded / (time.time() - t0)
            print(f"{src}: +{len(ok)} ({len(rows) - len(ok)} failed), {loaded} this run, {rate:.1f}/s, Pro free {free}%", flush=True)
            # A source that comes earlier in the order got new documents (its fetcher is still running): go back to it.
            if any(size(s) != sizes[s] for s in ORDER[:ORDER.index(src)] if s in a.only.split(",")):
                break
        fetching = subprocess.run(["pgrep", "-f", "lib_fetch.py"], capture_output=True).returncode == 0
        if not a.follow or (not any_work and not fetching):
            break
        if not any_work:
            time.sleep(120)
        else:
            continue
    print(f"done: {loaded} passages loaded this run")


def upsert(ws, table, cols, rows, key, chunk):
    from irs_store import upsert as up
    up(ws, table, cols, rows, key, chunk)


if __name__ == "__main__":
    main()
