import pytest
import requests as req_lib

from conftest import reset_user_to_free


def test_analytics_requires_pro(owner_session, admin_session, base_url):
    reset_user_to_free(admin_session, base_url)
    r = owner_session.get(f"{base_url}/api/analytics")
    assert r.status_code == 403
    assert "PRO" in r.json().get("error", "") or "pro" in r.json().get("error", "").lower()


def test_analytics_requires_auth(base_url):
    s = req_lib.Session()
    r = s.get(f"{base_url}/api/analytics")
    assert r.status_code == 401


def test_analytics_with_period_param(owner_session, admin_session, base_url):
    reset_user_to_free(admin_session, base_url)
    r = owner_session.get(f"{base_url}/api/analytics", params={"period": "7d"})
    assert r.status_code == 403


def test_analytics_with_custom_dates(owner_session, admin_session, base_url):
    reset_user_to_free(admin_session, base_url)
    r = owner_session.get(
        f"{base_url}/api/analytics",
        params={"from": "2025-01-01", "to": "2025-12-31"},
    )
    assert r.status_code == 403
