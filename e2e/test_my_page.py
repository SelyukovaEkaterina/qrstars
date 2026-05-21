"""E2E: establishment page content (Моя страница) and LANDING QR routing."""

import pytest
import requests


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
            "code": "qrmode_land01",
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


def test_establishment_page_api_unauthorized(base_url, owner_establishment_id):
    r = requests.get(f"{base_url}/api/establishments/{owner_establishment_id}/page")
    assert r.status_code in (401, 403)
