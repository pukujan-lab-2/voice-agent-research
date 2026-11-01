"""How retrieval holds up as a business's site grows: Octo's own hybrid-search SQL on a throwaway Postgres.

Loading 200,000 passages through Octo's API takes hours (each one is an embedding call, about 0.4 s), so this builds
Octo's RAG tables in a scratch pgvector container, copies Octo's current `octo.match_chunks_hybrid` out of its migrations
unchanged, bulk-loads a synthetic site (eval/size/synth.py) and times the function the way /api/rag/query calls it, with
each filter the copilot uses. The reranker (a separate model service) is not in this path. Nothing here touches the live
Octo or a local copy of anyone's data.

  eval/.venv/bin/python eval/size/bench.py --octo-db ~/Documents/projects/octo-db --sizes 10000,50000,200000
Writes eval/out/synthetic-<n>/{results.jsonl,latency.json}; then score with
  eval/.venv/bin/python eval/retrieval.py --corpus synthetic-<n>
Needs Docker (the pgvector/pgvector:pg16 image) and about 2 GB of memory for 200,000 passages.
"""
from __future__ import annotations

import argparse
import json
import random
import re
import statistics
import subprocess
import sys
import time
import uuid
from pathlib import Path

import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parent))
import synth  # noqa: E402

NAME, PORT, PW = "octo-size-bench", 54329, "bench"
WS = uuid.UUID(int=1)
CFG = uuid.UUID(int=2)
OUT = Path(__file__).resolve().parent.parent / "out"


def uid(kind: int, i: int) -> str:
    return str(uuid.UUID(int=(kind << 64) | (i + 10)))


def start_container() -> None:
    subprocess.run(["docker", "rm", "-f", NAME], capture_output=True)
    subprocess.run(["docker", "run", "-d", "--name", NAME, "-p", f"{PORT}:5432", "-e", f"POSTGRES_PASSWORD={PW}", "--memory", "1500m", "--shm-size", "512m",
                    "pgvector/pgvector:pg16", "-c", "shared_buffers=256MB", "-c", "maintenance_work_mem=600MB", "-c", "max_wal_size=4GB", "-c", "fsync=off",
                    "-c", "max_parallel_maintenance_workers=0", "-c", "synchronous_commit=off", "-c", "full_page_writes=off"], check=True, capture_output=True)
    for _ in range(60):
        try:
            psycopg.connect(f"host=127.0.0.1 port={PORT} user=postgres password={PW}", connect_timeout=2).close()
            return
        except psycopg.OperationalError:
            time.sleep(1)
    raise SystemExit("postgres did not start")


def function_sql(octo_db: Path) -> str:
    """Octo's current match_chunks_hybrid, exactly as its migration defines it."""
    f = sorted((octo_db / "db" / "migrations").glob("*halfvec_512*.sql"))[-1].read_text()
    m = re.search(r"CREATE FUNCTION octo\.match_chunks_hybrid\(.*?\$\$ LANGUAGE sql STABLE\s*SECURITY DEFINER\s*SET search_path = [^;]*;", f, re.S)
    if not m:
        raise SystemExit("could not find match_chunks_hybrid in the halfvec migration")
    return m.group(0)


SCHEMA = """
create extension if not exists vector;
drop schema if exists octo cascade; create schema octo;
create table octo.workspaces (id uuid primary key);
create table octo.documents (id uuid primary key, workspace_id uuid not null references octo.workspaces(id), title text not null, created_at timestamptz not null default now(),
  constraint documents_unique_title unique (workspace_id, title));
create table octo.document_versions (id uuid primary key, document_id uuid not null references octo.documents(id) on delete cascade, workspace_id uuid not null,
  version_number int not null, content_hash text not null, mime_type text not null, extraction_status text not null default 'extracted');
create table octo.embedding_configs (id uuid primary key, workspace_id uuid not null, model text not null, model_version text not null, chunker text not null);
create table octo.chunks (id uuid primary key, workspace_id uuid not null, document_version_id uuid not null references octo.document_versions(id) on delete cascade,
  config_id uuid not null references octo.embedding_configs(id), chunk_index int not null, chunk_key text not null, content text not null, start_offset int not null,
  end_offset int not null, page int,
  content_tsv tsvector generated always as (to_tsvector('english', content)) stored);
create table octo.embeddings (id uuid primary key, workspace_id uuid not null, chunk_id uuid not null references octo.chunks(id) on delete cascade,
  config_id uuid not null, embedding halfvec(512) not null);
create function octo.is_workspace_member(uuid) returns boolean as 'select true' language sql;
create function octo.current_workspace_id() returns uuid as 'select null::uuid' language sql;
"""
INDEXES = """
create index idx_chunks_version on octo.chunks(document_version_id);
create index idx_chunks_workspace on octo.chunks(workspace_id);
create index idx_chunks_content_tsv on octo.chunks using gin (content_tsv);
create index idx_embeddings_workspace on octo.embeddings(workspace_id);
create index idx_embeddings_hnsw on octo.embeddings using hnsw (embedding halfvec_cosine_ops);
create index idx_versions_doc on octo.document_versions(document_id);
analyze;
"""


