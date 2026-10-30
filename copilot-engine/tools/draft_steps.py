"""Draft numbered steps from manual pages with a free open model, then check each step is backed by its page.
The output is a DRAFT for the business owner to review (reviewed: false). Usage:
  draft_steps.py <pages.txt> <first> <last> "<task>" <out.json>
Uses the vault working key openrouter_free_lease from ~/Documents/projects/.env. Always names the model (never openrouter/free).
"""
import json, os, re, sys, urllib.request

MODELS = ["nvidia/nemotron-3-ultra-550b-a55b:free", "nvidia/nemotron-3.5-super-vl:free"]  # named free models only
URL = "https://octodb.design-bakery.com/api/vault/proxy/https://openrouter.ai/api/v1/chat/completions"
STOP = set("a an the is are be to of in on for and or it this that you your if can will may with at by from as not do does".split())

def env(k):
    for line in open(os.path.expanduser("~/Documents/projects/.env")):
        if line.startswith(k + "="): return line.strip().split("=", 1)[1].strip("'\"")

def words(s): return {w.rstrip("s") for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in STOP}

def ask(model, prompt, key):
    body = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0, "max_tokens": 3000, "response_format": {"type": "json_object"}}
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "chatbots/0.1"})
    d = json.load(urllib.request.urlopen(req, timeout=300))
    return d["model"], d["choices"][0]["message"]["content"]

if __name__ == "__main__":
    txt, first, last, task, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
    pages = open(txt).read().split("\f")
    text = "\n\n".join(f"[page {n}]\n{pages[n - 1]}" for n in range(first, last + 1))
    prompt = f"""From the manual pages below, write the steps a person follows to: {task}.
Rules: 5 to 9 steps. Each step is one short instruction a person can do or check, in plain words, using only facts in these pages.
Keep phone numbers and web addresses exactly as written. Give the page each step comes from.
Reply with JSON only: {{"steps": [{{"text": "...", "page": 15}}]}}

{text}"""
    key = env("openrouter_free_lease")
    steps = None
    # Free models are sometimes busy (429) or return broken JSON: two tries per named model, then the next one.
    for m in MODELS:
        for _ in range(2):
            try:
                used, reply = ask(m, prompt, key)
                steps = json.loads(re.search(r"\{[\s\S]*\}", reply).group(0))["steps"]
                break
            except (urllib.error.HTTPError, ValueError, AttributeError, KeyError) as e:
                print(m, "failed:", type(e).__name__)
        if steps: break
    if not steps: sys.exit("no model produced valid steps")
    checked = []
    for i, s in enumerate(steps, 1):
        page_words = words(pages[int(s["page"]) - 1])
        w = words(s["text"])
        backed = len(w & page_words) / max(1, len(w))
        checked.append({"n": i, "text": s["text"], "page": int(s["page"]), "backed": round(backed, 2)})
        print(f"{i}. p{s['page']} backed={backed:.2f}  {s['text']}")
    json.dump({"task": task, "source": os.path.basename(txt), "pages": [first, last], "drafted_by": used, "reviewed": False,
               "steps": checked}, open(out, "w"), indent=1)
    print("drafted by", used, "->", out)
