import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs


class YandexIdMockHandler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {"ok": True})
            return

        if self.path.startswith("/info"):
            authorization = self.headers.get("Authorization", "")
            if not authorization.startswith("OAuth token|"):
                self.send_json(401, {"error": "invalid_token"})
                return
            _, yandex_id, email, first_name, last_name = authorization.split(
                "|", 4
            )
            self.send_json(
                200,
                {
                    "id": yandex_id,
                    "default_email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "real_name": f"{first_name} {last_name}",
                },
            )
            return

        self.send_json(404, {"error": "not_found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        form = parse_qs(self.rfile.read(length).decode())

        if self.path == "/token":
            code = form.get("code", [""])[0]
            if (
                not code.startswith("valid|")
                or form.get("client_id") != ["yandex-e2e-client"]
                or form.get("client_secret") != ["yandex-e2e-secret"]
            ):
                self.send_json(401, {"error": "invalid_grant"})
                return
            self.send_json(200, {"access_token": code.replace("valid|", "token|", 1)})
            return

        self.send_json(404, {"error": "not_found"})

    def log_message(self, _format, *_args):
        return


HTTPServer(("0.0.0.0", 8080), YandexIdMockHandler).serve_forever()
