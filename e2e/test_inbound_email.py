"""Ответы на письма → чат поддержки: POST /api/inbound-email (вызывает скрипт Postfix)."""
import os
import uuid

import requests as req_lib

from conftest import login

SECRET = os.environ.get("INBOUND_EMAIL_SECRET", "test-inbound-email-secret-for-e2e")
CRON_SECRET = os.environ.get("CRON_SECRET", "test-cron-secret-for-e2e")


def _post(base_url, payload, token=SECRET):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return req_lib.post(f"{base_url}/api/inbound-email", json=payload, headers=headers, timeout=60)


def _new_user(base_url):
    email = f"inbound-{uuid.uuid4().hex[:8]}@test.example.com"
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": "secure123", "name": "Inbound User", "consentPd": True},
    )
    assert r.status_code == 200, r.text
    s = req_lib.Session()
    login(s, base_url, email, "secure123")
    return email, s


def _messages(session, base_url):
    r = session.get(f"{base_url}/api/support")
    assert r.status_code == 200, r.text
    return r.json()["messages"]


def test_requires_secret(base_url):
    payload = {"from": "a@example.com", "text": "hi"}
    assert _post(base_url, payload, token=None).status_code == 401
    assert _post(base_url, payload, token="wrong").status_code == 401
    assert _post(base_url, payload, token=CRON_SECRET).status_code == 401


def test_invalid_payload(base_url):
    assert _post(base_url, {"from": "не адрес", "text": "x"}).status_code == 400
    r = req_lib.post(
        f"{base_url}/api/inbound-email",
        data="not json",
        headers={"Authorization": f"Bearer {SECRET}", "Content-Type": "application/json"},
        timeout=30,
    )
    assert r.status_code == 400


def test_reply_from_user_lands_in_support_chat(base_url):
    email, s = _new_user(base_url)
    assert _messages(s, base_url) == []

    r = _post(
        base_url,
        {
            "from": email.upper(),  # регистр адреса не важен
            "fromName": "Иван",
            "to": "noreply@qrstars.ru",
            "subject": "Re: Ваш сайт готов",
            "text": "Как поменять шаблон?\n\nсб, 15 нояб. 2026 г. в 19:12, QrStars.ru <noreply@qrstars.ru>:\n> цитата письма",
            "automated": False,
            "attachments": [],
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["delivered"] == "support_ticket"

    msgs = _messages(s, base_url)
    assert len(msgs) == 1
    assert msgs[0]["author"] == "USER"
    assert "Как поменять шаблон?" in msgs[0]["body"]
    assert "Ваш сайт готов" in msgs[0]["body"]
    assert "цитата письма" not in msgs[0]["body"]


def test_automated_reply_is_dropped(base_url):
    email, s = _new_user(base_url)
    r = _post(base_url, {"from": email, "subject": "Автоответ", "text": "Я в отпуске", "automated": True})
    assert r.status_code == 200, r.text
    assert r.json()["skipped"] == "automated"
    assert _messages(s, base_url) == []


def test_unsupported_attachment_is_noted_not_fatal(base_url):
    email, s = _new_user(base_url)
    r = _post(
        base_url,
        {
            "from": email,
            "text": "Смотрите файл",
            "attachments": [{"name": "virus.exe", "mime": "application/x-msdownload", "dataBase64": "TVo="}],
        },
    )
    assert r.status_code == 200, r.text
    msgs = _messages(s, base_url)
    assert len(msgs) == 1
    assert "virus.exe" in msgs[0]["body"]
    assert msgs[0]["attachmentUrl"] is None


def test_unknown_sender_does_not_create_ticket(base_url):
    r = _post(base_url, {"from": f"stranger-{uuid.uuid4().hex[:6]}@example.com", "text": "Здравствуйте"})
    assert r.status_code == 200, r.text
    assert r.json()["delivered"] == "unknown_sender"


def test_any_domain_address_from_user_goes_to_ticket(base_url):
    # Catch-all: письмо на info@ (или любой другой адрес домена) от пользователя — тоже в его тикет.
    email, s = _new_user(base_url)
    r = _post(base_url, {"from": email, "to": "info@qrstars.ru", "subject": "Счёт", "text": "Пришлите счёт"})
    assert r.status_code == 200, r.text
    msgs = _messages(s, base_url)
    assert len(msgs) == 1
    assert "info@qrstars.ru" in msgs[0]["body"]
    assert "Пришлите счёт" in msgs[0]["body"]
