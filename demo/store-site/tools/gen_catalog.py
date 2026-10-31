"""Generate Brambleway's catalogue: products, variants (colour, size, storage...), stock, prices and deals, plus
fictional reviews and Q&A. Deterministic (fixed seed), so a re-run gives the same ids and the same text.

Everything is made up here; nothing is copied from a real store (see DATA_LICENSE.md). Review and Q&A text is built
from each product's own specs, so an answer the copilot reads out matches the product page.

Usage: python3 tools/gen_catalog.py [--per 200]   -> build/catalog/{products,variants,reviews,questions}.jsonl
"""
import json, math, pathlib, random, re, sys
from datetime import date, timedelta

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from taxonomy import (ADJ, APPAREL_SIZES, BED_SIZES, BOOK_NOUNS, BOOK_WORDS, BRAND_A, BRAND_B, COLORS, DEPARTMENTS, FAMILY, FORMATS, GIVEN,  # noqa: E402
                      KIDS_SHOE_SIZES, KINDS, LINES, PET_SIZES, REAL, SCREEN_SIZES, SHADES, SHOE_SIZES, STORAGE)

OUT = pathlib.Path(__file__).resolve().parent.parent / "build" / "catalog"
R = random.Random(20261031)
TODAY = date(2026, 10, 31)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def fmt_num(x, step):
    if isinstance(step, float) or (isinstance(x, float) and not x.is_integer()):
        return f"{x:.1f}".rstrip("0").rstrip(".") if step < 1 else f"{x:.0f}"
    return f"{int(x):,}" if x >= 10000 else str(int(x))


def spec_value(name, choice, r):
    if isinstance(choice, tuple):
        lo, hi, step, unit = choice
        n = round((hi - lo) / step)
        x = lo + step * r.randint(0, n)
        x = round(x, 1) if isinstance(step, float) else x
        v = fmt_num(x, step)
        return (f"{v} {unit}".strip() if unit not in ("°C", "m²") else f"{v} {unit}"), x
    return r.choice(choice), None


def brands_for(dept, n, used):
    out = []
    while len(out) < n:
        b = R.choice(BRAND_A) + R.choice(BRAND_B)
        if b.lower() in REAL or b in used:
            continue
        used.add(b)
        out.append(b)
    return out


FIRST = ["Sam", "Priya", "Jonah", "Maren", "Luis", "Aiko", "Dev", "Noor", "Tomas", "Kit", "Remy", "Hana", "Ola", "Bea", "Femi", "Ines", "Cal",
         "Rosa", "Theo", "Uma", "Wes", "Zoe", "Arlo", "Mina", "Nate", "Pia", "Ravi", "Sol", "Tess", "Vic"]
PLACES = ["Portland", "Austin", "Leeds", "Halifax", "Denver", "Dunedin", "Tucson", "Galway", "Duluth", "Asheville", "Boise", "Calgary"]
GOOD = ["Does exactly what I needed.", "Great value for the price.", "Well made and feels sturdy.", "Exceeded my expectations.",
        "Would buy again.", "Bought it as a gift and they loved it.", "Arrived quickly and well packed.", "Solid quality, no complaints."]
MEH = ["It's fine, nothing special.", "Good, but not great.", "Does the job, though the finish could be better.", "Decent for the price."]
BAD = ["Not what I expected.", "Quality felt cheaper than the photos.", "Returned it; it didn't suit me.", "Stopped working after a few weeks."]
TITLES = {5: ["Love it", "Excellent", "Five stars from me", "Exactly right", "Really happy"], 4: ["Very good", "Happy with it", "Nice, small gripes"],
          3: ["It's okay", "Mixed feelings", "Average"], 2: ["Disappointed", "Not great"], 1: ["Would not recommend", "Poor"]}
SIZE_NOTES = {"runs small": "Runs a little small; I'd size up.", "true": "Fits true to size.", "runs large": "Runs a bit large; consider sizing down."}


