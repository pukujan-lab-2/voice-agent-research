"""Retrieval score with ranx (MIT): recall@5 and MRR of the gold passage in the copilot's own top-10 search hits.

Reads the search hits that eval/run.ts recorded for every question with a gold passage, so a search miss (the right
passage never came back) is told apart from an answer miss (it came back, but the reply was wrong).
Run: eval/.venv/bin/python eval/retrieval.py --corpus irs      -> eval/out/<corpus>/retrieval.json
"""
import argparse
import json
from pathlib import Path

from ranx import Qrels, Run, evaluate

ap = argparse.ArgumentParser()
ap.add_argument("--corpus", default="irs")
args = ap.parse_args()
out = Path(__file__).resolve().parent / "out" / args.corpus

groups: dict[str, tuple[dict, dict]] = {}
for line in (out / "results.jsonl").read_text().splitlines():
    r = json.loads(line)
    if r.get("suite") != "single" or not r.get("gold"):
        continue
    for i, t in enumerate(r["turns"]):
        # vague questions are scored against their passage too: one reading is answered by it
        group = r["type"] if r["type"] != "chain" else ("chain (first turn)" if i == 0 else "chain (follow-ups)")
        qid = f"{r['id']}#{i}"
        for g in (group, "all"):
            qrels, run = groups.setdefault(g, ({}, {}))
            qrels[qid] = {r["gold"]: 1}
            hits = t.get("hits") or []
            # ranx needs a non-empty run per query; an empty search gets a dummy miss
            run[qid] = {h: float(len(hits) - k) for k, h in enumerate(dict.fromkeys(hits))} or {"(no hits)": 0.0}

report = {}
for g, (qrels, run) in groups.items():
    s = evaluate(Qrels(qrels), Run(run), ["recall@5", "recall@10", "mrr"], make_comparable=True)
    report[g] = {"queries": len(qrels), **{k: round(float(v), 3) for k, v in s.items()}}
(out / "retrieval.json").write_text(json.dumps(report, indent=1))
print(json.dumps(report, indent=1))
