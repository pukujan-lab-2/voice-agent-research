"""Name matching for caller verification: is the name a caller said the same person's name as a client's on file?
Fuzzy and sound-alike, with RapidFuzz (MIT) and jellyfish (MIT), so a misheard or misspelled name still matches
("Jon Smyth" / "John Smith", "Katherine" / "Catherine") while a different person with the same surname does not
("Maria Okafor" / "David Okafor"). Only names are compared here; the date of birth, last four and zip are compared
exactly by the database, before any name reaches this.

A long-lived helper: the server writes one JSON line {"id", "said", "names": [..]} to stdin and reads one line back,
{"id", "match": [true|false, ...], "score": [..]}. Nothing is logged.
Run by api's server: uv run --quiet --python 3.12 --with rapidfuzz==3.10.1 --with jellyfish==1.1.3 python tools/verify_match.py
"""
import json, re, sys, unicodedata

import jellyfish
from rapidfuzz import fuzz

SUFFIX = re.compile(r"\b(jr|sr|ii|iii|iv|mr|mrs|ms|miss|dr)\b")


def norm(name):
    t = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    t = re.sub(r"[^a-z\s'-]", " ", t).replace("'", "").replace("-", " ")
    t = SUFFIX.sub(" ", t)
    words = [w for w in t.split() if len(w) > 1]  # a middle initial is dropped
    return words


def sounds(a, b):
    return jellyfish.metaphone(a) == jellyfish.metaphone(b) or jellyfish.nysiis(a) == jellyfish.nysiis(b)


def part_ok(a, b, jw):
    return a == b or jellyfish.jaro_winkler_similarity(a, b) >= jw or sounds(a, b)


def same_person(said, on_file):
    a, b = norm(said), norm(on_file)
    if len(a) < 2 or len(b) < 2:
        return False, 0.0
    whole = fuzz.token_sort_ratio(" ".join(a), " ".join(b))
    # first and last name each have to be close in spelling or sound; a middle name may be said or left out
    first = part_ok(a[0], b[0], 0.9)
    last = part_ok(a[-1], b[-1], 0.88) or part_ok("".join(a[1:]), "".join(b[1:]), 0.9)
    return (first and last) or whole >= 94, round(whole, 1)


def main():
    for line in sys.stdin:
        try:
            req = json.loads(line)
            res = [same_person(str(req.get("said", "")), str(n)) for n in req.get("names", [])[:50]]
            out = {"id": req.get("id"), "match": [m for m, _ in res], "score": [s for _, s in res]}
        except Exception as e:  # a bad line never stops the helper
            out = {"id": None, "error": type(e).__name__}
        sys.stdout.write(json.dumps(out) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
