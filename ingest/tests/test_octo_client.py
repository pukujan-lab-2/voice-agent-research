import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from site_ingest.octo import Octo, OctoError


class Stub:
    def __init__(self, script):
        self.script, self.seen = list(script), []
        stub = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def handle_one(self):
                n = int(self.headers.get("Content-Length") or 0)
                stub.seen.append((self.command, self.path, self.headers.get("Authorization"), json.loads(self.rfile.read(n) or b"{}")))
                code, body = stub.script.pop(0)
                data = json.dumps(body).encode()
                self.send_response(code)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            do_GET = do_POST = do_DELETE = handle_one

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.httpd.server_address[1]}/api"


def client(stub):
    return Octo("k-secret", "ws-1", stub.base, timeout=5, retries=3)


def test_put_document_sends_workspace_title_text_and_bearer_key(monkeypatch):
    monkeypatch.setattr("time.sleep", lambda s: None)
    s = Stub([(201, {"documentId": "d1"})])
    assert client(s).put_document("acme/en/faq/x", "text") == "d1"
    method, path, auth, body = s.seen[0]
    assert (method, path, auth) == ("POST", "/api/rag/documents", "Bearer k-secret")
    assert body == {"workspaceId": "ws-1", "title": "acme/en/faq/x", "text": "text"}


def test_server_errors_are_retried_client_errors_are_not(monkeypatch):
    monkeypatch.setattr("time.sleep", lambda s: None)
    s = Stub([(500, {}), (429, {}), (200, {"rows": []})])
    assert client(s).sql("select 1", [1]) == {"rows": []}
    assert len(s.seen) == 3 and s.seen[2][3] == {"sql": "select 1", "params": [1]}
    s = Stub([(400, {"error": "bad sql"})])
    with pytest.raises(OctoError):
        client(s).sql("select")
    assert len(s.seen) == 1


def test_delete_of_a_missing_document_is_fine_other_errors_are_not(monkeypatch):
    monkeypatch.setattr("time.sleep", lambda s: None)
    assert client(Stub([(404, {})])).delete_document("gone") is None
    with pytest.raises(OctoError):
        client(Stub([(403, {})])).delete_document("x")


def test_upsert_builds_one_statement_per_chunk_and_casts_json_columns(monkeypatch):
    monkeypatch.setattr("time.sleep", lambda s: None)
    s = Stub([(200, {"rows": []}), (200, {"rows": []})])
    client(s).upsert("t", ["k", "v", "j"], [{"k": "a", "v": "1", "j": {"x": 1}}, {"k": "b", "v": "2", "j": None}, {"k": "c", "v": "3", "j": [1]}], "k", chunk=2, jsonb=("j",))
    first, second = s.seen[0][3], s.seen[1][3]
    assert first["sql"] == "insert into t (k,v,j) values ($1,$2,$3::jsonb),($4,$5,$6::jsonb) on conflict (k) do update set v=excluded.v,j=excluded.j"
    assert first["params"] == ["a", "1", '{"x": 1}', "b", "2", None]
    assert second["params"] == ["c", "3", "[1]"]
