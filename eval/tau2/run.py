# Runs copilot_tax: tau2-bench simulated callers against the shipped desk (agent.py), scored by env assertions only.
#   node eval/target-server.ts --corpus irs        (with DESK_URL pointing at LFM3)
#   python run.py [--split ask|form|base] [--tasks id,id] [--trials 1] [--concurrency 2]
# The caller is the corpus config's open caller model (eval/config/irs.json), never Claude, Gemma or openrouter/free.
import json
import os
import sys
from pathlib import Path

from tau2.data_model.simulation import TextRunConfig
from tau2.registry import registry
from tau2.runner import run_domain

from agent import factory
from copilot_tax.environment import NAME, get_environment, get_tasks, get_tasks_split

ROOT = Path(__file__).resolve().parents[2]


def arg(k: str, d: str) -> str:
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d


def key(*names: str) -> str:
    # Same lookup as eval/lib/env.ts; the value is never printed.
    for f in (Path.home() / "Documents/projects/.env", Path.home() / ".hack_env"):
        if f.exists():
            for line in f.read_text().splitlines():
                k, _, v = line.removeprefix("export ").partition("=")
                if k.strip() in names and v.strip():
                    return v.strip().strip("'\"")
    return next((os.environ[n] for n in names if os.environ.get(n)), "")


caller = json.loads((ROOT / "eval/config/irs.json").read_text())["caller"]
assert caller["provider"] == "openrouter-free" and caller["model"].endswith(":free"), "the caller must be a named :free open model"
os.environ["OPENROUTER_API_KEY"] = key("openrouter_free_only", "OPENROUTER_FREE_KEY")

split = arg("--split", "base")
registry.register_domain(get_environment, NAME)
registry.register_tasks(get_tasks, NAME, get_task_splits=get_tasks_split)
registry.register_agent_factory(factory("ask"), "copilot_desk_ask")
registry.register_agent_factory(factory("form"), "copilot_desk_form")

ids = arg("--tasks", "").split(",") if "--tasks" in sys.argv else [t.id for t in get_tasks(split)]
out = Path(os.environ.get("ACS_CACHE_DIR", Path.home() / ".cache/acs")) / "scratch/tau2-runs"
for mode in ("ask", "form"):
    mine = [i for i in ids if i.startswith(mode)]
    if not mine:
        continue
    res = run_domain(TextRunConfig(
        domain=NAME, agent=f"copilot_desk_{mode}", llm_agent="lfm3 (in the desk)", llm_args_agent={},
        llm_user=f"openrouter/{caller['model']}", llm_args_user={"temperature": caller.get("temperature", 0.9)},
        task_ids=mine, num_trials=int(arg("--trials", "1")), max_concurrency=int(arg("--concurrency", "2")),
        max_steps=60, seed=158, save_to=str(out / f"{mode}.json")))
    for s in res.simulations:
        r = s.reward_info
        bad = [c.env_assertion.message for c in (r.env_assertions or []) if not c.met] if r else []
        print(f"{s.task_id:24} reward {r.reward if r else 'n/a'}  {s.termination_reason}  {'; '.join(bad)}")
