"""An in-memory stand-in for Octo's documents and SQL surface, for tests. SQL runs on SQLite: the store uses only
statements both databases share ($n parameters become ?n)."""
from __future__ import annotations

import re
import sqlite3
import threading
import uuid


class FakeOcto:
    def __init__(self) -> None:
        self.db = sqlite3.connect(":memory:", check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.lock = threading.Lock()
        self.docs: dict[str, tuple[str, str]] = {}      # id -> (title, text)
        self.puts = 0
        self.deletes = 0
        self.writes = 0                                  # SQL statements that change data

    def sql(self, text: str, params: list | None = None) -> dict:
        q = re.sub(r"\$(\d+)", r"?\1", text)
        with self.lock:
            cur = self.db.execute(q, params or [])
            if re.match(r"\s*(insert|update|delete)", q, re.I):
                self.writes += 1
            rows = [dict(r) for r in cur.fetchall()] if cur.description else []
            self.db.commit()
        return {"rows": rows, "rowCount": len(rows)}

    def put_document(self, title: str, text: str) -> str:
        with self.lock:
            self.puts += 1
            for i, (t, _) in self.docs.items():
                if t == title:
                    self.docs[i] = (title, text)
                    return i
            i = str(uuid.uuid4())
            self.docs[i] = (title, text)
            return i

    def delete_document(self, doc_id: str) -> None:
        with self.lock:
            self.deletes += 1
            self.docs.pop(doc_id, None)

    def titles(self) -> list[str]:
        return sorted(t for t, _ in self.docs.values())
