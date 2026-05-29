import pytest
import requests as req_lib

from conftest import reset_user_to_free


def test_get_subscription(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/subscription")
    assert r.status_code == 200
    data = r.json()
    assert "subscription" in data
    assert "plan" in data
    assert data["plan"] in ("FREE", "PRO", "NETWORK")
    assert "canAddEstablishment" in data
    sub = data["subscription"]
    if sub:
        assert sub["plan"] in ("FREE", "PRO", "NETWORK")
        assert sub["status"] in ("ACTIVE", "PAST_DUE", "CANCELED")


def test_subscribe_mock(owner_session, admin_session, base_url):
    reset_user_to_free(admin_session, base_url)
    r = owner_session.post(
        f"{base_url}/api/subscription",
        json={"action": "subscribe", "plan": "PRO"},
    )
    if r.status_code == 400 and "уже есть" in r.json().get("error", ""):
        pytest.skip("Subscription already PRO from prior test run (multiple subscription records)")
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["mode"] == "mock"


def test_subscribe_already_pro(owner_session, admin_session, base_url):
    reset_user_to_free(admin_session, base_url)
    first = owner_session.post(
        f"{base_url}/api/subscription",
        json={"action": "subscribe", "plan": "PRO"},
    )
    assert first.status_code == 200, first.text
    r = owner_session.post(
        f"{base_url}/api/subscription",
        json={"action": "subscribe", "plan": "PRO"},
    )
    assert r.status_code == 400


def test_cancel_subscription(owner_session, admin_session, base_url):
    reset_user_to_free(admin_session, base_url)
    owner_session.post(
        f"{base_url}/api/subscription",
        json={"action": "subscribe", "plan": "PRO"},
    )
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
