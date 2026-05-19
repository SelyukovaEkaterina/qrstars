import pytest
import requests as req_lib


def test_webhook_payment_succeeded(admin_session, base_url):
    users_r = admin_session.get(f"{base_url}/api/admin/users", params={"search": "demo"})
    user_id = users_r.json()["users"][0]["id"]

    r = req_lib.post(
        f"{base_url}/api/webhook/yookassa",
        json={
            "event": "payment.succeeded",
            "object": {
                "id": "test-payment-id-001",
                "metadata": {
                    "userId": user_id,
                    "type": "subscription",
                },
                "payment_method": {"id": "pm-test-001"},
            },
        },
    )
    assert r.status_code == 200
    assert r.json()["received"] is True


def test_webhook_payment_canceled(base_url):
    r = req_lib.post(
        f"{base_url}/api/webhook/yookassa",
        json={
            "event": "payment.canceled",
            "object": {
                "id": "test-payment-id-002",
                "payment_method": {"id": "pm-test-002"},
            },
        },
    )
    assert r.status_code == 200


def test_webhook_invalid_payload(base_url):
    r = req_lib.post(
        f"{base_url}/api/webhook/yookassa",
        json={"event": "payment.succeeded"},
    )
    assert r.status_code == 400


def test_webhook_no_user_id(base_url):
    r = req_lib.post(
        f"{base_url}/api/webhook/yookassa",
        json={
            "event": "payment.succeeded",
            "object": {
                "id": "test-payment-id-003",
                "metadata": {},
            },
        },
    )
    assert r.status_code == 200
    assert r.json()["received"] is True
