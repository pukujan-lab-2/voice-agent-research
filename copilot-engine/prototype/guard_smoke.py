# Smoke test: can LFM3-1.7B do the copilot's narrow job (read one answer -> one JSON action)?
import json, re, sys, time, urllib.request

REPO = "LFM3-1.7B-Q4_K_M (llama.cpp b12000)"
URL = "http://127.0.0.1:11436/v1/chat/completions"  # ssh tunnel to llama-server on the Windows PC

def chat(msgs):
    body = json.dumps({"messages": msgs, "temperature": 0, "max_tokens": 600,
                       "response_format": {"type": "json_object"}, "chat_template_kwargs": {"enable_thinking": False}}).encode()
    req = urllib.request.Request(URL, body, {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=300))["choices"][0]["message"]["content"]

SYSTEM = """You are the understanding step of a website copilot for Halvorsen Home (appliance warranty claims).
Form fields: name, serial (letters and digits), problem, visit_time (morning|afternoon).
Allowed actions: fill, ask_again, off_scope, confirm_yes, confirm_no.
Reply with ONE JSON object only, no other text:
{"action": "...", "field": "...", "value": "..."}
- fill: the customer answered the current question; value is the answer, cleaned up.
- ask_again: the answer is unclear or missing.
- off_scope: the request is not about this warranty claim.
- confirm_yes / confirm_no: only when the current question is the final confirmation."""

CASES = [
    # (current question, customer said, check)
    ("serial", "It's one three three four, five nine two, C, L as in Lima, S, D, three",
     lambda o: o.get("action") == "fill" and re.sub(r"[^A-Z0-9]", "", str(o.get("value", "")).upper()) == "1334592CLSD3"),
    ("problem", "it shows E24 and there's water at the bottom", lambda o: o.get("action") == "fill" and "E24" in str(o.get("value", ""))),
    ("visit_time", "uh, before lunch is better", lambda o: o.get("action") == "fill" and o.get("value") == "morning"),
    ("visit_time", "can you order me a pizza?", lambda o: o.get("action") == "off_scope"),
    ("name", "hmm", lambda o: o.get("action") == "ask_again"),
    ("final confirmation: submit the claim?", "wait, not yet", lambda o: o.get("action") == "confirm_no"),
    ("final confirmation: submit the claim?", "yes go ahead", lambda o: o.get("action") == "confirm_yes"),
    ("serial", "yes", lambda o: o.get("action") == "ask_again"),
]


# ---- guard layer: code decides what it can; the model only handles free-form understanding ----
DIGITS = {"zero":"0","oh":"0","one":"1","two":"2","three":"3","four":"4","five":"5","six":"6","seven":"7","eight":"8","nine":"9"}

def spoken_to_serial(text):
    """'one three three four, C, L as in Lima, S' -> '1334CLS'. Drops 'as in <word>' and filler words."""
    text = re.sub(r"(\w)['\u2019](s|re|m|ll|d|ve|t)\b", r"\1", text, flags=re.I)  # "it's" -> "it", not letter S
    t = re.sub(r"\b([a-z])\s+as\s+in\s+\w+", lambda m: m.group(1), text, flags=re.I)
    out = []
    for tok in re.findall(r"[A-Za-z0-9]+", t):
        w = tok.lower()
        if w in DIGITS: out.append(DIGITS[w])
        elif tok.isdigit(): out.append(tok)
        elif len(tok) == 1 and tok.isalpha(): out.append(tok.upper())
        elif re.fullmatch(r"[A-Za-z0-9]{2,}", tok) and re.search(r"\d", tok) and re.search(r"[A-Za-z]", tok): out.append(tok.upper())
    return "".join(out)

def valid_serial(s): return bool(re.fullmatch(r"[A-Z0-9]{12}", s)) and bool(re.search(r"\d", s))

YES = re.compile(r"\b(yes|yeah|yep|go ahead|confirm|submit it|do it|sure)\b", re.I)
NO = re.compile(r"\b(no|nope|wait|not yet|stop|cancel|hold on|don'?t)\b", re.I)

def guarded(q, said, model_call):
    # 1. final confirmation: rules only. Anything unclear is ask_again, never a submit.
    if q.startswith("final confirmation"):
        if NO.search(said): return {"action": "confirm_no"}          # a "no" word wins over a "yes" word
        if YES.search(said): return {"action": "confirm_yes"}
        return {"action": "ask_again"}
    # 2. serial: code builds and validates the value from the transcript
    if q == "serial":
        s = spoken_to_serial(said)
        if valid_serial(s): return {"action": "fill", "field": "serial", "value": s}
        return {"action": "ask_again", "field": "serial"}
    # 3. everything else: ask the model, then refuse empty fills
    o = model_call()
    if o.get("action") == "fill" and not str(o.get("value", "")).strip(): return {"action": "ask_again", "field": q}
    return o

passed = 0
for q, said, ok in CASES:
    msgs = [{"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Current question: {q}\nCustomer said: {said}"}]
    t = time.time()
    def model_call():
        global out
        out = chat(msgs)
        m = re.search(r"\{.*?\}", out, re.S)
        try: return json.loads(m.group(0)) if m else {}
        except json.JSONDecodeError: return {}
    out = "(decided by code, no model call)"
    obj = guarded(q, said, model_call)
    ms = int((time.time() - t) * 1000)
    good = bool(obj) and ok(obj)
    passed += good
    print(f"{'PASS' if good else 'FAIL'} {ms:5d}ms  [{q[:22]}] {said!r}\n      -> {json.dumps(obj)[:120]}   [{out.strip()[:60]}]")
print(f"\n{passed}/{len(CASES)} passed ({REPO})")
