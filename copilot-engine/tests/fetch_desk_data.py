"""Fetch appointment-domain user turns for the desk simulator into tests/data/ (git-ignored).
  GEM/schema_guided_dialog (CC-BY-SA-4.0), services Services_1..4 (salon, dentist, doctor, therapist):
  real user phrasing when booking an appointment (times, days, vague requests, questions, thanks).
Raw rows are never committed; the simulator only samples a few lines as style examples for the customer model.
Check the dataset card for the current license before redistributing anything."""
import json, os, time, urllib.parse, urllib.request
B = "https://datasets-server.huggingface.co/filter"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(OUT, exist_ok=True)

def rows(service, offset, n=100):
    q = urllib.parse.urlencode({"dataset": "GEM/schema_guided_dialog", "config": "default", "split": "train",
                                "where": f"\"service\"='{service}'", "offset": offset, "length": n})
    req = urllib.request.Request(f"{B}?{q}", headers={"User-Agent": "chatbots-eval/0.1"})
    return [r["row"] for r in json.load(urllib.request.urlopen(req, timeout=60))["rows"]]

out = []
for svc in ["Services_1", "Services_2", "Services_3", "Services_4"]:
    for off in range(0, 800, 100):
        for attempt in range(4):
            try:
                out += [r["prompt"].strip() for r in rows(svc, off)]; break
            except Exception as e:
                print(svc, off, "retry", e); time.sleep(5 * (attempt + 1))
out = list(dict.fromkeys(x for x in out if 6 < len(x) < 180))
json.dump(out, open(os.path.join(OUT, "sgd_appointments.json"), "w"), indent=0)
print("sgd_appointments", len(out), "e.g.", out[:3])
