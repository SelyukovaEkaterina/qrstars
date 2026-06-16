import pytest
import requests as req_lib

from robokassa_helpers import robokassa_result_url


def test_webhook_payment_succeeded(admin_session, owner_session, base_url):
    reset_r = owner_session.post(
        f"{base_url}/api/subscription",
        json={
            "action": "subscribe",
            "plan": "PRO",
            "billing": "monthly",
            "recurringConsent": True,
        },
    )
    assert reset_r.status_code == 200, reset_r.text
    data = reset_r.json()
    if data.get("mode") == "mock":
        pytest.skip("Robokassa not configured in test env")
    inv_id = data["paymentId"]
    amount = data["amount"]
    out_sum = f"{amount:.2f}"

    r = req_lib.get(robokassa_result_url(base_url, inv_id, out_sum))
    assert r.status_code == 200
    assert r.text == f"OK{inv_id}"


def test_webhook_invalid_signature(base_url):
    r = req_lib.get(
        f"{base_url}/api/webhook/robokassa/result",
        params={"OutSum": "690.00", "InvId": "999999", "SignatureValue": "invalid"},
    )
    assert r.status_code in (403, 404)


def test_webhook_missing_params(base_url):
    r = req_lib.get(f"{base_url}/api/webhook/robokassa/result")
    assert r.status_code == 400


def test_webhook_idempotent(owner_session, base_url):
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
    data = sub_r.json()
    if data.get("mode") == "mock":
        pytest.skip("Robokassa not configured in test env")
    inv_id = data["paymentId"]
    out_sum = f"{data['amount']:.2f}"
    url = robokassa_result_url(base_url, inv_id, out_sum)

    r1 = req_lib.get(url)
    r2 = req_lib.get(url)
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.text == f"OK{inv_id}"
    assert r2.text == f"OK{inv_id}"
