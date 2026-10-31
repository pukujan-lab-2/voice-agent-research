"""The printed PDF of every publication and instruction in the corpus, and the page each of its passages is on.

Downloads https://www.irs.gov/pub/irs-pdf/<name>.pdf (public domain) into build/irs/pdf (resumable, one request a
second), reads each page's text, and finds every passage of that document in it: its words, letters and digits only,
compared exactly (spacing, hyphenation at line ends and punctuation aside). A passage found nowhere gets no page; it is
never guessed. Writes build/irs/pages.json: {doc: {"pages": n, "file": "p17.pdf", "found": k, "of": m, "page": {passage id: page}}}.

Run: build/.venv/bin/python tools/irs_pdf.py
"""
import json
import re
import sys
import time
import unicodedata
import urllib.request
from pathlib import Path

from pypdf import PdfReader

here = Path(__file__).resolve().parent.parent
out = here / 'build/irs/pdf'
out.mkdir(parents=True, exist_ok=True)
UA = 'Mozilla/5.0 (Brindlewick demo corpus; contact: example.com)'


def norm(s: str) -> str:
    # Letters and digits only, lowercased: the PDF's line-end hyphens, ligatures, curly quotes and spacing drop out.
    s = unicodedata.normalize('NFKC', s).lower()
    return re.sub(r'[^a-z0-9]+', '', s)


def fetch(name: str) -> Path | None:
    f = out / f'{name}.pdf'
    if f.exists() and f.stat().st_size > 1000:
        return f
    url = f'https://www.irs.gov/pub/irs-pdf/{name}.pdf'
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
            data = r.read()
    except Exception as e:  # noqa: BLE001
        print(f'  {name}: {e}', file=sys.stderr)
        return None
    if not data.startswith(b'%PDF'):
        print(f'  {name}: not a PDF', file=sys.stderr)
        return None
    f.write_bytes(data)
    time.sleep(1)
    return f


def main():
    passages = json.load(open(here / 'data/irs.passages.json'))['passages']
    by_doc: dict[str, list[dict]] = {}
    for p in passages:
        by_doc.setdefault(p['id'].split(' #')[0].removeprefix('irs/'), []).append(p)
    sources = json.load(open(here / 'build/irs/sources.json'))
    result = {}
    for s in sources:
        if s['kind'] not in ('publication', 'instructions'):
            continue
        name = s['path'].rsplit('/', 1)[1]
        doc = s['path'].strip('/').replace('/', '-')
        f = fetch(name)
        if not f:
            continue
        reader = PdfReader(str(f))
        texts = [norm(pg.extract_text() or '') for pg in reader.pages]
        flat = ''.join(texts)
        starts, at = [], 0
        for t in texts:
            starts.append(at)
            at += len(t)

        def page_of(i: int) -> int:
            lo, hi = 0, len(starts) - 1
            while lo < hi:
                mid = (lo + hi + 1) // 2
                if starts[mid] <= i:
                    lo = mid
                else:
                    hi = mid - 1
            return lo + 1

        pages, found = {}, 0
        for p in by_doc.get(doc, []):
            n = norm(p['text'])
            # The first words of the passage (its first sentence when it is short): enough to be unique, short enough
            # that a table cell order or a page break inside the passage doesn't hide it.
            for probe in (n[:80], n[len(n) // 2:len(n) // 2 + 60]):
                if len(probe) >= 24 and (i := flat.find(probe)) >= 0:
                    pages[p['id']] = page_of(i)
                    found += 1
                    break
        result[doc] = {'file': f.name, 'pages': len(texts), 'found': found, 'of': len(by_doc.get(doc, [])), 'page': pages}
        print(f'{doc}: {len(texts)} pages, {found}/{len(by_doc.get(doc, []))} passages placed', flush=True)
    json.dump(result, open(here / 'build/irs/pages.json', 'w'))
    tot = sum(r['of'] for r in result.values())
    print(f'{len(result)} PDFs, {sum(r["found"] for r in result.values())}/{tot} passages placed on a page')


if __name__ == '__main__':
    main()
