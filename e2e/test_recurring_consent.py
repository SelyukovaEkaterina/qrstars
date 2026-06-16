import pytest
import requests as req_lib

from conftest import reset_user_to_free


def test_subscribe_requires_recurring_consent(owner_session, admin_session, base_url):
    reset_user_to_free(admin_session, base_url)
    r = owner_session.post(
        f"{base_url}/api/subscription",
        json={"action": "subscribe", "plan": "PRO"},
    )
    assert r.status_code == 400
    assert "согласие" in r.json().get("error", "").lower()


def test_subscribe_mock_with_consent(owner_session, admin_session, base_url):
    reset_user_to_free(admin_session, base_url)
    r = owner_session.post(
        f"{base_url}/api/subscription",
        json={
            "action": "subscribe",
            "plan": "PRO",
            "billing": "monthly",
            "recurringConsent": True,
        },
    )
    if r.status_code == 400 and "уже есть" in r.json().get("error", ""):
        pytest.skip("Subscription already PRO from prior test run")
    assert r.status_code == 200
    data = r.json()
    if "paymentRedirectUrl" in data or "paymentPost" in data or "paymentUrl" in data:
        pytest.skip("Robokassa configured — mock path not used")
    assert data["success"] is True
    assert data["mode"] == "mock"
