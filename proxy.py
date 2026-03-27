#!/usr/bin/env python3
"""Lightweight proxy server for HubSpot Reports.
Serves static files from ./public and proxies /api/hubspot/* to api.hubapi.com.
"""
import http.server
import json
import os
import urllib.request
import urllib.error
import urllib.parse

PORT = int(os.environ.get("PORT", 8082))
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")


class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def do_POST(self):
        if self.path.startswith("/api/hubspot/"):
            self._proxy("POST")
        else:
            self.send_error(404)

    def do_GET(self):
        if self.path.startswith("/api/hubspot/"):
            self._proxy("GET")
        else:
            # Serve static files; SPA fallback to index.html
            path = self.translate_path(self.path)
            if not os.path.exists(path) or os.path.isdir(path):
                if not os.path.exists(path) and not self.path.startswith("/api"):
                    self.path = "/index.html"
            super().do_GET()

    def _proxy(self, method):
        token = self.headers.get("x-hubspot-token", "")
        if not token:
            self._json_response(401, {"error": "Missing HubSpot API token"})
            return

        hs_path = self.path[len("/api/hubspot/"):]
        url = f"https://api.hubapi.com/{hs_path}"

        body = None
        if method == "POST":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length else None

        req = urllib.request.Request(url, data=body, method=method)
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Content-Type", "application/json")

        try:
            with urllib.request.urlopen(req) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self._json_response(502, {"error": str(e)})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, x-hubspot-token")
        self.end_headers()

    def _json_response(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(f"[HubSpot Reports] {args[0]}")


if __name__ == "__main__":
    with http.server.HTTPServer(("", PORT), ProxyHandler) as server:
        print(f"HubSpot Reports running on http://localhost:{PORT}")
        server.serve_forever()
