import time

import pytest

from conftest import login


def test_get_establishments_authenticated(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/establishments")
    assert r.status_code == 200
    data = r.json()
    assert "establishments" in data
    assert len(data["establishments"]) > 0

    est = data["establishments"][0]
    assert "id" in est
    assert "name" in est
    assert "yandexMapsUrl" in est
    assert "qrcodesCount" in est
    assert "reviewsCount" in est
    assert "totalScans" in est


def test_create_establishment(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/establishments",
        json={
            "name": "E2E New Establishment",
            "yandexMapsUrl": "https://yandex.ru/maps/org/e2e-new",
            "address": "Test Address 123",
            "phone": "+79998887766",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["establishment"]["name"] == "E2E New Establishment"
    assert data["establishment"]["yandexMapsUrl"] == "https://yandex.ru/maps/org/e2e-new"


def test_create_establishment_without_yandex_maps(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/establishments",
        json={"name": "Only Name"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["establishment"]["name"] == "Only Name"
    assert data["establishment"]["yandexMapsUrl"] is None


def test_create_establishment_missing_name(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/establishments",
        json={"yandexMapsUrl": "https://yandex.ru/maps/org/test"},
    )
    assert r.status_code == 400


def test_delete_establishment(owner_session, base_url):
    create_r = owner_session.post(
        f"{base_url}/api/establishments",
        json={
            "name": "E2E To Delete",
            "yandexMapsUrl": "https://yandex.ru/maps/org/to-delete",
        },
    )
    assert create_r.status_code == 200
    est_id = create_r.json()["establishment"]["id"]

    del_r = owner_session.delete(
        f"{base_url}/api/establishments",
        params={"id": est_id},
    )
    assert del_r.status_code == 200
    assert del_r.json()["success"] is True

    get_r = owner_session.get(f"{base_url}/api/establishments")
    ids = [e["id"] for e in get_r.json()["establishments"]]
    assert est_id not in ids


def test_delete_establishment_not_found(owner_session, base_url):
    r = owner_session.delete(
        f"{base_url}/api/establishments",
        params={"id": "nonexistentid"},
    )
    assert r.status_code == 404


def test_delete_establishment_missing_id(owner_session, base_url):
    r = owner_session.delete(f"{base_url}/api/establishments")
    assert r.status_code == 400


def test_create_first_establishment_auto_links_qr(http, base_url):
    """При создании первой организации непривязанный QR привязывается автоматически."""
    email = f"e2e-onboard-{int(time.time())}@test.local"
    password = "testpass123"

    reg = http.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": password,
            "name": "E2E Onboard",
            "consentPd": True,
        },
    )
    assert reg.status_code == 200, reg.text

    session = login(http, base_url, email, password)

    qr_r = session.post(
        f"{base_url}/api/qrcodes",
        json={"code": f"e2elink{int(time.time()) % 100000}"},
    )
    assert qr_r.status_code == 200, qr_r.text
    qr_id = qr_r.json()["qrcode"]["id"]

    est_r = session.post(
        f"{base_url}/api/establishments",
        json={
            "name": "E2E First Org",
            "yandexMapsUrl": "https://yandex.ru/maps/org/e2e-first",
            "qrCodeId": qr_id,
        },
    )
    assert est_r.status_code == 200, est_r.text
    data = est_r.json()
    assert data["linkedQrId"] == qr_id

    qr_get = session.get(f"{base_url}/api/qrcodes", params={"id": qr_id})
    assert qr_get.status_code == 200
    qr = qr_get.json()["qrcode"]
    assert qr["establishmentId"] == data["establishment"]["id"]
    assert qr["isActive"] is True
