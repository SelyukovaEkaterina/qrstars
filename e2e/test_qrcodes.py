import pytest

from conftest import unique_code


def test_get_qrcodes_authenticated(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/qrcodes")
    assert r.status_code == 200
    data = r.json()
    assert "qrcodes" in data
    assert isinstance(data["qrcodes"], list)


def test_get_qrcodes_by_establishment(owner_session, base_url, owner_establishment_id):
    r = owner_session.get(
        f"{base_url}/api/qrcodes",
        params={"establishmentId": owner_establishment_id},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["qrcodes"]) > 0
    for qr in data["qrcodes"]:
        assert "code" in qr
        assert "isActive" in qr


def test_get_qrcode_by_id(owner_session, base_url, owner_establishment_id):
    list_r = owner_session.get(
        f"{base_url}/api/qrcodes",
        params={"establishmentId": owner_establishment_id},
    )
    qr_id = list_r.json()["qrcodes"][0]["id"]

    r = owner_session.get(f"{base_url}/api/qrcodes", params={"id": qr_id})
    assert r.status_code == 200
    data = r.json()
    assert data["qrcode"]["id"] == qr_id


def test_get_qrcode_not_found(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/qrcodes", params={"id": "nonexistent"})
    assert r.status_code == 404


def test_create_qrcode_with_code(owner_session, base_url):
    code = unique_code("qrcrt")
    r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={"code": code},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["qrcode"]["code"] == code
    assert data["qrcode"]["isActive"] is True


def test_create_qrcode_auto_generate(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={"generate": True},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["qrcode"]["code"] is not None
    assert len(data["qrcode"]["code"]) > 0


def test_create_qrcode_duplicate(owner_session, base_url):
    code = unique_code("qrdup")
    owner_session.post(f"{base_url}/api/qrcodes", json={"code": code})
    r = owner_session.post(f"{base_url}/api/qrcodes", json={"code": code})
    assert r.status_code == 400


def test_create_qrcode_with_establishment(owner_session, base_url, owner_establishment_id):
    code = unique_code("qrest")
    r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "label": "Table 1",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["qrcode"]["isActive"] is True
    assert data["qrcode"]["label"] == "Table 1"


def test_update_qrcode(owner_session, base_url, owner_establishment_id):
    code = unique_code("qrupd")
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={"code": code, "establishmentId": owner_establishment_id},
    )
    assert create_r.status_code == 200, f"Create failed: {create_r.status_code} {create_r.text}"
    qr_id = create_r.json()["qrcode"]["id"]

    r = owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "label": "Updated Label", "mode": "REDIRECT", "redirectUrl": "https://example.com"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["qrcode"]["label"] == "Updated Label"
    assert data["qrcode"]["mode"] == "REDIRECT"


def test_update_qrcode_not_found(owner_session, base_url):
    r = owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": "nonexistent", "label": "Test"},
    )
    assert r.status_code == 404


def test_update_qrcode_missing_id(owner_session, base_url):
    r = owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"label": "Test"},
    )
    assert r.status_code == 400
