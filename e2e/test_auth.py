import pytest
import requests


def test_csrf_endpoint(base_url):
    r = requests.get(f"{base_url}/api/auth/csrf")
    assert r.status_code == 200
    data = r.json()
    assert "csrfToken" in data


def test_login_success(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/auth/session")
    assert r.status_code == 200
    data = r.json()
    assert data.get("user") is not None
    assert data["user"]["email"] == "demo@smartreview.ru"


def test_login_admin(admin_session, base_url):
    r = admin_session.get(f"{base_url}/api/auth/session")
    assert r.status_code == 200
    data = r.json()
    assert data["user"]["email"] == "admin@smartreview.ru"
    assert data["user"].get("role") == "ADMIN"


def test_login_wrong_password(base_url):
    s = requests.Session()
    csrf_resp = s.get(f"{base_url}/api/auth/csrf")
    csrf_token = csrf_resp.json()["csrfToken"]
    r = s.post(
        f"{base_url}/api/auth/callback/credentials",
        data={
            "email": "demo@smartreview.ru",
            "password": "wrongpassword",
            "csrfToken": csrf_token,
            "json": "true",
        },
        allow_redirects=False,
    )
    assert r.status_code in (401, 302)


def test_unauthenticated_protected_endpoint(base_url):
    s = requests.Session()
    r = s.get(f"{base_url}/api/establishments")
    assert r.status_code == 401
