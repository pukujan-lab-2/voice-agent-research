import pytest
from conftest import PARA
from site_ingest.models import business_slug
from site_ingest.pipeline import Config, run
from site_ingest.sources import HttpFetcher, Source, doc_sources, normalize, web_sources
from site_ingest.store import SiteStore
from site_server import page


def load(site, octo, business="acme", **kw):
    cfg = Config(business, workers=2, **kw)
    srcs = web_sources(HttpFetcher(), site.base + "/sitemap.xml", None, 100, 2, [], [])
    return run(cfg, SiteStore(octo, business, 2), srcs)


def rows(octo, business="acme"):
    return octo.sql("select * from site_passages where business = $1 order by url, seq", [business])["rows"]


def test_first_load_puts_every_passage_in_the_business_prefix_with_metadata(site, octo):
    rep = load(site, octo)
    assert (rep.discovered, rep.new, rep.failed) == (4, 4, 0)
    rs = rows(octo)
    assert rep.indexed_passages == len(rs) == len(octo.docs) > 4
    assert rep.indexed_pages == 4
    for r in rs:
        assert r["id"].startswith(f"acme/{r['language']}/{r['page_type']}/")
        assert all(r[k] for k in ("url", "title", "page_type", "language", "last_modified", "text", "doc_id"))
    by_url = {r["url"].removeprefix(site.base): r for r in rs}
    assert by_url["/returns"]["page_type"] == "policy" and by_url["/faq"]["page_type"] == "faq"
    assert by_url["/fr/retours"]["language"] == "fr" and by_url["/returns"]["language"] == "en"
    assert {r["section"] for r in rs if r["url"].endswith("/faq")} == {"Do you gift wrap?", "Can I change my address?"}
    assert all(t.startswith("acme/") for t in octo.titles())
    assert "All rights reserved" not in " ".join(r["text"] for r in rs)


def test_rerun_with_nothing_changed_writes_nothing(site, octo):
    load(site, octo)
    puts, deletes, writes = octo.puts, octo.deletes, octo.writes
    site.hits.clear()
    rep = load(site, octo)
    assert (rep.unchanged, rep.new, rep.changed, rep.deleted, rep.passages_added) == (4, 0, 0, 0, 0)
    assert (octo.puts, octo.deletes, octo.writes) == (puts, deletes, writes)
    assert {s for _, s in site.hits if _ != "/sitemap.xml"} == {304}     # the site said "not modified"; nothing was re-read


def test_a_changed_page_replaces_only_the_passages_that_changed(site, octo):
    load(site, octo)
    before = {r["id"]: r["doc_id"] for r in rows(octo)}
    ship = [r for r in rows(octo) if r["url"].endswith("/shipping")]
    site.put("/shipping", page("Shipping", f"<p>{PARA}</p><h2>International</h2><p>International orders now take seven to ten business days. Duties are included in the price at checkout.</p>"))
    rep = load(site, octo)
    assert (rep.changed, rep.new, rep.unchanged) == (1, 0, 3)
    after = {r["id"]: r["doc_id"] for r in rows(octo)}
    untouched = [r["id"] for r in ship if "International" not in r["section"]]
    assert untouched and all(after[i] == before[i] for i in untouched)           # same search document, not re-embedded
    assert rep.passages_added == 1 and rep.passages_removed == 1
    texts = " ".join(t for _, t in octo.docs.values())
    assert "seven to ten business days" in texts and "ten to fourteen business days" not in texts
    assert len(rows(octo)) == len(octo.docs)


def test_a_page_removed_from_the_site_is_removed_from_search(site, octo):
    load(site, octo)
    faq_docs = [r["doc_id"] for r in rows(octo) if r["url"].endswith("/faq")]
    assert faq_docs
    del site.pages["/faq"]
    rep = load(site, octo)
    assert rep.deleted == 1 and rep.passages_removed == len(faq_docs)
    assert not any(d in octo.docs for d in faq_docs)
    assert not any(r["url"].endswith("/faq") for r in rows(octo))
    assert rep.indexed_pages == 3


