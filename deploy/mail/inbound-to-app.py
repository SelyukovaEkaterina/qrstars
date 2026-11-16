#!/usr/bin/env python3
"""
Входящее письмо из Postfix (pipe через /etc/aliases) → POST /api/inbound-email.

Postfix запускает скрипт от `nobody` и передаёт письмо в stdin. Скрипт разбирает MIME
(текст, вложения, признаки автоответа) и шлёт JSON в приложение.
Коды выхода: 0 — принято или сознательно отброшено, 75 (EX_TEMPFAIL) — Postfix
повторит доставку позже (приложение недоступно / деплой / ошибка секрета).

Только стандартная библиотека. Установка — deploy/mail/README.md.
"""
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request
from email import policy
from email.parser import BytesParser
from email.utils import parseaddr
from html.parser import HTMLParser

API_URL = os.environ.get("QRSTARS_INBOUND_URL", "https://app.qrstars.ru/api/inbound-email")
SECRET_FILE = os.environ.get("QRSTARS_INBOUND_SECRET_FILE", "/etc/qrstars/inbound-email.secret")
MAX_ATTACHMENT = 10 * 1024 * 1024
MAX_ATTACHMENTS_TOTAL = 20 * 1024 * 1024  # base64 ≈ 27 МБ < client_max_body_size 32m
EX_TEMPFAIL = 75

AUTO_SUBJECT = re.compile(
    r"^\s*(автоответ|автоматический ответ|auto[- ]?reply|automatic reply|out of (the )?office|"
    r"undeliverable|undelivered|delivery status notification|mail delivery (failed|system)|"
    r"returned mail|недоставлен|не доставлено|отчёт о доставке|отчет о доставке)",
    re.I,
)


class _HtmlText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "head"):
            self.skip += 1
        if tag in ("br", "p", "div", "li", "tr", "blockquote", "h1", "h2", "h3"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "head") and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def html_to_text(html: str) -> str:
    # Цитата нашего письма в HTML-ответе — <blockquote> / div.gmail_quote: отрезаем её целиком.
    html = re.split(r"<blockquote|<div[^>]+class=\"?[^\">]*(gmail_quote|yahoo_quoted|moz-cite-prefix)", html, 1, flags=re.I)[0]
    p = _HtmlText()
    p.feed(html)
    text = "".join(p.parts)
    return re.sub(r"\n{3,}", "\n\n", re.sub(r"[ \t\xa0]+", " ", text)).strip()


def is_automated(msg, sender_env: str, from_addr: str) -> bool:
    auto = (msg.get("Auto-Submitted") or "").strip().lower()
    if auto and auto != "no":
        return True
    if (msg.get("Precedence") or "").strip().lower() in ("bulk", "junk", "list", "auto_reply"):
        return True
    for h in ("X-Autoreply", "X-Autorespond", "X-Auto-Reply", "List-Id", "List-Unsubscribe", "Feedback-ID"):
        if msg.get(h):
            return True
    if msg.get_content_type() == "multipart/report":
        return True
    if sender_env == "" or sender_env == "<>":
        return True
    local = from_addr.split("@")[0].lower()
    if local in ("mailer-daemon", "postmaster", "noreply", "no-reply", "do-not-reply", "donotreply"):
        return True
    return bool(AUTO_SUBJECT.search(msg.get("Subject") or ""))


def extract(msg):
    text_plain, text_html = None, None
    attachments, total = [], 0
    for part in msg.walk():
        if part.is_multipart():
            continue
        ctype = part.get_content_type()
        disp = part.get_content_disposition()
        filename = part.get_filename()
        if disp == "attachment" or (filename and disp is not None) or (filename and not ctype.startswith("text/")):
            try:
                data = part.get_payload(decode=True) or b""
            except Exception:
                continue
            if not data or len(data) > MAX_ATTACHMENT or total + len(data) > MAX_ATTACHMENTS_TOTAL:
                continue
            total += len(data)
            attachments.append({
                "name": (filename or "file")[:200],
                "mime": ctype,
                "dataBase64": base64.b64encode(data).decode("ascii"),
            })
            continue
        try:
            content = part.get_content()
        except Exception:
            raw = part.get_payload(decode=True) or b""
            content = raw.decode("utf-8", "replace")
        if not isinstance(content, str):
            continue
        if ctype == "text/plain" and text_plain is None:
            text_plain = content
        elif ctype == "text/html" and text_html is None:
            text_html = content
    text = text_plain if text_plain and text_plain.strip() else (html_to_text(text_html) if text_html else "")
    return text[:20000], attachments


def main() -> int:
    raw = sys.stdin.buffer.read()
    msg = BytesParser(policy=policy.default).parsebytes(raw)
    # Аккаунт ищем по From (не Reply-To): это адрес, с которого человек отвечает.
    name, from_addr = parseaddr(str(msg.get("From") or ""))
    sender_env = os.environ.get("SENDER", "-")
    recipient = os.environ.get("ORIGINAL_RECIPIENT") or os.environ.get("RECIPIENT") or ""

    text, attachments = extract(msg)
    payload = {
        "from": from_addr,
        "fromName": name or None,
        "to": recipient or None,
        "subject": str(msg.get("Subject") or "") or None,
        "text": text,
        "automated": is_automated(msg, sender_env, from_addr),
        "attachments": attachments,
    }

    try:
        with open(SECRET_FILE, encoding="utf-8") as f:
            secret = f.read().strip()
    except OSError as e:
        print(f"inbound-to-app: no secret file: {e}", file=sys.stderr)
        return EX_TEMPFAIL

    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {secret}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            print(f"inbound-to-app: {resp.status} {resp.read(300).decode('utf-8', 'replace')}", file=sys.stderr)
            return 0
    except urllib.error.HTTPError as e:
        body = e.read(300).decode("utf-8", "replace")
        print(f"inbound-to-app: HTTP {e.code} {body}", file=sys.stderr)
        # 400 — письмо, которое приложение не примет никогда; остальное (401 при смене секрета, 5xx, 429) — повторить.
        return 0 if e.code == 400 else EX_TEMPFAIL
    except Exception as e:  # сеть, таймаут, деплой
        print(f"inbound-to-app: {e}", file=sys.stderr)
        return EX_TEMPFAIL


if __name__ == "__main__":
    sys.exit(main())
