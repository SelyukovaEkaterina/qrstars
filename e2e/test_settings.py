import pytest
import requests as req_lib


def test_get_settings_authenticated(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/settings")
    assert r.status_code == 200
    data = r.json()
    assert "establishments" in data
    assert len(data["establishments"]) > 0

    est = data["establishments"][0]
    assert "id" in est
    assert "name" in est
    assert "yandexMapsUrl" in est
    assert "platformRotation" in est
    assert "watermarkEnabled" in est
    assert "tipsEnabled" in est


def test_update_settings(owner_session, base_url, owner_establishment_id):
    r = owner_session.put(
        f"{base_url}/api/settings",
        json={
            "id": owner_establishment_id,
            "name": "Updated Name",
            "address": "New Address",
            "yandexMapsUrl": "https://yandex.ru/maps/org/updated",
            "twoGisUrl": "https://2gis.ru/updated",
            "platformRotation": True,
            "watermarkEnabled": False,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["establishment"]["name"] == "Updated Name"
    assert data["establishment"]["platformRotation"] is True
    assert data["establishment"]["watermarkEnabled"] is False

    r2 = owner_session.put(
        f"{base_url}/api/settings",
        json={
            "id": owner_establishment_id,
            "name": "Кофейня «Бобр»",
            "address": "г. Москва, ул. Примерная, 42",
            "yandexMapsUrl": "https://yandex.ru/maps/org/coffee_bobr/12345",
            "twoGisUrl": "https://2gis.ru/moscow/branches/12345",
            "platformRotation": False,
            "watermarkEnabled": True,
        },
    )
    assert r2.status_code == 200


def test_update_settings_not_found(owner_session, base_url):
    r = owner_session.put(
        f"{base_url}/api/settings",
        json={
            "id": "nonexistent",
            "name": "Test",
        },
    )
    assert r.status_code == 404


def test_settings_unauthenticated(base_url):
    s = req_lib.Session()
    r = s.get(f"{base_url}/api/settings")
    assert r.status_code == 401
