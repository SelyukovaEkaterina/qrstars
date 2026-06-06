import uuid

import requests as req_lib

from conftest import login


def unique_email(prefix="evt"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@test.example.com"


def register_and_login(base_url, prefix="evt"):
    email = unique_email(prefix)
    password = "secure123"
    reg = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "name": "Events User", "consentPd": True},
    )
    assert reg.status_code == 200
    session = req_lib.Session()
    return login(session, base_url, email, password)


def test_events_requires_auth(base_url):
    r = req_lib.post(
        f"{base_url}/api/events",
        json={"event": "setup.intent_viewed"},
    )
    assert r.status_code == 401


def test_events_rejects_unknown_event(base_url):
    session = register_and_login(base_url, "evt-unknown")
    r = session.post(
        f"{base_url}/api/events",
        json={"event": "setup.unknown_event"},
    )
    assert r.status_code == 400


def test_events_stores_setup_funnel(base_url):
    session = register_and_login(base_url, "evt-funnel")

    events = [
        {"event": "setup.intent_viewed"},
        {"event": "setup.intent_selected", "props": {"intent": "redirect"}},
        {"event": "setup.form_submitted", "props": {"intent": "redirect"}},
    ]
    for payload in events:
        r = session.post(f"{base_url}/api/events", json=payload)
        assert r.status_code == 200, r.text

    qs = session.post(
        f"{base_url}/api/setup/quick-start",
        json={"intent": "redirect", "redirectUrl": "https://example.com/promo"},
    )
    assert qs.status_code == 200, qs.text
    qr_id = qs.json()["qrcode"]["id"]

    r = session.post(
        f"{base_url}/api/events",
        json={
            "event": "setup.completed",
            "props": {"intent": "redirect", "qrCodeId": qr_id},
        },
    )
    assert r.status_code == 200, r.text

    r = session.post(
        f"{base_url}/api/events",
        json={
            "event": "setup.qr_downloaded",
            "props": {"intent": "redirect", "qrCodeId": qr_id},
        },
    )
    assert r.status_code == 200, r.text

    listed = session.get(f"{base_url}/api/events")
    assert listed.status_code == 200, listed.text
    names = [e["event"] for e in listed.json().get("events", [])]
    assert "setup.intent_viewed" in names
    assert "setup.intent_selected" in names
    assert "setup.form_submitted" in names
    assert "setup.completed" in names
    assert "setup.qr_downloaded" in names
