"""Нельзя привязать к своему QR / проекту чужие меню, визитку, Wi‑Fi (IDOR)."""
import uuid

import pytest
import requests as req_lib

from conftest import login, unique_code


@pytest.fixture(scope="module")
def stranger(base_url):
    email = f"stranger-{uuid.uuid4().hex[:8]}@test.example.com"
    password = "secure123"
    assert req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    ).status_code == 200
    s = req_lib.Session()
    login(s, base_url, email, password)
    r = s.post(
        f"{base_url}/api/setup/quick-start",
        json={"intent": "redirect", "name": "Stranger", "redirectUrl": "https://example.com", "qrLabel": "x"},
    )
    assert r.status_code == 200, r.text
    return s, r.json()["establishment"]["id"], r.json()["qrcode"]["id"]


@pytest.fixture(scope="module")
def owner_wifi(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/wifi-configs",
        json={"ssid": "Owner_Secret", "password": "owner-pass-123"},
    )
    assert r.status_code == 200, r.text
    return r.json()["wifiConfig"]["id"]


@pytest.fixture(scope="module")
def owner_card(owner_session, base_url):
    r = owner_session.post(f"{base_url}/api/business-cards", json={"fullName": "Owner Card"})
    assert r.status_code == 200, r.text
    return r.json()["businessCard"]["id"]


def test_stranger_cannot_link_foreign_wifi_to_qr(stranger, owner_wifi, base_url):
    s, _, qr_id = stranger
    r = s.put(f"{base_url}/api/qrcodes", json={"id": qr_id, "wifiConfigId": owner_wifi})
    assert r.status_code == 404


def test_stranger_cannot_link_foreign_card_to_qr(stranger, owner_card, base_url):
    s, _, qr_id = stranger
    r = s.put(f"{base_url}/api/qrcodes", json={"id": qr_id, "businessCardId": owner_card})
    assert r.status_code == 404


def test_stranger_cannot_link_foreign_wifi_to_project(stranger, owner_wifi, base_url):
    s, est_id, _ = stranger
    r = s.put(f"{base_url}/api/establishments/{est_id}/page", json={"wifiConfigId": owner_wifi})
    assert r.status_code == 404
    page = s.get(f"{base_url}/api/establishments/{est_id}/page").json()["establishment"]
    assert page.get("wifiConfig") is None


def test_stranger_cannot_link_foreign_menu_to_project(stranger, owner_session, owner_establishment_id, base_url):
    owner_page = owner_session.get(f"{base_url}/api/establishments/{owner_establishment_id}/page").json()
    menu = owner_page["establishment"].get("menu")
    if not menu:
        pytest.skip("У демо-проекта нет меню")
    s, est_id, _ = stranger
    r = s.put(f"{base_url}/api/establishments/{est_id}/page", json={"menuId": menu["id"]})
    assert r.status_code == 404


def test_owner_can_link_own_wifi(owner_session, owner_wifi, owner_establishment_id, base_url):
    code = unique_code("own-wifi")
    created = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={"code": code, "establishmentId": owner_establishment_id},
    )
    assert created.status_code == 200, created.text
    r = owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": created.json()["qrcode"]["id"], "wifiConfigId": owner_wifi},
    )
    assert r.status_code == 200, r.text


def test_test_max_rejects_foreign_user_id(stranger, base_url):
    s, _, _ = stranger
    r = s.post(f"{base_url}/api/settings", json={"action": "test-max", "userId": "123456789"})
    # Раньше бот пытался отправить сообщение на любой userId (200/500).
    assert r.status_code == 404
