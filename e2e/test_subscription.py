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


def _pay(base_url, checkout):
    """Оплата заказа через ResultURL Robokassa (в mock-режиме подписка уже активна)."""
    if checkout.get("mode") == "mock":
        return
    inv_id = checkout["paymentId"]
    r = req_lib.get(robokassa_result_url(base_url, inv_id, f"{checkout['amount']:.2f}"))
    assert r.status_code == 200 and r.text == f"OK{inv_id}", r.text


def test_subscribe_checkout(owner_session, admin_session, base_url):
    reset_user_to_free(admin_session, base_url)
    r = owner_session.post(
        f"{base_url}/api/subscription",
        json={"action": "subscribe", "plan": "PRO", "recurringConsent": True},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    if data.get("mode") == "mock":
        assert data["success"] is True
        return
    # Robokassa настроена: заказ создан, оплата — на стороне кассы
    assert data["paymentId"]
    assert data["amount"] > 0
    assert data.get("paymentRedirectUrl") or data.get("paymentPost")
    # До оплаты тариф не меняется
    assert owner_session.get(f"{base_url}/api/subscription").json()["plan"] == "FREE"


def test_subscribe_already_pro(owner_session, admin_session, base_url):
    reset_user_to_free(admin_session, base_url)
    first = owner_session.post(
        f"{base_url}/api/subscription",
        json={"action": "subscribe", "plan": "PRO", "recurringConsent": True},
    )
    assert first.status_code == 200, first.text
    _pay(base_url, first.json())
    assert owner_session.get(f"{base_url}/api/subscription").json()["plan"] == "PRO"
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


def test_upgrade_checkout_keeps_pro_until_paid(admin_session, base_url):
    """Брошенный чекаут PRO → «Сеть» не должен отнимать оплаченный PRO."""
    import time as _time
    from conftest import login, set_user_plan

    email = f"e2e-upgrade-{int(_time.time() * 1000)}@test.com"
    reg = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": "secure123", "name": "Upgrade", "consentPd": True},
    )
    assert reg.status_code == 200, reg.text
    set_user_plan(admin_session, base_url, "PRO", email=email)

    s = req_lib.Session()
    login(s, base_url, email, "secure123")
    assert s.get(f"{base_url}/api/subscription").json()["plan"] == "PRO"

    r = s.post(
        f"{base_url}/api/subscription",
        json={"action": "subscribe", "plan": "NETWORK", "billing": "yearly", "recurringConsent": True},
    )
    assert r.status_code == 200, r.text
    after = s.get(f"{base_url}/api/subscription").json()
    if r.json().get("mode") == "mock":
        # Mock-оплата проходит сразу: «Сеть» активна, PRO погашен.
        assert after["plan"] == "NETWORK"
    else:
        # Оплата ещё не пришла — PRO на месте.
        assert after["plan"] == "PRO"
