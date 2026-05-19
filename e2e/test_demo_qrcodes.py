"""Демо QR-коды зашиты в код (префикс demo-), не требуют БД."""

import pytest


DEMO_SLUGS = [
    "demo-review",
    "demo-redirect",
    "demo-business-card",
    "demo-wifi",
    "demo-file",
    "demo-menu",
]


@pytest.mark.parametrize("slug", DEMO_SLUGS)
def test_demo_scan_api_returns_payload(http, base_url, slug):
    r = http.get(f"{base_url}/api/scan/{slug}")
    assert r.status_code == 200
    data = r.json()
    assert data.get("demo") is True
    assert data.get("needsActivation") is False


def test_demo_review_page_loads(http, base_url):
    r = http.get(f"{base_url}/scan/demo-review", allow_redirects=True)
    assert r.status_code == 200
    assert "Кофейня" in r.text or "понравилось" in r.text


def test_demo_wifi_page_shows_copy_actions(http, base_url):
    r = http.get(f"{base_url}/scan/demo-wifi", allow_redirects=True)
    assert r.status_code == 200
    assert "Скопировать пароль" in r.text
    assert "QrStars-Guest" in r.text
    assert "Как подключиться" in r.text


def test_demo_review_submit_is_noop(http, base_url):
    r = http.post(
        f"{base_url}/api/reviews",
        json={
            "establishmentId": "demo",
            "qrCodeId": "demo-review",
            "rating": 2,
            "comment": "e2e demo negative",
            "isNegative": True,
        },
    )
    assert r.status_code == 200
    assert r.json().get("demo") is True
