"""Load data/irs.passages.json into Octo RAG, one document per passage titled with the passage id ("irs/..."), so a query
with filter.titlePrefix "irs/" searches only this corpus and every match maps back to its source, section and link.
Resumable: passages already in Octo (by title) or in build/irs/ingested.jsonl are skipped, so stop it any time
(Ctrl-C, or touch build/irs/STOP) and run it again. Octo embeds on the MacBook Pro, so after every batch this checks the
Pro's free memory over `ssh mac-pro` and waits while it is under the floor.
Usage: python3 tools/irs_ingest.py [--batch 200] [--workers 3] [--floor 25] [--limit N]
"""
import argparse, json, pathlib, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE.parent.parent / "copilot-engine" / "tools"))
import paddle_passages as pp  # noqa: E402  (reads the Octo key/workspace from ~/Documents/projects/.env, never printed)
from irs_store import octo  # noqa: E402  (the shared Octo client from ingest/)

LEDGER = HERE / "build" / "irs" / "ingested.jsonl"
STOP = HERE / "build" / "irs" / "STOP"

# The brief's own sources go in first, so the demo works long before the whole library is loaded.
FIRST = re.compile(r"^irs/(faqs-|taxtopics-|publications-p(17|501|505|334|463|583|587|590a|590b|596|970|936|523|527|15) #|instructions-i1040gi )")


def pro_free():
    """The MacBook Pro's free-memory percentage (memory_pressure), or None if it can't be read."""
    try:
        out = subprocess.run(["ssh", "-o", "ConnectTimeout=8", "mac-pro", "memory_pressure | tail -1"], capture_output=True, text=True, timeout=30).stdout
        return int(re.search(r"(\d+)%", out).group(1))
    except Exception:  # noqa: BLE001
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", type=int, default=200)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--floor", type=int, default=25)
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    ws = pp.env()["octo_db_chatbots_workspace"]
    ps = json.loads((HERE / "data" / "irs.passages.json").read_text())["passages"]
    have = {d["title"] for d in octo(f"/rag/documents?workspaceId={ws}") if d["title"].startswith("irs/")}
    if LEDGER.exists():
        have |= {json.loads(l)["id"] for l in LEDGER.read_text().splitlines() if l.strip()}
    todo = sorted((p for p in ps if p["id"] not in have), key=lambda p: not FIRST.match(p["id"]))
    if a.limit:
        todo = todo[:a.limit]
    print(f"{len(ps)} passages, {len(have)} already in Octo, {len(todo)} to load", flush=True)

    def put(p):
        for attempt in range(4):
            try:
                r = octo("/rag/documents", {"workspaceId": ws, "title": p["id"], "text": f"{p['source']}: {p['section']}\n{p['text']}"})
                if r.get("documentId"):
                    return {"id": p["id"], "doc": r["documentId"]}
            except Exception as e:  # noqa: BLE001
                err = str(e)
            time.sleep(5 * (attempt + 1))
        return {"id": p["id"], "error": err if 'err' in locals() else "no documentId"}

    t0, done, failed = time.time(), 0, 0
    with ThreadPoolExecutor(a.workers) as pool, LEDGER.open("a") as led:
        for i in range(0, len(todo), a.batch):
            if STOP.exists():
                print("STOP file found; stopping (run again to resume)"); break
            while (free := pro_free()) is not None and free < a.floor:
                print(f"MacBook Pro free memory {free}% < {a.floor}%; waiting 60 s", flush=True); time.sleep(60)
            for r in pool.map(put, todo[i:i + a.batch]):
                if "doc" in r:
                    led.write(json.dumps(r) + "\n"); done += 1
                else:
                    failed += 1; print("FAILED", r, flush=True)
            led.flush()
            rate = done / max(time.time() - t0, 1)
            print(f"{done}/{len(todo)} loaded, {failed} failed, {rate:.1f}/s, Pro free {free}%, "
                  f"~{(len(todo) - done) / max(rate, 0.01) / 60:.0f} min left", flush=True)


if __name__ == "__main__":
    main()
