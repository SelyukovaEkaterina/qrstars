"""Демо QR-коды зашиты в код (префикс demo- / demo2-), не требуют БД."""

import pytest


DEMO_SLUGS = [
    "demo-landing",
    "demo-review",
    "demo-redirect",
    "demo-business-card",
    "demo-wifi",
    "demo-file",
    "demo-menu",
]

DEMO2_SLUGS = [
    "demo2-landing",
    "demo2-review",
    "demo2-redirect",
    "demo2-business-card",
    "demo2-wifi",
    "demo2-file",
    "demo2-menu",
]


# ── Набор 1: Кофейня «Бобр» ──────────────────────────────────────────


@pytest.mark.parametrize("slug", DEMO_SLUGS)
def test_demo_scan_api_returns_payload(http, base_url, slug):
    r = http.get(f"{base_url}/api/scan/{slug}")
    assert r.status_code == 200
    data = r.json()
    assert data.get("demo") is True
    assert data.get("needsActivation") is False


def test_demo_landing_page_loads(http, base_url):
    r = http.get(f"{base_url}/scan/demo-landing", allow_redirects=True)
    assert r.status_code == 200
    assert "Выберите, что вам нужно" in r.text
    assert "QR-Меню" in r.text
    assert "Сбор отзывов" in r.text


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


# ── Набор 2: Шиномонтаж «Колесо» ─────────────────────────────────────


@pytest.mark.parametrize("slug", DEMO2_SLUGS)
def test_demo2_scan_api_returns_payload(http, base_url, slug):
    r = http.get(f"{base_url}/api/scan/{slug}")
    assert r.status_code == 200
    data = r.json()
    assert data.get("demo") is True
    assert data.get("needsActivation") is False


def test_demo2_landing_page_loads(http, base_url):
    r = http.get(f"{base_url}/scan/demo2-landing", allow_redirects=True)
    assert r.status_code == 200
    assert "Колесо" in r.text
    assert "QR-Меню" in r.text or "Услуги" in r.text
    assert "Сбор отзывов" in r.text


def test_demo2_landing_shows_tire_content(http, base_url):
    r = http.get(f"{base_url}/scan/demo2-landing", allow_redirects=True)
    assert r.status_code == 200
    assert "Шиномонтаж" in r.text
    assert "О нас" in r.text or "О нашем" in r.text


def test_demo2_menu_page_loads(http, base_url):
    r = http.get(f"{base_url}/scan/demo2-menu", allow_redirects=True)
    assert r.status_code == 200
    assert "Колесо" in r.text
    assert "Балансировка" in r.text or "Сезонная замена" in r.text


def test_demo2_review_page_loads(http, base_url):
    r = http.get(f"{base_url}/scan/demo2-review", allow_redirects=True)
    assert r.status_code == 200
    assert "Колесо" in r.text or "понравилось" in r.text


def test_demo2_business_card_loads(http, base_url):
    r = http.get(f"{base_url}/scan/demo2-business-card", allow_redirects=True)
    assert r.status_code == 200
    assert "Дмитрий" in r.text
    assert "Колесо" in r.text


def test_demo2_wifi_page_loads(http, base_url):
    r = http.get(f"{base_url}/scan/demo2-wifi", allow_redirects=True)
    assert r.status_code == 200
    assert "Koleso-Guest" in r.text
    assert "Скопировать пароль" in r.text


def test_demo2_file_page_loads(http, base_url):
    r = http.get(f"{base_url}/scan/demo2-file", allow_redirects=True)
    assert r.status_code == 200
    assert "прайс" in r.text.lower() or "pdf" in r.text.lower() or "Скачать" in r.text


def test_demo2_review_submit_is_noop(http, base_url):
    r = http.post(
        f"{base_url}/api/reviews",
        json={
            "establishmentId": "demo2",
            "qrCodeId": "demo2-review",
            "rating": 3,
            "comment": "e2e demo2 negative",
            "isNegative": True,
        },
    )
    assert r.status_code == 200
    assert r.json().get("demo") is True
