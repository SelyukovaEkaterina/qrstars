import pytest
import requests as req_lib


def test_get_subscription(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/subscription")
    assert r.status_code == 200
    data = r.json()
    assert "subscription" in data
    sub = data["subscription"]
    assert sub is not None
    assert sub["plan"] in ("FREE", "PRO")
    assert sub["status"] in ("ACTIVE", "PAST_DUE", "CANCELED")


def test_subscribe_mock(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/subscription",
        json={"action": "subscribe"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["mode"] == "mock"


def test_subscribe_already_pro(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/subscription",
        json={"action": "subscribe"},
    )
    assert r.status_code == 400


def test_cancel_subscription(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/subscription",
        json={"action": "cancel"},
    )
    assert r.status_code == 200
    assert r.json()["success"] is True


def test_subscription_unknown_action(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/subscription",
        json={"action": "unknown"},
    )
    assert r.status_code == 400


def test_subscription_requires_auth(base_url):
    s = req_lib.Session()
    r = s.get(f"{base_url}/api/subscription")
    assert r.status_code == 401
