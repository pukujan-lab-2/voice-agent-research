"""Download the IRS corpus for the Brindlewick tax demo into build/irs/raw/ (cached; a file already there is not fetched
again). All of it is U.S. government work in the public domain. Usage: python3 tools/irs_fetch.py
  publications: HTML editions of Pubs 17, 501, 505, 334, 463, 583, 587, 590-A, 590-B, 596, 970, 936, 523, 527, 15,
                and the Form 1040 instructions
  tax topics:   every page linked from irs.gov/taxtopics
  FAQs:         every page under irs.gov/faqs (categories and their sub-pages)
"""
import json, pathlib, re, time, urllib.request

HERE = pathlib.Path(__file__).resolve().parent.parent
RAW = HERE / "build" / "irs" / "raw"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/130 Safari/537.36 (Brindlewick demo corpus)"
# The brief's list first, then more individual and small-business publications and instructions, for a library of
# 10,000+ passages.
PUBS = ["p17", "p501", "p505", "p334", "p463", "p583", "p587", "p590a", "p590b", "p596", "p970", "p936", "p523", "p527", "p15",
        "p15a", "p15b", "p502", "p503", "p504", "p525", "p526", "p529", "p535", "p538", "p544", "p547", "p550", "p551",
        "p554", "p555", "p560", "p575", "p915", "p925", "p929", "p946", "p969", "p974", "p4681", "p5", "p1",
        "p51", "p516", "p519", "p521", "p531", "p536", "p537", "p559", "p561", "p570", "p571", "p590", "p907", "p939", "p976"]
INSTR = ["i1040gi", "i1040sc", "i1040sse", "i1040sca", "i1040sd", "i1040se", "i1040s1", "i1040s2", "i1040s3", "i1040x",
         "i8949", "i8829", "i8962", "i8863", "i8889", "i2441", "i8606", "i4562", "i941", "i940", "iw4", "i1099gi", "i1099mec",
         "i1065", "i1120s", "i7004", "i9465", "i8812", "i5329", "i1040es", "i1040nr", "i8995", "i8615", "i4868"]


def get(path):
    f = RAW / (path.strip("/").replace("/", "__") + ".html")
    if f.exists() and f.stat().st_size > 1000:
        return f.read_text(encoding="utf-8")
    req = urllib.request.Request("https://www.irs.gov" + path, headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            text = urllib.request.urlopen(req, timeout=90).read().decode("utf-8", "replace")
            break
        except Exception as e:  # noqa: BLE001
            print("  retry", path, e); time.sleep(3 * (attempt + 1))
    else:
        return ""
    f.write_text(text, encoding="utf-8")
    time.sleep(0.4)  # be polite to irs.gov
    return text


if __name__ == "__main__":
    RAW.mkdir(parents=True, exist_ok=True)
    manifest = []
    for p in PUBS:
        n = len(get(f"/publications/{p}"))
        if n: manifest.append({"kind": "publication", "path": f"/publications/{p}"})
        print(p, n)
    for i in INSTR:
        n = len(get(f"/instructions/{i}"))
        if n: manifest.append({"kind": "instructions", "path": f"/instructions/{i}"})
        print(i, n)
    topics = sorted(set(re.findall(r'href="(/taxtopics/tc\d+)"', get("/taxtopics"))))
    for t in topics:
        if get(t): manifest.append({"kind": "taxtopic", "path": t})
    print(len(topics), "tax topics")
    seen, todo = set(), ["/faqs"]
    while todo:
        p = todo.pop()
        if p in seen:
            continue
        seen.add(p)
        page = get(p)
        if page and p != "/faqs": manifest.append({"kind": "faq", "path": p})
        todo += [q for q in set(re.findall(r'href="(/faqs/[a-z0-9\-/]+)"', page)) if q not in seen]
    print(len(seen), "FAQ pages")
    (RAW.parent / "sources.json").write_text(json.dumps(manifest, indent=1))
    print(len(manifest), "sources in build/irs/sources.json")
