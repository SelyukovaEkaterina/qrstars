"""Демо QR-коды зашиты в код (префикс demo- / demo2-), не требуют БД."""

import pytest


DEMO_SLUGS = [
    "demo-landing",
    "demo-review",
    "demo-2gis",
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
    assert "Кофе на зерне собственной обжарки" in r.text
    assert "QR-Меню" in r.text
    assert "Оставить отзыв" in r.text


def test_demo_review_page_loads(http, base_url):
    r = http.get(f"{base_url}/scan/demo-review", allow_redirects=True)
    assert r.status_code == 200
    assert "Кофейня" in r.text or "понравилось" in r.text


def test_demo_2gis_routes_positive_reviews_to_2gis(http, base_url):
    api_response = http.get(f"{base_url}/api/scan/demo-2gis")
    assert api_response.status_code == 200
    data = api_response.json()
    assert data["qrCodeId"] == "demo-2gis"
    assert data["reviewRouting"]["4"]["action"] == "TWO_GIS"
    assert data["reviewRouting"]["4"]["platformList"] == [{"type": "TWO_GIS"}]
    assert data["reviewRouting"]["5"]["action"] == "TWO_GIS"
    assert data["reviewRouting"]["5"]["platformList"] == [{"type": "TWO_GIS"}]
    assert data["platformUrls"]["twoGisUrl"] == "https://2gis.ru/"

    page_response = http.get(f"{base_url}/scan/demo-2gis", allow_redirects=True)
    assert page_response.status_code == 200
    assert "Кофейня" in page_response.text or "понравилось" in page_response.text


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
    assert "Оставить отзыв" in r.text


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
