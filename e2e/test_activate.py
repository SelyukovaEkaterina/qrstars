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
