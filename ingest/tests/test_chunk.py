from site_ingest.chunk import split
from site_ingest.pagetype import classify

MD = """# Return policy

Items can be returned within thirty days of delivery with the original receipt. Returns are free for customers in the same country.

## Refunds

Refunds go back to the original payment method within five business days. Sale items are final and cannot be returned for any reason.

## Exchanges

Ask for an exchange when you start the return and we will ship the new size as soon as the parcel arrives back at our warehouse.
"""


def test_sections_follow_headings():
    ds = split(MD, "Return policy", max_chars=300, min_chars=40)
    assert [d.section for d in ds] == ["", "Refunds", "Exchanges"]
    assert all(len(d.text) <= 300 for d in ds)
    assert [d.seq for d in ds] == [0, 1, 2]


def test_long_block_is_cut_at_sentences_never_over_the_limit():
    text = " ".join(f"Sentence number {i} says something useful about delivery." for i in range(60))
    ds = split(f"# Page\n\n{text}", "Page", max_chars=400)
    assert len(ds) > 5 and all(len(d.text) <= 400 for d in ds)
    assert all(d.text.endswith(".") for d in ds)


def test_a_word_with_no_stops_is_still_cut():
    ds = split("# P\n\n" + "word " * 500, "P", max_chars=300)
    assert all(len(d.text) <= 300 for d in ds) and len(ds) >= 8


def test_tiny_tail_joins_its_section_and_noise_is_dropped():
    ds = split("# P\n\n## A\n\n" + "This section has a decent amount of words in it to stand on its own two feet. " * 2 + "\n\nok\n\n## B\n\nx", "P", min_chars=80)
    assert any("ok" in d.text for d in ds)
    assert not any(d.text == "x" for d in ds)


def test_table_and_list_stay_whole():
    ds = split("# P\n\n| Zone | Price |\n|---|---|\n| Paris | 5 |\n| Lyon | 6 |\n\n- one\n- two", "P")
    assert "| Lyon | 6 |" in ds[0].text


def test_page_type_rules_and_overrides():
    assert classify("https://a.com/faq") == "faq"
    assert classify("https://a.com/help/returns") == "policy"
    assert classify("https://a.com/pricing") == "pricing"
    assert classify("https://a.com/blog/2026/10/x") == "blog"
    assert classify("https://a.com/x", "Frequently asked questions") == "faq"
    assert classify("https://a.com/anything") == "page"
    assert classify("doc:manual.pdf", kind="pdf") == "document"
    assert classify("https://a.com/anything", overrides={"/anything": "product"}) == "product"
