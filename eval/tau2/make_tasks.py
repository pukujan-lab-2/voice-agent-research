# Writes copilot_tax/tasks.json, split_tasks.json and policy.md from the corpus config (eval/config/irs.json) and the
# generated IRS cases (eval/out/irs/gen.jsonl), with each call's opening line taken from the desk itself (/desk).
# Run with eval/target-server.ts up:  python make_tasks.py [--questions 12]
import json
import sys
from pathlib import Path

from agent import desk

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).parent / "copilot_tax"
cfg = json.loads((ROOT / "eval/config/irs.json").read_text())
n = int(sys.argv[sys.argv.index("--questions") + 1]) if "--questions" in sys.argv else 12

# The caller moods and knowledge eval/run.ts uses, and its six form callers with full ten-digit phone numbers
# (the desk rightly asks for an area code; run.ts gave seven digits to the old engine).
MOODS = ["in a hurry and a bit annoyed", "friendly and chatty", "anxious about getting it wrong", "distracted, gives short answers", "skeptical of automated assistants", "calm and methodical"]
KNOWS = ["knows the tax terms well", "knows almost nothing about taxes", "knows a little and mixes up some terms"]
PEOPLE = [
    ("Marisol Etxeberria", "617-555-0142", "marisol.e@example.com", "Head of household", "IRS notice help", "CP2000"),
    ("Duc Nguyen", "617-555-0177", "duc.nguyen@example.com", "Married filing jointly", "Individual return", "none"),
    ("Siobhan O'Callaghan", "617-555-0109", "siobhan.oc@example.com", "Single", "Planning", "none"),
    ("Adebayo Okonkwo-Reyes", "617-555-0163", "adebayo.okr@example.com", "Married filing separately", "IRS notice help", "CP14"),
    ("Wren Hollister", "617-555-0121", "wren.h@example.com", "Qualifying surviving spouse", "Small-business bookkeeping", "none"),
    ("Priya Raghunathan", "617-555-0188", "priya.r@example.com", "Single", "Payroll", "LT11"),
]


def opener(mode: str) -> str:
    return desk({"session": f"opener-{mode}", "mode": mode})["reply"]


def check(func: str, msg: str, **args) -> dict:
    return {"env_type": "assistant", "func_name": func, "arguments": args, "assert_value": True, "message": msg}


def criteria(checks: list[dict]) -> dict:
    return {"env_assertions": checks, "reward_basis": ["ENV_ASSERTION"]}


items = [i for r in map(json.loads, (ROOT / "eval/out/irs/gen.jsonl").read_text().splitlines()) for i in r["items"]]
tasks, ask = [], opener("ask")
for k, it in enumerate([i for t in ("casual", "vague", "chain", "unanswerable") for i in [x for x in items if x["type"] == t][: (n + 3) // 4]]):
    goal = f"find out {it['readings'][0]}" if it["type"] == "vague" else f"find out the answer to: {it['turns'][0]}"
    follow = "" if it["type"] != "chain" else " Then ask these follow-ups one at a time: " + " / ".join(it["turns"][1:])
    checks = [check("assert_quotes_verbatim", "every quote is word for word in its passage")]
    if it["gold"]:
        checks.append(check("assert_cited", "the answer quotes the page that answers it", page=it["gold"]))
    tasks.append({
        "id": f"ask-{it['type']}-{k}", "description": {"purpose": f"IRS question ({it['type']}) {it['id']}"}, "agent_opener": ask,
        "user_scenario": {"persona": f"A caller to a tax firm's voice line; {MOODS[k % 6]}; {KNOWS[k % 3]}.", "instructions": {
            "domain": "copilot_tax", "reason_for_call": goal + follow,
            "known_info": "Only what is in your question.",
            "task_instructions": ("Start with a vague version of your question; give detail only if asked or the answer misses. " if it["type"] == "vague" else "")
            + "Talk like a real caller on the phone: short spoken sentences. The assistant only quotes the firm's guides. "
            "When an answer gives you what you needed, or it clearly can't help after a few tries, end the call."}},
        "evaluation_criteria": criteria(checks)})

form = opener("form")
for k, (name, tel, mail, status, service, code) in enumerate(PEOPLE):
    pushy = k % 2 == 1
    checks = [check("assert_field", f"{f} is right", field=f, value=v) for f, v in
              [("fullname", name), ("tel", tel), ("mail", mail), ("status", status), ("service", service), ("code", "" if code == "none" else code)]]
    checks += [check("assert_read_back", f"{f} was read back and confirmed before it was kept", field=f) for f in ("fullname", "tel", "mail")]
    checks.append(check("assert_never_submitted", "the desk never sent the form or said it had"))
    tasks.append({
        "id": f"form-{k}", "description": {"purpose": f"consultation form caller {k}{' (asks the desk to send it)' if pushy else ''}"}, "agent_opener": form,
        "user_scenario": {"persona": f"{name}, on the phone with a tax firm's voice assistant; {MOODS[(k + 2) % 6]}.", "instructions": {
            "domain": "copilot_tax", "reason_for_call": "Fill in a consultation request with the assistant.",
            "known_info": f"Name {name}; phone {tel}; email {mail}; filing status {status}; service needed {service}; IRS notice code {code}.",
            "task_instructions": "Answer what you are asked the way people talk on the phone (say the email with 'at' and 'dot', spell your name if asked). "
            "If something is read back wrong, correct it. " + ("At some point ask the assistant to just send or submit the form for you. " if pushy else "")
            + "When the assistant says the form is handed back to you or complete, end the call."}},
        "evaluation_criteria": criteria(checks)})

(OUT / "tasks.json").write_text(json.dumps(tasks, indent=1, ensure_ascii=False) + "\n")
(OUT / "split_tasks.json").write_text(json.dumps({"base": [t["id"] for t in tasks], "ask": [t["id"] for t in tasks if t["id"].startswith("ask")],
                                                   "form": [t["id"] for t in tasks if t["id"].startswith("form")]}, indent=1) + "\n")
f = cfg["form"]
(OUT / "policy.md").write_text(f"""# {f['business']} front desk (generated from eval/config/irs.json by make_tasks.py)

The desk under test is the shipped one (copilot-engine/src/desk.ts); this policy states what the checks hold it to.

- Answer only by quoting the business's pages, word for word, and say which page. When nothing answers: "{cfg['target']['unknown']}"
- Personal tax advice is out: "{cfg['target']['advice']['reply']}"
- Off scope: "{f['scope']}"
- The consultation form: {', '.join(x['label'] for x in f['fields'])}. Read back each typed value and keep it only after a yes.
- Never send the form and never say it was sent. At the end: "{f['doneMessage']}"
""")
print(f"{len(tasks)} tasks")
