"""A real HTTP server for a fixture site: sitemap, robots.txt, ETag/If-None-Match, 404 for removed pages."""
from __future__ import annotations

import hashlib
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class Site:
    def __init__(self) -> None:
        self.pages: dict[str, tuple[bytes, str]] = {}   # path -> (body, content type)
        self.hits: list[tuple[str, int]] = []
        self.sitemap = True
        self.robots = "User-agent: *\nDisallow: /private/\n"
        site = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a) -> None:  # silence
                pass

            def do_GET(self) -> None:  # noqa: N802
                path = self.path.split("?")[0]
                if path == "/robots.txt":
                    return self.send(200, site.robots.encode(), "text/plain")
                if path == "/sitemap.xml" and site.sitemap:
                    locs = "".join(f"<url><loc>http://127.0.0.1:{site.port}{p}</loc></url>" for p in site.pages if not p.startswith("/private/") and p != "/sitemap.xml")
                    return self.send(200, f'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{locs}</urlset>'.encode(), "application/xml")
                if path in site.pages:
                    body, ct = site.pages[path]
                    tag = '"' + hashlib.md5(body).hexdigest() + '"'
                    if self.headers.get("If-None-Match") == tag:
                        site.hits.append((path, 304))
                        return self.send(304, b"", ct, tag)
                    site.hits.append((path, 200))
                    return self.send(200, body, ct, tag)
                site.hits.append((path, 404))
                self.send(404, b"not found", "text/plain")

            def send(self, code: int, body: bytes, ct: str, etag: str = "") -> None:
                self.send_response(code)
                self.send_header("Content-Type", ct)
                if etag:
                    self.send_header("ETag", etag)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    @property
    def base(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def put(self, path: str, html: str, ct: str = "text/html; charset=utf-8") -> None:
        self.pages[path] = (html.encode(), ct)

    def stop(self) -> None:
        self.httpd.shutdown()


def page(title: str, body: str, lang: str = "en", modified: str = "2026-10-01") -> str:
    return (f'<html lang="{lang}"><head><title>{title} | Acme</title><meta property="article:modified_time" content="{modified}"></head>'
            f"<body><nav><a href='/'>Home</a> <a href='/returns'>Returns</a></nav><main><h1>{title}</h1>{body}</main>"
            f"<footer>(c) Acme. All rights reserved. Privacy Terms</footer></body></html>")
