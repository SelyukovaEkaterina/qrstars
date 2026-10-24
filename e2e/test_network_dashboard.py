"""E2E: сводный дашборд сети /dashboard/network и итоги в GET /api/reviews."""

import pytest
import requests

from conftest import reset_user_to_free, set_user_plan


@pytest.fixture
def network_owner(admin_session, base_url):
    set_user_plan(admin_session, base_url, "NETWORK")
    yield
    reset_user_to_free(admin_session, base_url)


def test_network_page_requires_login(base_url):
    r = requests.get(f"{base_url}/dashboard/network", allow_redirects=False)
    assert r.status_code in (301, 302, 303, 307, 308), r.status_code
    assert "/login" in r.headers.get("Location", "")


def test_network_page_shows_upsell_on_free(admin_session, owner_session, base_url):
    reset_user_to_free(admin_session, base_url)
    r = owner_session.get(f"{base_url}/dashboard/network")
    assert r.status_code == 200
    assert "Сводка по сети" in r.text
    assert "network-upsell" in r.text
    assert "/dashboard/subscription" in r.text
    # Цена берётся из PLAN_PRICING.NETWORK
    assert "2" in r.text and "900" in r.text


def test_network_page_renders_dashboard_on_network(
    network_owner, owner_session, base_url
):
    r = owner_session.get(f"{base_url}/dashboard/network")
    assert r.status_code == 200
    assert "Сводка по сети" in r.text
    assert "network-upsell" not in r.text

    # Данные для сводного дашборда — по всем проектам без фильтра
    a = owner_session.get(f"{base_url}/api/analytics", params={"period": "30d"})
    assert a.status_code == 200, a.text
    data = a.json()
    assert "stats" in data
    assert "establishments" in data


def test_reviews_listing_returns_filter_totals(
    owner_session, base_url, owner_establishment_id
):
    r = owner_session.get(
        f"{base_url}/api/reviews",
        params={"establishmentId": owner_establishment_id, "limit": "2"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "avgRating" in data and "negativeTotal" in data
    if data["total"] > 0:
        assert 1 <= data["avgRating"] <= 5
    assert 0 <= data["negativeTotal"] <= data["total"]

    neg = owner_session.get(
        f"{base_url}/api/reviews",
        params={"establishmentId": owner_establishment_id, "negative": "false"},
    ).json()
    assert neg["negativeTotal"] == 0
