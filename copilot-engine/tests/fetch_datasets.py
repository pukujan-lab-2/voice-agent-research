"""Fetch realistic utterances from public Hugging Face datasets into tests/data/ (git-ignored).
  PolyAI/banking77            real customer-service questions (CC-BY-4.0): used as off-scope requests
  PolyAI/minds14 (en-US)      spoken customer queries, transcribed (CC-BY-4.0): off-scope with spoken style
  GEM/schema_guided_dialog    user turns from task-oriented dialogues (CC-BY-SA-4.0): realistic phrasing for times and requests
Check each dataset card for the current license before redistributing anything."""
import json, os, random, urllib.request
B = "https://datasets-server.huggingface.co"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(OUT, exist_ok=True)

def rows(ds, config, split, offset, n=100):
    u = f"{B}/rows?dataset={ds}&config={config}&split={split}&offset={offset}&length={n}"
    return [r["row"] for r in json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "chatbots-eval/0.1"}), timeout=60))["rows"]]

def collect(ds, config, split, field, total, span, seed):
    rnd = random.Random(seed); out = []
    for off in sorted(rnd.sample(range(0, span, 100), total // 100)):
        out += [r[field].strip() for r in rows(ds, config, split, off)]
    return list(dict.fromkeys(x for x in out if 8 < len(x) < 160))

data = {
    "banking77": collect("PolyAI/banking77", "default", "train", "text", 800, 9900, 1),
    "minds14_en": collect("PolyAI/minds14", "en-US", "train", "english_transcription", 500, 500, 2) if False else [],
    "sgd_user": collect("GEM/schema_guided_dialog", "default", "train", "prompt", 800, 164000, 3),
}
# minds14 en-US has ~600 rows, so read it from the start rather than sampling offsets
data["minds14_en"] = list(dict.fromkeys(r["english_transcription"].strip() for off in range(0, 600, 100) for r in rows("PolyAI/minds14", "en-US", "train", off)))
for k, v in data.items():
    json.dump(v, open(os.path.join(OUT, k + ".json"), "w"), indent=0)
    print(k, len(v), "e.g.", v[:2])
