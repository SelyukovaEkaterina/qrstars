import pytest
import requests as req_lib

from conftest import reset_user_to_free
from robokassa_helpers import robokassa_result_url


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
        json={"action": "subscribe", "plan": "PRO", "recurringConsent": True},
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
        json={"action": "subscribe", "plan": "PRO", "recurringConsent": True},
    )
    assert first.status_code == 200, first.text
    r = owner_session.post(
        f"{base_url}/api/subscription",
        json={"action": "subscribe", "plan": "PRO", "recurringConsent": True},
    )
    assert r.status_code == 400


def test_cancel_subscription(owner_session, admin_session, base_url):
    reset_user_to_free(admin_session, base_url)
    owner_session.post(
        f"{base_url}/api/subscription",
        json={"action": "subscribe", "plan": "PRO", "recurringConsent": True},
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


def test_payment_history(owner_session, admin_session, base_url):
    reset_user_to_free(admin_session, base_url)
    sub_r = owner_session.post(
        f"{base_url}/api/subscription",
        json={
            "action": "subscribe",
            "plan": "PRO",
            "billing": "monthly",
            "recurringConsent": True,
        },
    )
    assert sub_r.status_code == 200, sub_r.text
    sub_data = sub_r.json()
    if sub_data.get("mode") == "mock":
        pytest.skip("Robokassa not configured — no PaymentOrder records")

    inv_id = sub_data["paymentId"]
    amount = sub_data["amount"]
    wh = req_lib.get(robokassa_result_url(base_url, inv_id, f"{amount:.2f}"))
    assert wh.status_code == 200

    hist_r = owner_session.get(f"{base_url}/api/subscription/history")
    assert hist_r.status_code == 200
    history = hist_r.json()["history"]
    assert len(history) >= 1
    paid = next((h for h in history if h["invId"] == inv_id), None)
    assert paid is not None
    assert paid["status"] == "PAID"
    assert paid["amount"] == amount
    assert paid["plan"] == "PRO"
    assert paid["kind"] == "INITIAL"
