import pytest
from site_ingest.extract import extract
from site_ingest.models import Fetched
from site_server import page


def html(url, body, **kw):
    return Fetched(url, 200, body.encode(), "text/html", **kw)


def test_html_gives_clean_text_and_metadata():
    p = page("Politique de retour", "<p>Vous pouvez retourner un article dans les trente jours suivant la livraison avec le recu original.</p><h2>Remboursements</h2><p>Les remboursements sont versés sur le moyen de paiement initial sous cinq jours ouvrables après réception.</p>", lang="fr", modified="2026-09-30")
    d = extract(html("https://a.com/retours", p))
    assert d.title == "Politique de retour" and d.language == "fr" and d.last_modified == "2026-09-30"
    assert "retourner" in d.markdown
    assert "All rights reserved" not in d.markdown and "Home" not in d.markdown   # navigation and footer are gone


def test_language_without_lang_attribute_is_detected_then_defaulted():
    body = "<html><body><main><h1>T</h1><p>" + "Les remboursements sont versés sur le moyen de paiement initial sous cinq jours. " * 3 + "</p></main></body></html>"
    assert extract(html("https://a.com/x", body)).language == "fr"
    short = "<html><body><main><h1>Hi</h1><p>Open daily from nine to five, call us any time.</p></main></body></html>"
    assert extract(html("https://a.com/y", short), default_language="es").language == "es"


def test_markdown_front_matter_and_title():
    f = Fetched("doc:guide.md", 200, b"---\ntitle: Setup guide\nlang: de\ndate: 2026-08-01\n---\n# Heading\n\nInstall the thing by following these steps carefully, one at a time.", "text/markdown")
    d = extract(f)
    assert (d.title, d.language, d.last_modified, d.kind, d.page_type) == ("Setup guide", "de", "2026-08-01", "markdown", "document")
    assert "---" not in d.markdown


def test_pdf_goes_through_the_reader():
    seen = []

    def reader(data, name):
        seen.append((data, name))
        return "Warranty", "# Warranty\n\nThe product is covered for two years from the date of purchase against defects."

    d = extract(Fetched("doc:warranty.pdf", 200, b"%PDF-fake", "application/pdf"), pdf_reader=reader)
    assert seen == [(b"%PDF-fake", "doc:warranty.pdf")] and d.kind == "pdf" and d.title == "Warranty"


def test_unusable_content_is_none():
    assert extract(html("https://a.com/e", "<html><body></body></html>")) is None
    assert extract(Fetched("https://a.com/i.png", 200, b"x", "image/png")) is None


def test_real_docling_reads_a_pdf():
    pytest.importorskip("docling")
    canvas = pytest.importorskip("reportlab.pdfgen.canvas")
    import io
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(72, 750, "Warranty terms")
    c.drawString(72, 720, "The product is covered for two years from the date of purchase.")
    c.save()
    d = extract(Fetched("doc:w.pdf", 200, buf.getvalue(), "application/pdf"))
    assert "two years" in d.markdown
