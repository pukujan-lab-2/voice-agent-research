"""A synthetic business site of any size, with questions whose one right passage is known.

Every passage is about one (product family, feature, region, accessory) combination, and no two passages share a
combination, so a question that names those four things has exactly one right passage while thousands of others share
one or two of its words. Passages also carry a language, a page type and a section, so filters can be scored.
Deterministic for a given (n, seed). Embeddings are feature-hashed bags of words (not a language model): this measures
whether the index and its filters can find a planted passage among many look-alikes, not how good an embedding model is.
"""
from __future__ import annotations

import random
import zlib
from dataclasses import dataclass

DIM = 512
LANGS = [("en", 0.8), ("es", 0.2)]
PAGE_TYPES = ["product", "faq", "policy", "docs", "blog", "pricing"]
FEATURES = ["battery life", "water resistance", "warranty term", "firmware update", "charging time", "noise level", "weight limit", "operating temperature",
            "service interval", "filter lifetime", "paint finish", "cable length", "storage capacity", "power draw", "screen brightness", "mounting height",
            "refund window", "delivery time", "repair turnaround", "spare part supply", "installation time", "calibration cycle", "cleaning schedule", "seal rating",
            "load rating", "pairing range", "dimming range", "airflow", "pressure limit", "flow rate", "boot time", "latency", "resolution", "frame rate",
            "fan speed", "cooling time", "drying time", "cure time", "shelf life", "return fee"]
REGIONS = ["Alberta", "Bavaria", "Catalonia", "Dalarna", "Emilia", "Flanders", "Galicia", "Hokkaido", "Ishikawa", "Jutland", "Kerala", "Lombardy", "Murcia", "Navarra",
           "Ontario", "Piedmont", "Quebec", "Rhone", "Saxony", "Tuscany", "Umbria", "Valencia", "Wallonia", "Yucatan", "Zeeland", "Aragon", "Brittany", "Cornwall",
           "Dorset", "Essex"]
ACCESSORIES = ["bracket", "adapter", "charger", "case", "stand", "dock", "cover", "strap", "filter", "gasket", "hinge", "lens", "valve", "rail", "clip", "hub",
               "cradle", "sleeve", "shield", "tray", "knob", "pad", "plug", "mount", "frame", "lid", "cap", "ring", "spacer", "cable"]
SYL = ["ba", "do", "ki", "lu", "me", "no", "pa", "ri", "su", "ta", "ve", "zo", "an", "el", "or", "un"]
UNITS = ["hours", "days", "months", "minutes", "kilograms", "degrees", "metres", "litres"]
SECTION_WORDS = [f"{a} {b}" for a in ("Overview", "Specifications", "Care", "Setup", "Troubleshooting", "Limits", "Coverage", "Ordering", "Safety", "Notes")
                 for b in ("basics", "details", "for owners", "for dealers", "FAQ", "summary")]


def family(i: int) -> str:
    return "".join(SYL[(i >> s) & 15] for s in (0, 4, 8)).capitalize() + str(i % 7 + 1)


@dataclass
class Passage:
    n: int
    id: str          # also the Octo document title: <business>/<language>/<page type>/<n>
    business: str
    language: str
    page_type: str
    section: str
    text: str
    family: str
    feature: str
    region: str
    accessory: str


def passages(n: int, business: str = "bigsite", seed: int = 7) -> list[Passage]:
    rng = random.Random(seed)
    n_fam = max(50, n // 80)
    combos: set[tuple[int, int, int, int]] = set()
    while len(combos) < n:
        combos.add((rng.randrange(n_fam), rng.randrange(len(FEATURES)), rng.randrange(len(REGIONS)), rng.randrange(len(ACCESSORIES))))
    out = []
    for i, (f, ft, rg, ac) in enumerate(sorted(combos, key=lambda c: rng.random())):
        lang = "en" if rng.random() < LANGS[0][1] else "es"
        ptype = PAGE_TYPES[rng.randrange(len(PAGE_TYPES))]
        k = rng.randrange(max(1, n // 100))      # about 100 passages under each heading, like a site with many pages
        sec = f"{SECTION_WORDS[k % len(SECTION_WORDS)]} {k}"
        fam, feat, reg, acc = family(f) + f"x{f}", FEATURES[ft], REGIONS[rg], ACCESSORIES[ac]
        val = rng.randrange(2, 900)
        unit = UNITS[rng.randrange(len(UNITS))]
        if lang == "en":
            text = f"For the {fam} sold in {reg}, the {feat} is {val} {unit} when it is used with the {acc}. This figure is set by the maker and applies to every unit of the {fam} shipped to {reg}."
        else:
            text = f"Para el {fam} vendido en {reg}, el valor de {feat} es {val} {unit} cuando se usa con el {acc}. Esta cifra la fija el fabricante y vale para cada unidad del {fam} enviada a {reg}."
        out.append(Passage(i, f"{business}/{lang}/{ptype}/{i:07d}", business, lang, ptype, sec, text, fam, feat, reg, acc))
    return out


def question(p: Passage, rng: random.Random) -> str:
    """A casual question that names the combination without copying the passage's sentence."""
    if p.language == "en":
        forms = [f"how long is the {p.feature} for the {p.family} in {p.region} with the {p.accessory}",
                 f"what is the {p.feature} of the {p.family} sold in {p.region} if I use the {p.accessory}",
                 f"{p.region} {p.family} {p.accessory}: {p.feature}?"]
    else:
        forms = [f"cual es el valor de {p.feature} del {p.family} en {p.region} con el {p.accessory}",
                 f"{p.feature} del {p.family} vendido en {p.region} usando el {p.accessory}"]
    return forms[rng.randrange(len(forms))]


def tokens(text: str) -> list[str]:
    out, cur = [], []
    for ch in text.lower():
        if ch.isalnum():
            cur.append(ch)
        elif cur:
            out.append("".join(cur)); cur = []
    if cur:
        out.append("".join(cur))
    return out


STOP = set("the a an of for in is to with and when it by this that every unit set figure used use if what how long sold does el la de del en con para cuando se esta cifra y vale cada unidad la que fija fabricante enviada valor es vendido usando cual".split())


def embed(text: str) -> list[tuple[int, float]]:
    """Feature-hashed bag of words, L2-normalised: a sparse (index, value) list over DIM buckets."""
    acc: dict[int, float] = {}
    for t in tokens(text):
        if t in STOP:
            continue
        h = zlib.crc32(t.encode())
        idx, sign = h % DIM, 1.0 if (h >> 9) & 1 else -1.0
        acc[idx] = acc.get(idx, 0.0) + sign
    norm = sum(v * v for v in acc.values()) ** 0.5 or 1.0
    return [(i, v / norm) for i, v in sorted(acc.items())]


def vector_literal(sparse: list[tuple[int, float]]) -> str:
    d = dict(sparse)
    return "[" + ",".join(f"{d[i]:.4f}" if i in d else "0" for i in range(DIM)) + "]"
