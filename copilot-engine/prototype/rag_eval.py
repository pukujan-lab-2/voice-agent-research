import json, sys, time
sys.path.insert(0, ".")
import octo_rag as R
Q = [
 ("dmv","How old do I have to be to get a learner's permit?",["15½"]),
 ("dmv","What blood alcohol level counts as DUI for a driver under 21?",["0.01"]),
 ("dmv","How far from a railroad track do I have to stop?",["15 feet"]),
 ("dmv","How many hours of practice driving do teens need?",["50 hours","at least 50"]),
 ("dmv","What should I do when an ambulance with a siren comes up behind me?",["emergency vehicle","siren"]),
 ("medicare","When can I first sign up for Part B?",["7-month"]),
 ("medicare","What happens if I sign up late for Part B?",["10%"]),
 ("medicare","What are the dates of open enrollment?",["October 15"]),
 ("medicare","What is Medigap?",["Medigap"]),
 ("medicare","What number do I call with Medicare questions?",["1-800-633-4227"]),
 ("irs","What's the deadline to file my taxes?",["April 15"]),
 ("irs","How long do I have to claim a refund after filing?",["3 years"]),
 ("irs","What's the standard deduction for a qualifying surviving spouse?",["$31,500"]),
 ("irs","Who qualifies for the earned income credit?",["earned income credit"]),
 ("irs","Do I have to make estimated tax payments?",["estimated tax"]),
]
top1 = top3 = 0
for src, q, kws in Q:
    t = time.time(); r = R.call("POST", "/rag/query", {"workspaceId": R.WS, "query": q, "limit": 3}); ms = int((time.time()-t)*1000)
    ms_ = r.get("matches", [])
    hit = [any(k.lower() in m["content"].lower() for k in kws) for m in ms_]
    top1 += bool(hit[:1] and hit[0]); top3 += any(hit)
    print(("PASS" if any(hit) else "FAIL"), f"rank={hit.index(True)+1 if any(hit) else '-'} {ms:4d}ms [{src}] {q}")
print(f"\ntop-1: {top1}/{len(Q)}   top-3: {top3}/{len(Q)}")