def load(conn: psycopg.Connection, rows: list[tuple[int, synth.Passage]], offset: int) -> None:
    with conn.cursor() as cur:
        with cur.copy("copy octo.documents (id, workspace_id, title) from stdin") as cp:
            for i, p in rows:
                cp.write_row((uid(1, i + offset), WS, p.id))
        with cur.copy("copy octo.document_versions (id, document_id, workspace_id, version_number, content_hash, mime_type) from stdin") as cp:
            for i, _p in rows:
                cp.write_row((uid(2, i + offset), uid(1, i + offset), WS, 1, f"sha256:{i + offset}", "text/plain"))
        with cur.copy("copy octo.chunks (id, workspace_id, document_version_id, config_id, chunk_index, chunk_key, content, start_offset, end_offset) from stdin") as cp:
            for i, p in rows:
                text = f"Product page - {p.section}\n{p.text}"
                cp.write_row((uid(3, i + offset), WS, uid(2, i + offset), CFG, 0, f"k{i + offset}", text, 0, len(text)))
        with cur.copy("copy octo.embeddings (id, workspace_id, chunk_id, config_id, embedding) from stdin") as cp:
            for i, p in rows:
                cp.write_row((uid(4, i + offset), WS, uid(3, i + offset), CFG, synth.vector_literal(synth.embed(f"Product page {p.section} {p.text}"))))
    conn.commit()


def pct(xs: list[float], q: float) -> float:
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(q * len(xs)))]


def run_size(n: int, octo_db: Path, n_queries: int, small: int, seed: int) -> dict:
    t0 = time.time()
    start_container()
    dsn = f"host=127.0.0.1 port={PORT} user=postgres password={PW}"
    conn = psycopg.connect(dsn, autocommit=False)
    conn.execute(SCHEMA)
    conn.execute("insert into octo.workspaces values (%s)", (WS,))
    conn.execute("insert into octo.embedding_configs values (%s, %s, 'qwen3-embedding:0.6b', 'bench', 'markdown')", (CFG, WS))
    conn.execute(function_sql(octo_db))
    conn.commit()
    big = synth.passages(n, "bigsite", seed)
    shop = synth.passages(small, "smallshop", seed + 1)
    load(conn, list(enumerate(big)), 0)
    load(conn, list(enumerate(shop)), n)
    t_load = time.time() - t0
    t1 = time.time()
    conn.autocommit = True
    conn.execute(INDEXES)
    t_index = time.time() - t1
    print(f"[{n}] loaded {n + small} passages in {t_load:.0f}s, indexed in {t_index:.0f}s", flush=True)

    rng = random.Random(seed + 2)
    by_section: dict[str, list[int]] = {}
    for i, p in enumerate(big):
        by_section.setdefault(p.section, []).append(i)
    gold = rng.sample(big, n_queries)
    shop_gold = rng.sample(shop, min(n_queries, small))

    def call(p: synth.Passage, q: str, prefix: str | None, ids: list[str] | None) -> tuple[list[str], float]:
        vec = synth.vector_literal(synth.embed(q))
        t = time.perf_counter()
        rows = conn.execute("select title from octo.match_chunks_hybrid(%s::uuid, %s::halfvec, %s, 10, %s::uuid[], %s, false)", (WS, vec, q, ids, prefix)).fetchall()
        return [r[0] for r in rows], (time.perf_counter() - t) * 1000

    variants = {
        "unfiltered": lambda p: (None, None),
        "business": lambda p: (f"{p.business}/", None),
        "language": lambda p: (f"{p.business}/{p.language}/", None),
        "language+page type": lambda p: (f"{p.business}/{p.language}/{p.page_type}/", None),
        "section": lambda p: (f"{p.business}/", [uid(1, i) for i in by_section[p.section]]),
    }
    results, lat = [], {}
    for name, f in variants.items():
        ms = []
        for k, p in enumerate(gold):
            q = synth.question(p, rng)
            prefix, ids = f(p)
            hits, t = call(p, q, prefix, ids)
            if k >= 3 or name != "unfiltered":
                ms.append(t)
            results.append({"key": f"single|{p.id}|{name}", "suite": "single", "type": name, "id": f"{p.id}|{name}", "gold": p.id, "turns": [{"q": q, "hits": hits}]})
        lat[name] = ms
    ms = []
    for p in shop_gold:
        q = synth.question(p, rng)
        hits, t = call(p, q, "smallshop/", None)
        ms.append(t)
        results.append({"key": f"single|{p.id}|small tenant", "suite": "single", "type": "small tenant (prefix)", "id": f"{p.id}|small", "gold": p.id, "turns": [{"q": q, "hits": hits}]})
    lat["small tenant (prefix)"] = ms

    exp = arm_experiment(conn, big, rng) if n >= 50000 else {}
    out = OUT / f"synthetic-{n}"
    out.mkdir(parents=True, exist_ok=True)
    (out / "results.jsonl").write_text("".join(json.dumps(r) + "\n" for r in results))
    summary = {"passages": n, "otherTenantPassages": small, "queries": n_queries, "loadS": round(t_load), "indexS": round(t_index),
               "latencyMs": {k: {"p50": round(statistics.median(v)), "p90": round(pct(v, 0.9)), "max": round(max(v))} for k, v in lat.items()}, "armExperiment": exp}
    (out / "latency.json").write_text(json.dumps(summary, indent=1))
    conn.close()
    subprocess.run(["docker", "rm", "-f", NAME], capture_output=True)
    return summary


