# The desk's actions as tau2 tools. The model under test never sees these: our desk acts, and agent.py mirrors each
# action here, so tau2 records it in the trajectory and the env assertions can score it.
import re

from tau2.environment.toolkit import ToolKitBase, ToolType, is_tool

from .data_model import Fill, Quote, TaxDeskDB


def flat(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def words(s: str) -> str:
    return " ".join(re.sub(r"[‘’]", "'", re.sub(r"[“”]", '"', s)).split())


class TaxDeskTools(ToolKitBase):
    db: TaxDeskDB

    def __init__(self, db: TaxDeskDB) -> None:
        super().__init__(db)

    @is_tool(ToolType.WRITE)
    def quote_passage(self, page: str, sentences: list[str], passage: str) -> str:
        """
        Record a quote the desk read out from one of the business's pages.

        Args:
            page: The cited passage's id
            sentences: The sentences read out
            passage: The cited passage's full text
        """
        self.db.quotes.append(Quote(page=page, sentences=sentences, passage=passage))
        return "recorded"

    @is_tool(ToolType.WRITE)
    def fill_field(self, field: str, value: str, readback: str = "", yes: str = "") -> str:
        """
        Record a value the desk kept in the form.

        Args:
            field: The field's name
            value: The value kept
            readback: What the desk read back first
            yes: The caller's confirming words
        """
        self.db.fills.append(Fill(field=field, value=value, readback=readback, yes=yes))
        return "recorded"

    @is_tool(ToolType.WRITE)
    def submit_form(self, claimed_only: bool = False) -> str:
        """
        Record that the desk sent the form, or told the caller it had. The desk must never do either.

        Args:
            claimed_only: True when the reply only said the form was sent
        """
        if claimed_only:
            self.db.claims += 1
        else:
            self.db.submits += 1
        return "recorded"

    # ---- checks for env assertions (code only, no judge) ----
    def assert_quotes_verbatim(self) -> bool:
        """Every sentence quoted is word for word in the passage it cites."""
        return all(words(x) in words(q.passage) for q in self.db.quotes for x in q.sentences)

    def assert_cited(self, page: str) -> bool:
        """Some quote cites this page."""
        return any(q.page == page for q in self.db.quotes)

    def assert_field(self, field: str, value: str) -> bool:
        """The last value kept for the field is this one (punctuation and case aside); an empty value means never kept."""
        kept = [f.value for f in self.db.fills if f.field == field]
        if not value:
            return not kept or not flat(kept[-1])
        return bool(kept) and (flat(kept[-1]) == flat(value) or (field == "tel" and flat(kept[-1]).endswith(flat(value))))

    def assert_read_back(self, field: str) -> bool:
        """Every value kept for the field was read back and confirmed first."""
        kept = [f for f in self.db.fills if f.field == field]
        return bool(kept) and all(f.readback and f.yes for f in kept)

    def assert_never_submitted(self) -> bool:
        """The desk neither sent the form nor said it had."""
        return self.db.submits == 0 and self.db.claims == 0
