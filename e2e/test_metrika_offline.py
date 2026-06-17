import uuid

import requests as req_lib


def unique_email(prefix="utm"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@test.example.com"


def test_register_saves_utm_and_metrika_client_id(admin_session, base_url):
    email = unique_email()
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": "secure123",
            "name": "UTM User",
            "consentPd": True,
            "utm_source": "yandex",
            "utm_campaign": "reviews_search",
            "utm_content": "hero",
            "metrikaClientId": "1234567890123456789",
        },
    )
    assert r.status_code == 200, r.text
    user_id = r.json()["user"]["id"]

    detail = admin_session.get(f"{base_url}/api/admin/users/{user_id}")
    assert detail.status_code == 200, detail.text
    user = detail.json()["user"]
    assert user["registrationUtm"]["utm_source"] == "yandex"
    assert user["registrationUtm"]["utm_campaign"] == "reviews_search"
    assert user["metrikaClientId"] == "1234567890123456789"


def test_register_saves_yclid_and_ym_uid(admin_session, base_url):
    email = unique_email()
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": "secure123",
            "name": "Yclid User",
            "consentPd": True,
            "yclid": "testyclid",
            "_ym_uid": "1234567890123456789",
        },
    )
    assert r.status_code == 200, r.text
    user_id = r.json()["user"]["id"]

    detail = admin_session.get(f"{base_url}/api/admin/users/{user_id}")
    assert detail.status_code == 200, detail.text
    user = detail.json()["user"]
    assert user["registrationUtm"]["yclid"] == "testyclid"
    assert user["metrikaClientId"] == "1234567890123456789"


def test_metrika_offline_cron_requires_auth(base_url):
    r = req_lib.post(f"{base_url}/api/cron/metrika-offline-conversions")
    assert r.status_code == 401


def test_metrika_offline_cron_skips_without_token(admin_session, base_url):
    import os

    secret = os.environ.get("CRON_SECRET", "test-cron-secret")
    r = req_lib.post(
        f"{base_url}/api/cron/metrika-offline-conversions",
        headers={"Authorization": f"Bearer {secret}"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("ok") is True
    if not os.environ.get("YANDEX_METRIKA_OAUTH_TOKEN"):
        assert data.get("skipped") is True
