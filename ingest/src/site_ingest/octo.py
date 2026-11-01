"""A small Octo client: documents (search), SQL on the workspace's own database, and upsert helpers.
Key and workspace come from the environment (or the owner's secrets file); they are never printed."""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://octodb.design-bakery.com/api"
SECRETS = Path.home() / "Documents" / "projects" / ".env"


def read_env(path: Path = SECRETS) -> dict[str, str]:
    out: dict[str, str] = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.strip().split("=", 1)
                out[k.replace("export ", "")] = v.strip().strip("'\"")
    return out


class OctoError(RuntimeError):
    pass


class Octo:
    def __init__(self, key: str, workspace: str, base: str = BASE, timeout: float = 120.0, retries: int = 4):
        self.key, self.workspace, self.base, self.timeout, self.retries = key, workspace, base.rstrip("/"), timeout, retries

    @classmethod
    def from_env(cls, key_var: str = "octo_db_chatbots", workspace_var: str = "octo_db_chatbots_workspace") -> Octo:
        env = {**read_env(), **os.environ}
        if key_var not in env or workspace_var not in env:
            raise OctoError(f"{key_var} and {workspace_var} must be set (environment or the secrets file)")
        return cls(env[key_var], env[workspace_var], env.get("OCTO_API_BASE", BASE))

    def request(self, method: str, path: str, body: dict | None = None) -> dict | list:
        data = json.dumps(body).encode() if body is not None else None
        last = ""
        for attempt in range(self.retries):
            req = urllib.request.Request(self.base + path, data=data, method=method, headers={
                "Authorization": "Bearer " + self.key, "Content-Type": "application/json", "User-Agent": "site-ingest/0.1"})
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as r:
                    return json.load(r)
            except urllib.error.HTTPError as e:
                last = f"HTTP {e.code}: {e.read()[:300].decode('utf-8', 'replace')}"
                if e.code < 500 and e.code != 429:
                    raise OctoError(last) from None
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                last = str(e)
            time.sleep(1.5 * (attempt + 1))
        raise OctoError(f"{method} {path} failed: {last}")

    def sql(self, text: str, params: list | None = None) -> dict:
        return self.request("POST", f"/workspaces/{self.workspace}/query", {"sql": text, **({"params": params} if params else {})})  # type: ignore[return-value]

    def put_document(self, title: str, text: str) -> str:
        r = self.request("POST", "/rag/documents", {"workspaceId": self.workspace, "title": title, "text": text})
        if not isinstance(r, dict) or not r.get("documentId"):
            raise OctoError(f"no documentId for {title}")
        return r["documentId"]

    def delete_document(self, doc_id: str) -> None:
        try:
            self.request("DELETE", f"/rag/documents/{doc_id}?workspaceId={self.workspace}")
        except OctoError as e:
            if "404" not in str(e):   # already gone is fine
                raise

    def upsert(self, table: str, cols: list[str], rows: list[dict], key: str, chunk: int = 150, jsonb: tuple[str, ...] = ()) -> None:
        """insert ... on conflict (key) do update, in chunks. Columns named in `jsonb` are sent as JSON text and cast."""
        for i in range(0, len(rows), chunk):
            vals, params = [], []
            for r in rows[i:i + chunk]:
                vals.append("(" + ",".join(f"${len(params) + j + 1}" + ("::jsonb" if c in jsonb else "") for j, c in enumerate(cols)) + ")")
                params += [json.dumps(r[c], ensure_ascii=False) if c in jsonb and r[c] is not None else r[c] for c in cols]
            sets = ",".join(f"{c}=excluded.{c}" for c in cols if c != key)
            self.sql(f"insert into {table} ({','.join(cols)}) values {','.join(vals)} on conflict ({key}) do update set {sets}", params)
