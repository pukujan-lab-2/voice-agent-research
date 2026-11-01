import pytest
from fake_octo import FakeOcto
from site_server import Site, page

PARA = ("Our store is open every day. Orders placed before noon ship the same day, and standard delivery takes three to five business days. "
        "You can track a parcel with the number in your confirmation email.")


@pytest.fixture()
def octo() -> FakeOcto:
    return FakeOcto()


@pytest.fixture()
def site():
    s = Site()
    s.put("/returns", page("Return policy", f"<p>{PARA} Returns are free within thirty days of delivery with the original receipt.</p><h2>Refunds</h2><p>Refunds go back to the original payment method within five business days of us receiving the parcel. Sale items are final.</p>"))
    s.put("/shipping", page("Shipping", f"<p>{PARA}</p><h2>International</h2><p>International orders take ten to fourteen business days and may be held by customs. Duties are paid by the recipient on delivery.</p>"))
    s.put("/faq", page("FAQ", "<h2>Do you gift wrap?</h2><p>Yes, gift wrapping costs three dollars per item and can be added at checkout before you pay.</p><h2>Can I change my address?</h2><p>You can change the address until the order ships by emailing support with your order number.</p>"))
    s.put("/fr/retours", page("Politique de retour", "<p>Vous pouvez retourner un article dans les trente jours suivant la livraison avec le reçu original, sans aucun frais pour vous.</p><h2>Remboursements</h2><p>Les remboursements sont versés sur le moyen de paiement initial sous cinq jours ouvrables après réception du colis retourné.</p>", lang="fr"))
    yield s
    s.stop()
