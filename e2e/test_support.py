"""Support chat: dashboard API for authenticated owners."""

import requests as req_lib


def test_support_requires_auth(base_url):
    r = req_lib.get(f"{base_url}/api/support")
    assert r.status_code == 401


def test_support_flow(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/support")
    assert r.status_code == 200
    data = r.json()
    assert "messages" in data
    assert "ticket" in data

    r = owner_session.post(
        f"{base_url}/api/support",
        json={"body": "Тестовый вопрос в поддержку e2e"},
    )
    assert r.status_code == 200
    msg = r.json()["message"]
    assert msg["author"] == "USER"
    assert "e2e" in msg["body"]

    r = owner_session.get(f"{base_url}/api/support")
    assert r.status_code == 200
    bodies = [m["body"] for m in r.json()["messages"]]
    assert any("e2e" in b for b in bodies)


def test_support_empty_message(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/support",
        json={"body": "   "},
    )
    assert r.status_code == 400


def test_support_send_text_only_still_works(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/support",
        json={"body": "Только текст e2e support"},
    )
    assert r.status_code == 200
    assert r.json()["message"]["body"]


def test_admin_support_requires_admin(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/admin/support")
    assert r.status_code in (401, 403)
