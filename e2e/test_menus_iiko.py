"""E2E: iiko menu integration (discover auth). Order submission to iiko is not tested."""

import requests as req_lib


def test_iiko_discover_unauthorized(base_url):
    r = req_lib.post(
        f"{base_url}/api/menus/iiko/discover",
        json={"apiLogin": "test", "establishmentId": "x"},
    )
    assert r.status_code == 401


def test_iiko_preview_unauthorized(base_url):
    r = req_lib.post(
        f"{base_url}/api/menus/iiko/preview",
        json={"menuId": "x"},
    )
    assert r.status_code == 401


def test_iiko_discover_requires_login(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/menus/iiko/discover",
        json={"establishmentId": owner_establishment_id},
    )
    assert r.status_code == 400


def test_save_iiko_menu_source_pro(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/menus",
        json={
            "establishmentId": owner_establishment_id,
            "title": "iiko test menu",
            "source": "IIKO",
            "iikoApiLogin": "not-a-real-key",
            "iikoOrganizationId": "org-1",
            "iikoExternalMenuId": "82415",
            "linkAsPrimary": False,
        },
    )
    assert r.status_code == 200
    menu = r.json()["menu"]
    assert menu["source"] == "IIKO"
    assert menu.get("iikoApiLoginSaved") is True
    assert "iikoApiLogin" not in menu


def test_create_manual_menu_still_works(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/menus",
        json={
            "establishmentId": owner_establishment_id,
            "title": "Manual menu",
            "source": "MANUAL",
            "items": [{"name": "Чай", "price": "100"}],
            "linkAsPrimary": False,
        },
    )
    assert r.status_code == 200
    menu = r.json()["menu"]
    assert menu.get("source", "MANUAL") == "MANUAL"
    assert "iikoApiLogin" not in menu