def spec_comment(name, value, stars, r):
    pos = stars >= 4
    if name in ("Weight", "Weight per shoe", "Packed weight"):
        return f"At {value} it's {'light enough to forget about' if pos else 'heavier than I hoped'}."
    if name in ("Battery life", "Battery"):
        return f"Battery ({value}) {'easily lasts my week' if pos else 'runs down faster than the listing suggests'}."
    if name in ("Capacity", "Volume"):
        return f"The {value} capacity is {'plenty for a full day' if pos else 'smaller than I needed'}."
    if name in ("Waterproof", "Water resistance", "Waterproof rating"):
        return f"Water resistance ({value}) {'held up in a proper downpour' if pos else 'was not enough for heavy rain'}."
    if name == "Material":
        return f"The {value} feels {'premium' if pos else 'a bit thin'}."
    if name == "Noise cancelling":
        return f"{value.capitalize()} noise cancelling {'blocks out the train commute' if pos else 'is only so-so'}."
    return f"{name}: {value}, {'just as described' if pos else 'not quite what I wanted'}."


def main():
    per = int(sys.argv[sys.argv.index("--per") + 1]) if "--per" in sys.argv else 200
    OUT.mkdir(parents=True, exist_ok=True)
    fp, fv, fr, fq = (open(OUT / f"{n}.jsonl", "w") for n in ("products", "variants", "reviews", "questions"))
    depts, used_brands = [], set()
    pid, rid, qid = 100000, 0, 0
    nv = 0
    for dept, cats in DEPARTMENTS.items():
        dept_brands = brands_for(dept, 14, used_brands)
        dcats = []
        for (cat, kind, nouns, (plo, phi), interests, audience) in cats:
            K = KINDS[kind]
            cat_brands = R.sample(dept_brands, 7)
            n = per + R.randint(-25, 35)
            dcats.append({"name": cat, "slug": slug(cat), "kind": kind, "count": n})
            for _ in range(n):
                pid += 1
                r = random.Random(pid)
                brand = r.choice(cat_brands)
                noun = r.choice(nouns)
                specs, nums = [], {}
                for (sname, choice) in K["specs"]:
                    if kind == "book" and sname == "Genre":
                        v = cat.replace(" Books", "")
                    elif kind == "book" and sname == "Author":
                        v = f"{r.choice(GIVEN)} {r.choice(FAMILY)}"
                    else:
                        v, x = spec_value(sname, choice, r)
                        if x is not None:
                            nums[sname] = x
                    specs.append({"name": sname, "value": v})
                if kind == "book":
                    title = f"The {r.choice(BOOK_WORDS)} {r.choice(BOOK_NOUNS)}"
                    if r.random() < 0.3:
                        title += f": A {noun}"
                    brand = next(s["value"] for s in specs if s["name"] == "Publisher")
                    author = next(s["value"] for s in specs if s["name"] == "Author")
                    full = f"{title} by {author}"
                else:
                    line = r.choice(LINES)
                    adj = r.choice(ADJ)
                    key = specs[0]["value"] if K["specs"][0][1] and isinstance(K["specs"][0][1], tuple) and r.random() < 0.6 else ""
                    key = key.replace(" ", "") if re.fullmatch(r"[\d.,]+ (L|ml|in|cm|W|mm)", key or "") else ""
                    full = " ".join(w for w in [brand, line, key, adj, noun] if w)
                    title = full
                # price: log-uniform in the category's range, rounded like a shop would
                base = math.exp(r.uniform(math.log(plo), math.log(phi)))
                base = round(base) - 0.01 if base > 20 else round(base * 2) / 2 - 0.01
                quality = min(4.95, max(2.6, r.gauss(4.25, 0.45)))
                # variants
                mode = K["variants"]
                colors = r.sample(list(COLORS), r.randint(1, 5)) if mode not in ("none", "format", "shade") or True else []
                if mode in ("none",) or kind == "book":
                    colors = colors[:1]
                axis2 = {"color+apparel": APPAREL_SIZES, "color+shoe": KIDS_SHOE_SIZES if audience == "kids" else SHOE_SIZES, "color+bed": BED_SIZES,
                         "color+storage": STORAGE[:r.randint(2, 4)], "size": SCREEN_SIZES[r.randint(0, 2):r.randint(3, 6)], "color+pet": PET_SIZES,
                         "format": FORMATS[:r.randint(1, 3)], "shade": SHADES}.get(mode)
                if mode == "size":
                    colors = colors[:1]
                variants = []
                fit = r.choice(["runs small", "true", "true", "true", "runs large"]) if mode in ("color+apparel", "color+shoe") else None
                for ci, c in enumerate(colors):
                    for si, s in enumerate(axis2 or [None]):
                        price = base
                        if mode == "color+storage":
                            price = round(base * (1 + 0.18 * si)) - 0.01
                        elif mode == "size":
                            price = round(base * (1 + 0.35 * si)) - 0.01
                        elif mode == "color+bed":
                            price = round(base * (1 + 0.15 * si)) - 0.01
                        elif mode == "format":
                            price = round(base * [1, 1.6, 1.9][si]) - 0.01
                        elif s == "XXL":
                            price = round(base * 1.06) - 0.01
                        stock = 0 if r.random() < 0.08 else int(r.expovariate(1 / 40)) + 1
                        variants.append({"sku": f"BW{pid}-{len(variants) + 1:02d}", "product_id": f"BW{pid}", "color": c if mode not in ("size", "format", "shade") or c else None,
                                         "size": s, "price": round(price, 2), "stock": stock})
                if r.random() < 0.03:
                    for v in variants:
                        v["stock"] = 0
                prices = [v["price"] for v in variants]
                in_stock = any(v["stock"] > 0 for v in variants)
                deal = r.random() < 0.15
                list_price = round(min(prices) * r.uniform(1.15, 1.55), 2) if deal else None
                list_price = (math.ceil(list_price) - 0.01) if list_price else None
                deal_ends = (TODAY + timedelta(days=r.randint(0, 9))).isoformat() if deal else None
                # reviews: count from a heavy-tailed draw, stars around the product's quality
                nrev = min(60, int(r.paretovariate(1.4)) - 1 + (r.random() < 0.85) * r.randint(0, 9))
                stars_all = []
                for k in range(nrev):
                    rid += 1
                    st = int(min(5, max(1, round(r.gauss(quality, 0.9)))))
                    stars_all.append(st)
                    sv = r.sample(specs, min(2, len(specs)))
                    body = [r.choice(GOOD if st >= 4 else MEH if st == 3 else BAD)]
                    body += [spec_comment(s["name"], s["value"], st, r) for s in sv if r.random() < 0.8]
                    if fit and r.random() < 0.7:
                        body.append(SIZE_NOTES[fit])
                    if r.random() < 0.25 and interests:
                        body.append(f"Used it for {r.choice(interests)} {r.choice(['most weekends', 'on a trip', 'daily', 'a few times now'])}.")
                    who = f"{r.choice(FIRST)} {chr(65 + r.randint(0, 25))}."
                    when = (TODAY - timedelta(days=r.randint(1, 900))).isoformat()
                    vv = r.choice(variants)
                    fr.write(json.dumps({"id": rid, "product_id": f"BW{pid}", "stars": st, "title": r.choice(TITLES[st]), "body": " ".join(body),
                                         "author": who, "location": r.choice(PLACES), "date": when, "helpful": int(r.expovariate(1 / 4)),
                                         "variant": " / ".join(x for x in [vv["color"], vv["size"]] if x)}) + "\n")
                rating = round(sum(stars_all) / len(stars_all), 1) if stars_all else None
                # Q&A from the product's own specs, so the answer is the same as the page's spec table
                qs = []
                for s in r.sample(specs, min(len(specs), r.choice([0, 1, 1, 2, 2, 3, 4]))):
                    qid += 1
                    q = {"Weight": "How much does it weigh?", "Capacity": "What's the capacity?", "Battery life": "How long does the battery last?",
                         "Waterproof": "Is it waterproof?", "Water resistance": "How water resistant is it?", "Material": "What is it made of?",
                         "Laptop sleeve": "Will a laptop fit?", "Dishwasher safe": "Can it go in the dishwasher?", "Age": "What age is it for?",
                         "Pages": "How many pages is it?", "Sleeps": "How many people does it sleep?", "Noise cancelling": "Does it have noise cancelling?",
                         "Assembly": "Does it need assembly?", "Warranty": "What's the warranty?"}.get(s["name"], f"What's the {s['name'].lower()}?")
                    a = f"{s['name']}: {s['value']}." + (" It's listed in the specs too." if r.random() < 0.3 else "")
                    who = r.choice(["Brambleway team", "Brambleway team", f"{r.choice(FIRST)} (customer)"])
                    qs.append({"id": qid, "product_id": f"BW{pid}", "question": q, "answer": a, "answered_by": who, "votes": int(r.expovariate(1 / 6)),
                               "date": (TODAY - timedelta(days=r.randint(1, 700))).isoformat()})
                for q in qs:
                    fq.write(json.dumps(q) + "\n")
                tags = sorted(set(interests + [audience] + (["gift"] if min(prices) < 200 and kind not in ("appliance", "screen", "furniture", "baby") else [])))
                about = {"men": "men", "women": "women", "kids": "kids", "baby": "babies and parents", "home": "the home", "unisex": "anyone"}[audience]
                desc = (f"The {title} is a {(r.choice(['well-made', 'thoughtfully designed', 'dependable', 'good-looking']))} {noun.lower()} for {about}"
                        f"{', made for ' + ', '.join(interests[:2]) if interests else ''}. "
                        + " ".join(f"{s['name']}: {s['value']}." for s in specs[:3])
                        + " A fictional Brambleway demo product: nothing is sold or shipped.")
                bullets = [f"{s['name']}: {s['value']}" for s in specs[:5]]
                if fit:
                    bullets.append({"runs small": "Fit: runs small, consider sizing up", "true": "Fit: true to size", "runs large": "Fit: runs large"}[fit])
                    specs.append({"name": "Fit guide", "value": {"runs small": "runs small", "true": "true to size", "runs large": "runs large"}[fit]})
                shape_style = r.randint(0, 2)
                prod = {"id": f"BW{pid}", "slug": slug(full)[:80], "title": full, "brand": brand, "dept": dept, "dept_slug": slug(dept), "category": cat,
                        "cat_slug": slug(cat), "kind": kind, "noun": noun, "audience": audience, "tags": tags, "price": min(prices), "max_price": max(prices),
                        "list_price": list_price, "deal_ends": deal_ends, "rating": rating, "review_count": nrev, "in_stock": in_stock,
                        "colors": sorted({v["color"] for v in variants if v["color"]}), "sizes": [s for s in (axis2 or [])],
                        "description": desc, "bullets": bullets, "specs": specs, "shape": K["shape"], "style": shape_style,
                        "popularity": int(nrev * 13 + r.randint(0, 200) + (60 if deal else 0)), "created": (TODAY - timedelta(days=r.randint(0, 1400))).isoformat(),
                        "question_count": len(qs)}
                fp.write(json.dumps(prod) + "\n")
                for v in variants:
                    fv.write(json.dumps(v) + "\n")
                    nv += 1
        depts.append({"name": dept, "slug": slug(dept), "categories": dcats})
    json.dump(depts, open(OUT / "departments.json", "w"), indent=1)
    for f in (fp, fv, fr, fq):
        f.close()
    print(f"{pid - 100000} products, {nv} variants, {rid} reviews, {qid} questions, {sum(len(d['categories']) for d in depts)} categories in {len(depts)} departments")


if __name__ == "__main__":
    main()