def test_a_listed_page_that_now_404s_is_removed(site, octo):
    load(site, octo)
    cfg = Config("acme", workers=2)
    f = HttpFetcher()
    srcs = [Source(site.base + "/gone", lambda prev: f.get(site.base + "/gone", prev))] + web_sources(f, site.base + "/sitemap.xml", None, 100, 2, [], [])
    rep = run(cfg, SiteStore(octo, "acme", 2), srcs)
    assert rep.deleted == 0 and rep.skipped == 1           # never known, so nothing to delete
    st = SiteStore(octo, "acme", 2)
    st.save_page(__import__("site_ingest.models", fromlist=["PageRow"]).PageRow(site.base + "/gone", "h"))
    rep = run(cfg, st, srcs)
    assert rep.deleted == 1


def test_the_same_page_at_two_addresses_is_indexed_once(site, octo):
    body = site.pages["/returns"][0].decode()
    site.put("/returns-copy", body)
    rep = load(site, octo)
    assert rep.duplicate_pages == 1
    urls = {r["url"] for r in rows(octo)}
    assert len(urls) == 4 and sum(u.endswith(("/returns", "/returns-copy")) for u in urls) == 1
    texts = [r["text"] for r in rows(octo)]
    assert len(texts) == len(set(texts))
    assert normalize("HTTP://Acme.com:80/Shop/?utm_source=x&b=2&a=1#top") == "http://acme.com/Shop?a=1&b=2"


def test_a_passage_repeated_on_two_pages_is_indexed_once(site, octo):
    hours = "We are open from nine in the morning until six in the evening on weekdays, and from ten until four on Saturdays."
    site.put("/about", page("About us", f"<h2>Opening hours</h2><p>{hours}</p>"))
    site.put("/contact", page("Contact", f"<h2>Opening hours</h2><p>{hours}</p><h2>Phone</h2><p>Call our team on 555 0100 any time during opening hours.</p>"))
    rep = load(site, octo)
    assert rep.passages_duplicate == 1
    assert sum(hours in r["text"] for r in rows(octo)) == 1


def test_businesses_never_share_a_prefix_or_rows(site, octo):
    load(site, octo, "acme")
    load(site, octo, "globex")
    assert len(rows(octo, "acme")) == len(rows(octo, "globex"))
    assert {t.split("/")[0] for t in octo.titles()} == {"acme", "globex"}
    assert not set(r["id"] for r in rows(octo, "acme")) & set(r["id"] for r in rows(octo, "globex"))
    del site.pages["/faq"]
    load(site, octo, "acme")
    assert not any("/faq" in r["url"] for r in rows(octo, "acme")) and any("/faq" in r["url"] for r in rows(octo, "globex"))
    for bad in ("irs", "A", "x", "has space", "a/b", "zz-scratch"):
        with pytest.raises(ValueError):
            business_slug(bad)


def test_losing_most_of_the_site_is_not_trusted_as_a_delete(site, octo):
    load(site, octo)
    n = len(rows(octo))
    for p in ("/faq", "/shipping", "/fr/retours"):
        del site.pages[p]
    rep = load(site, octo)
    assert rep.deleted == 0 and rep.deletes_blocked == 3 and "not deleted" in " ".join(rep.errors)
    assert len(rows(octo)) == n
    rep = load(site, octo, allow_mass_delete=True)
    assert rep.deleted == 3


def test_an_empty_listing_deletes_nothing(site, octo):
    load(site, octo)
    n = len(rows(octo))
    rep = run(Config("acme"), SiteStore(octo, "acme"), [])
    assert rep.deleted == 0 and len(rows(octo)) == n


