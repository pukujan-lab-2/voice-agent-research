"""Octo client for the store tools (keys from ~/Documents/projects/.env, never printed)."""
import base64, json, os, time, urllib.request

BASE = "https://octodb.design-bakery.com/api"


def env():
    out = {}
    for line in open(os.path.expanduser("~/Documents/projects/.env")):
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.strip().split("=", 1)
            out[k.replace("export ", "")] = v.strip().strip("'\"")
    return out


E = env()
KEY, WS = E["octo_db_chatbots"], E["octo_db_chatbots_workspace"]


def octo(path, body=None, timeout=300, retries=4):
    for i in range(retries):
        try:
            req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
                                         method="POST" if body is not None else "GET",
                                         headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json", "User-Agent": "store-demo/0.1"})
            return json.load(urllib.request.urlopen(req, timeout=timeout))
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:400]
            if e.code < 500 or i == retries - 1:
                raise RuntimeError(f"octo {path.split('?')[0]} {e.code}: {msg}")
        except (urllib.error.URLError, TimeoutError) as e:
            if i == retries - 1:
                raise
        time.sleep(2 * (i + 1))


def sql(text, params=None):
    return octo(f"/workspaces/{WS}/query", {"sql": text, **({"params": params} if params else {})})


def upload(name, data: bytes, mime, meta=None):
    return octo("/files/upload", {"workspaceId": WS, "name": name, "mimeType": mime, "data": base64.b64encode(data).decode(),
                                  "dataEncoding": "base64", "metadata": meta or {}})