def arm_experiment(conn: psycopg.Connection, big: list[synth.Passage], rng: random.Random) -> dict:
    """Where a whole-business filtered search spends its time. The function builds the `allowed` set (every chunk under the
    prefix), then runs a vector arm over it and a lexical arm restricted to it. Each part is timed on its own, as Octo writes
    it, and the vector arm again on the HNSW index with iterative scans (the fix proposed in octo-database#391)."""
    p = rng.choice(big)
    q = synth.question(p, rng)
    vec = synth.vector_literal(synth.embed(q))
    prefix = f"{p.business}/"
    allowed = """select c.id from octo.chunks c join octo.document_versions v on v.id = c.document_version_id join octo.documents d on d.id = v.document_id
      where c.workspace_id = %(ws)s and left(d.title, length(%(p)s)) = %(p)s"""
    parts = {
        "allowed set (every chunk under the prefix)": (f"select count(*) from ({allowed}) a", None),
        "vector arm as written (order by distance + 0)": (f"select e.chunk_id from octo.embeddings e join octo.chunks c on c.id = e.chunk_id join ({allowed}) a on a.id = c.id "
                                                          "where e.workspace_id = %(ws)s order by (e.embedding <=> %(v)s::halfvec) + 0 limit 40", None),
        "vector arm on the HNSW index, iterative scan": ("select e.chunk_id from octo.embeddings e where e.workspace_id = %(ws)s order by e.embedding <=> %(v)s::halfvec limit 40",
                                                          "set hnsw.iterative_scan = relaxed_order"),
        "lexical arm restricted to the prefix": (f"select c.id from octo.chunks c where c.workspace_id = %(ws)s and c.content_tsv @@ to_tsquery('english', %(t)s) "
                                                  f"and c.id in ({allowed}) order by ts_rank(c.content_tsv, to_tsquery('english', %(t)s)) desc limit 40", None),
        "lexical arm, no prefix": ("select c.id from octo.chunks c where c.workspace_id = %(ws)s and c.content_tsv @@ to_tsquery('english', %(t)s) "
                                    "order by ts_rank(c.content_tsv, to_tsquery('english', %(t)s)) desc limit 40", None),
    }
    tsq = " | ".join(w for w in synth.tokens(q) if w not in synth.STOP and w.isalpha())
    out: dict = {}
    for label, (sql_text, setup) in parts.items():
        if setup:
            conn.execute(setup)
        ts = []
        for _ in range(5):
            t = time.perf_counter()
            conn.execute(sql_text, {"ws": WS, "p": prefix, "v": vec, "t": tsq}).fetchall()
            ts.append((time.perf_counter() - t) * 1000)
        out[label] = {"p50Ms": round(statistics.median(ts))}
        conn.execute("reset hnsw.iterative_scan")
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--octo-db", type=Path, required=True, help="a checkout of the octo-db repository (its migrations define the search function)")
    ap.add_argument("--sizes", default="10000,50000,200000")
    ap.add_argument("--queries", type=int, default=100)
    ap.add_argument("--small-tenant", type=int, default=2000, help="passages of a second, small business in the same workspace")
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    for n in [int(x) for x in a.sizes.split(",")]:
        print(json.dumps(run_size(n, a.octo_db.expanduser(), a.queries, a.small_tenant, a.seed), indent=1), flush=True)


if __name__ == "__main__":
    main()
