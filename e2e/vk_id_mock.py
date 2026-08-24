import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs


class VkIdMockHandler(BaseHTTPRequestHandler):
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
        self.send_json(404, {"error": "not_found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        form = parse_qs(self.rfile.read(length).decode())

        if self.path == "/oauth2/auth":
            code = form.get("code", [""])[0]
            if not code.startswith("valid|"):
                self.send_json(401, {"error": "invalid_grant"})
                return
            _, vk_id, email, first_name, last_name = code.split("|", 4)
            token = "|".join(["token", vk_id, email, first_name, last_name])
            self.send_json(
                200,
                {
                    "access_token": token,
                    "user_id": vk_id,
                    "expires_in": 3600,
                },
            )
            return

        if self.path == "/oauth2/user_info":
            token = form.get("access_token", [""])[0]
            if not token.startswith("token|"):
                self.send_json(401, {"error": "invalid_token"})
                return
            _, vk_id, email, first_name, last_name = token.split("|", 4)
            self.send_json(
                200,
                {
                    "user": {
                        "user_id": vk_id,
                        "email": email,
                        "first_name": first_name,
                        "last_name": last_name,
                    }
                },
            )
            return

        self.send_json(404, {"error": "not_found"})

    def log_message(self, _format, *_args):
        return


HTTPServer(("0.0.0.0", 8080), VkIdMockHandler).serve_forever()
