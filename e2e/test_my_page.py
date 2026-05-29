"""E2E: establishment page content (Моя страница) and LANDING QR routing."""

import pytest
import requests

from conftest import unique_code


def test_establishment_page_api_get(owner_session, base_url, owner_establishment_id):
    r = owner_session.get(
        f"{base_url}/api/establishments/{owner_establishment_id}/page"
    )
    assert r.status_code == 200
    data = r.json()
    est = data["establishment"]
    assert est["id"] == owner_establishment_id
    assert "pageModules" in est
    assert est["pageModules"]["menu"] is True


def test_establishment_page_modules_toggle(owner_session, base_url, owner_establishment_id):
    r = owner_session.put(
        f"{base_url}/api/establishments/{owner_establishment_id}/page",
        json={"pageModules": {"menu": True, "review": False, "businessCard": True, "wifi": True}},
    )
    assert r.status_code == 200
    assert r.json()["establishment"]["pageModules"]["review"] is False

    r2 = owner_session.put(
        f"{base_url}/api/establishments/{owner_establishment_id}/page",
        json={"pageModules": {"menu": True, "review": True, "businessCard": True, "wifi": True}},
    )
    assert r2.status_code == 200


def test_create_qrcode_mode_landing(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": unique_code("qrland"),
            "establishmentId": owner_establishment_id,
            "mode": "LANDING",
        },
    )
    assert r.status_code == 200
    assert r.json()["qrcode"]["mode"] == "LANDING"


def test_menu_linked_to_establishment(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/menus",
        json={
            "establishmentId": owner_establishment_id,
            "title": "Тестовое меню",
            "items": [{"name": "Борщ", "price": "300"}],
        },
    )
    assert r.status_code == 200
    menu_id = r.json()["menu"]["id"]

    page = owner_session.get(
        f"{base_url}/api/establishments/{owner_establishment_id}/page"
    ).json()
    assert page["establishment"]["menu"]["id"] == menu_id


def test_establishment_page_landing_subtitle(owner_session, base_url, owner_establishment_id):
    custom = "Добро пожаловать в нашу кофейню"
    r = owner_session.put(
        f"{base_url}/api/establishments/{owner_establishment_id}/page",
        json={"landingSubtitle": custom},
    )
    assert r.status_code == 200
    assert r.json()["establishment"]["landingSubtitle"] == custom

    r2 = owner_session.put(
        f"{base_url}/api/establishments/{owner_establishment_id}/page",
        json={"landingSubtitle": ""},
    )
    assert r2.status_code == 200
    assert r2.json()["establishment"]["landingSubtitle"] is None


def test_establishment_page_brand_color(owner_session, base_url, owner_establishment_id):
    r = owner_session.put(
        f"{base_url}/api/establishments/{owner_establishment_id}/page",
        json={"brandColor": "#059669", "pageAppearance": "dark"},
    )
    assert r.status_code == 200
    est = r.json()["establishment"]
    assert est["brandColor"] == "#059669"
    assert est["pageAppearance"] == "dark"

    r2 = owner_session.put(
        f"{base_url}/api/establishments/{owner_establishment_id}/page",
        json={"brandColor": "#4f46e5", "pageAppearance": "light"},
    )
    assert r2.status_code == 200


def test_establishment_page_api_unauthorized(base_url, owner_establishment_id):
    r = requests.get(f"{base_url}/api/establishments/{owner_establishment_id}/page")
    assert r.status_code in (401, 403)