def test_start_url_crawl_follows_links_and_obeys_robots(site, octo):
    site.put("/", page("Home", "<p>Welcome to Acme, where every order ships quickly.</p><a href='/returns'>Returns</a> <a href='/private/secret'>Secret</a> <a href='/img.png'>x</a> <a href='https://elsewhere.test/x'>out</a>"))
    site.put("/private/secret", page("Secret", f"<p>{PARA} This page must never be read by the crawler because robots.txt forbids it.</p>"))
    site.sitemap = False
    cfg = Config("acme", workers=2)
    srcs = web_sources(HttpFetcher(), None, site.base + "/", 50, 2, [], [])
    rep = run(cfg, SiteStore(octo, "acme", 2), srcs)
    urls = {r["url"].removeprefix(site.base) for r in rows(octo)}
    assert "/returns" in urls and "/" in urls
    assert not any("private" in u for u in urls)
    assert ("/private/secret", 200) not in site.hits and rep.failed == 0


def test_include_and_exclude_patterns(site, octo):
    srcs = web_sources(HttpFetcher(), site.base + "/sitemap.xml", None, 100, 2, [r"/(returns|faq)$"], [r"faq"])
    assert [s.url.removeprefix(site.base) for s in srcs] == ["/returns"]


def test_one_failing_page_does_not_stop_the_rest_and_is_retried(site, octo):
    real = octo.put_document
    def flaky(title, text):
        if "/faq" in text or "gift wrap" in text:
            raise RuntimeError("embedding is down")
        return real(title, text)
    octo.put_document = flaky
    rep = load(site, octo)
    assert rep.failed == 1 and rep.new == 3 and "embedding is down" in rep.errors[0]
    octo.put_document = real
    rep = load(site, octo)
    assert rep.new == 1 and rep.unchanged == 3                      # the failed page was not recorded, so it is picked up now


def test_documents_folder_html_markdown_and_pdf(tmp_path, octo):
    (tmp_path / "guides").mkdir()
    (tmp_path / "guides" / "setup.md").write_text("---\ntitle: Setup guide\ndate: 2026-08-01\n---\n# Setup\n\nPlug the base into the wall and wait until the green light stays on, which takes about two minutes.\n\n## Pairing\n\nHold the button for five seconds until the light blinks blue, then choose the device name on your phone.\n")
    (tmp_path / "terms.html").write_text(page("Terms of service", "<p>These terms apply to every order placed on our store, and by ordering you agree to them in full.</p><h2>Liability</h2><p>Our liability is limited to the price paid for the product that caused the loss.</p>"))
    (tmp_path / "warranty.pdf").write_bytes(b"%PDF-1.4 fake")
    (tmp_path / "logo.png").write_bytes(b"x")
    cfg = Config("acme", workers=2, pdf_reader=lambda data, name: ("Warranty", "# Warranty\n\nThe product is covered for two years from the date of purchase against any manufacturing defect."))

    def go():
        return run(cfg, SiteStore(octo, "acme", 2), doc_sources(tmp_path))

    rep = go()
    assert (rep.discovered, rep.new) == (3, 3)
    kinds = {r["url"]: r for r in rows(octo)}
    assert kinds["doc:guides/setup.md"]["last_modified"] == "2026-08-01" and kinds["doc:guides/setup.md"]["section"] in ("Setup", "Setup > Pairing")
    assert {r["page_type"] for r in rows(octo)} == {"docs", "policy"}
    puts, writes = octo.puts, octo.writes
    rep = go()
    assert rep.unchanged == 3 and (octo.puts, octo.writes) == (puts, writes)
    (tmp_path / "guides" / "setup.md").write_text("# Setup\n\nPlug the base into the wall and wait until the green light stays on, which now takes about one minute.\n")
    rep = go()
    assert rep.changed == 1 and rep.passages_removed >= 1
    (tmp_path / "warranty.pdf").unlink()
    rep = go()
    assert rep.deleted == 1 and not any(r["url"] == "doc:warranty.pdf" for r in rows(octo))
