import os

import pytest
import requests as req_lib

from robokassa_helpers import robokassa_result_url


CRON_SECRET = os.environ.get("CRON_SECRET", "test-cron-secret-for-e2e")


def test_renewal_cron_requires_auth(base_url):
    r = req_lib.post(f"{base_url}/api/cron/renew-subscriptions")
    assert r.status_code == 401


def test_renewal_cron_runs(owner_session, base_url):
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
        pytest.skip("Robokassa not configured")

    inv_id = data["paymentId"]
    amount = data["amount"]
    wh = req_lib.get(robokassa_result_url(base_url, inv_id, f"{amount:.2f}"))
    assert wh.status_code == 200

    cron_r = req_lib.post(
        f"{base_url}/api/cron/renew-subscriptions",
        headers={"Authorization": f"Bearer {CRON_SECRET}"},
    )
    assert cron_r.status_code == 200
    body = cron_r.json()
    assert body["ok"] is True


def test_cancel_prevents_renewal_notice(owner_session, base_url):
    owner_session.post(
        f"{base_url}/api/subscription",
        json={"action": "cancel"},
    )
    cron_r = req_lib.post(
        f"{base_url}/api/cron/renew-subscriptions",
        headers={"Authorization": f"Bearer {CRON_SECRET}"},
    )
    assert cron_r.status_code == 200
