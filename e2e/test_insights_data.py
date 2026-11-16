"""Пакет данных для недельного ИИ-отчёта: GET /api/cron/insights-data."""
import os
import uuid

import requests as req_lib

SECRET = os.environ.get("INSIGHTS_DATA_SECRET", "test-insights-secret-for-e2e")
CRON_SECRET = os.environ.get("CRON_SECRET", "test-cron-secret-for-e2e")


def _get(base_url, token=None, params=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return req_lib.get(
        f"{base_url}/api/cron/insights-data", headers=headers, params=params, timeout=120
    )


def test_requires_secret(base_url):
    assert _get(base_url).status_code == 401
    assert _get(base_url, "wrong").status_code == 401


def test_cron_secret_is_not_enough(base_url):
    # Агенту выдаётся отдельный секрет, общий CRON_SECRET сюда не пускает.
    assert _get(base_url, CRON_SECRET).status_code == 401


def test_query_secret_not_accepted(base_url):
    r = req_lib.get(f"{base_url}/api/cron/insights-data", params={"secret": SECRET}, timeout=30)
    assert r.status_code == 401


def test_invalid_reference_date(base_url):
    assert _get(base_url, SECRET, {"referenceDate": "not-a-date"}).status_code == 400


def test_returns_week_pack_without_pii(base_url):
    email = f"insights-{uuid.uuid4().hex[:8]}@test.example.com"
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": "secure123", "name": "Insights User", "consentPd": True},
    )
    assert r.status_code == 200, r.text

    # Неделя, в которую попала эта регистрация.
    r = _get(base_url, SECRET, {"referenceDate": "2099-01-01T00:00:00Z"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["period"]["timezone"] == "Europe/Moscow"
    for key in ("weekly", "trend", "funnel", "setupFormFailures", "feedback", "metrika"):
        assert key in data

    r = _get(base_url, SECRET)
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["trend"]) == 6
    assert "registrations" in data["weekly"]
    assert "users" not in data["funnel"]
    assert "topEstablishments" not in data["weekly"]
    assert "topQrcodes" not in data["weekly"]
    # Без токена Метрики блок пропускается, а не роняет ответ.
    assert data["metrika"]["ok"] in (True, False)
    assert email not in r.text
    assert "@test.example.com" not in r.text
