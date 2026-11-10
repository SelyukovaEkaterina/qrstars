import pytest
import time
import requests as req_lib


def test_activate_already_active(base_url):
    r = req_lib.post(
        f"{base_url}/api/activate/abc12345",
        json={
            "establishmentName": "Test",
            "email": "test@test.com",
            "yandexMapsUrl": "https://yandex.ru/maps/test",
        },
    )
    assert r.status_code == 404


def test_activate_new_user_full_flow(base_url, http):
    from conftest import login

    admin_s = req_lib.Session()
    csrf_resp = admin_s.get(f"{base_url}/api/auth/csrf")
    csrf_token = csrf_resp.json()["csrfToken"]

    login(admin_s, base_url, "admin@smartreview.ru", "admin1234")

    create_r = admin_s.post(
        f"{base_url}/api/admin/generate-codes",
        json={"count": 1},
    )
    assert create_r.status_code == 200
    codes = create_r.json().get("codes", [])
    assert len(codes) > 0
    new_code = codes[0]["code"]

    r = req_lib.post(
        f"{base_url}/api/activate/{new_code}",
        json={
            "establishmentName": "E2E Test Cafe",
            "email": f"e2e-test-{int(time.time())}@test.com",
            "password": "testpass123",
            "ownerName": "E2E Tester",
            "phone": "+79991112233",
            "yandexMapsUrl": "https://yandex.ru/maps/org/e2e-test",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["establishmentId"] is not None


def test_activate_missing_fields(base_url):
    r = req_lib.post(
        f"{base_url}/api/activate/xyz99999",
        json={"email": "test@test.com"},
    )
    assert r.status_code == 400


def _generate_plate_code(base_url):
    from conftest import login

    admin_s = req_lib.Session()
    login(admin_s, base_url, "admin@smartreview.ru", "admin1234")
    r = admin_s.post(f"{base_url}/api/admin/generate-codes", json={"count": 1})
    assert r.status_code == 200, r.text
    return r.json()["codes"][0]["code"]


def test_activate_ignores_foreign_qrcode_id(base_url, owner_session, owner_establishment_id):
    """qrCodeId из тела не должен перепривязывать чужой QR (захват кода)."""
    from conftest import find_qrcode_by_code, unique_code

    victim_code = unique_code("victim")
    created = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={"code": victim_code, "establishmentId": owner_establishment_id},
    )
    assert created.status_code == 200, created.text
    victim_id = created.json()["qrcode"]["id"]

    plate = _generate_plate_code(base_url)
    r = req_lib.post(
        f"{base_url}/api/activate/{plate}",
        json={
            "qrCodeId": victim_id,
            "establishmentName": "Attacker Cafe",
            "email": f"e2e-attacker-{int(time.time() * 1000)}@test.com",
            "password": "testpass123",
        },
    )
    assert r.status_code == 200, r.text
    attacker_est = r.json()["establishmentId"]

    victim = find_qrcode_by_code(owner_session, base_url, victim_code, owner_establishment_id)
    assert victim is not None, "QR владельца переехал в чужой проект"
    assert victim["establishmentId"] == owner_establishment_id
    assert attacker_est != owner_establishment_id

    # Табличка активирована сама — повторно её не занять.
    again = req_lib.post(
        f"{base_url}/api/activate/{plate}",
        json={"establishmentName": "Again", "email": "again@test.com", "password": "x1234567"},
    )
    assert again.status_code == 404


def test_activate_existing_email_requires_password(base_url):
    plate = _generate_plate_code(base_url)
    r = req_lib.post(
        f"{base_url}/api/activate/{plate}",
        json={
            "establishmentName": "Not My Account",
            "email": "demo@smartreview.ru",
            "password": "wrong-password",
        },
    )
    assert r.status_code == 401
    # Табличка осталась свободной — владелец может активировать её после входа.
    ok = req_lib.post(
        f"{base_url}/api/activate/{plate}",
        json={
            "establishmentName": "Fresh Owner",
            "email": f"e2e-fresh-{int(time.time() * 1000)}@test.com",
            "password": "testpass123",
        },
    )
    assert ok.status_code == 200, ok.text


def test_activate_rejects_javascript_platform_url(base_url):
    plate = _generate_plate_code(base_url)
    r = req_lib.post(
        f"{base_url}/api/activate/{plate}",
        json={
            "establishmentName": "XSS Cafe",
            "email": f"e2e-xss-{int(time.time() * 1000)}@test.com",
            "password": "testpass123",
            "twoGisUrl": "javascript:alert(document.cookie)",
        },
    )
    assert r.status_code == 400
