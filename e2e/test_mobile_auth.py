"""E2E tests for mobile auth (bearer token) and /api/qrcodes via mobile token."""

import uuid

import pytest
import requests

from conftest import login


BASE_CREDENTIALS = ("demo@smartreview.ru", "demo1234")


def test_mobile_login_success(base_url):
    """POST /api/auth/mobile-login with valid credentials returns JWT token."""
    r = requests.post(
        f"{base_url}/api/auth/mobile-login",
        json={"email": BASE_CREDENTIALS[0], "password": BASE_CREDENTIALS[1]},
        timeout=10,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert "token" in data
    assert len(data["token"]) > 50
    assert data["user"]["email"] == BASE_CREDENTIALS[0]
    assert data["user"]["id"]


def test_mobile_login_wrong_password(base_url):
    """Wrong password → 401."""
    r = requests.post(
        f"{base_url}/api/auth/mobile-login",
        json={"email": BASE_CREDENTIALS[0], "password": "wrong-password-xyz"},
        timeout=10,
    )
    assert r.status_code == 401


def test_mobile_login_nonexistent_user(base_url):
    """Non-existent email → 401."""
    r = requests.post(
        f"{base_url}/api/auth/mobile-login",
        json={"email": f"no-such-user-{uuid.uuid4().hex[:8]}@example.com", "password": "whatever"},
        timeout=10,
    )
    assert r.status_code == 401


def test_mobile_login_missing_fields(base_url):
    """Missing email or password → 400."""
    r = requests.post(
        f"{base_url}/api/auth/mobile-login",
        json={"email": BASE_CREDENTIALS[0]},
        timeout=10,
    )
    assert r.status_code == 400


def test_mobile_login_cors_preflight(base_url):
    """OPTIONS preflight returns CORS headers."""
    r = requests.options(
        f"{base_url}/api/auth/mobile-login",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization, content-type",
        },
        timeout=10,
    )
    assert r.status_code == 200
    assert "access-control-allow-origin" in {k.lower() for k in r.headers.keys()}


def _get_mobile_token(base_url):
    """Helper: get a valid mobile token."""
    r = requests.post(
        f"{base_url}/api/auth/mobile-login",
        json={"email": BASE_CREDENTIALS[0], "password": BASE_CREDENTIALS[1]},
        timeout=10,
    )
    assert r.status_code == 200
    return r.json()["token"]


def test_qrcodes_list_with_bearer_token(base_url):
    """GET /api/qrcodes with Bearer token (no cookie) → 200."""
    token = _get_mobile_token(base_url)
    r = requests.get(
        f"{base_url}/api/qrcodes",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    assert r.status_code == 200, f"Bearer auth failed: {r.status_code} {r.text}"
    data = r.json()
    assert "qrcodes" in data
    assert isinstance(data["qrcodes"], list)


def test_qrcodes_create_with_bearer_token(base_url):
    """POST /api/qrcodes with Bearer token creates a REDIRECT QR."""
    token = _get_mobile_token(base_url)
    label = f"mobile-e2e-{uuid.uuid4().hex[:8]}"
    r = requests.post(
        f"{base_url}/api/qrcodes",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "label": label,
            "mode": "REDIRECT",
            "redirectUrl": "https://example.com/mobile-test",
        },
        timeout=10,
    )
    assert r.status_code == 200, f"Create failed: {r.status_code} {r.text}"
    qr = r.json()["qrcode"]
    assert qr["mode"] == "REDIRECT"
    assert qr["redirectUrl"] == "https://example.com/mobile-test"
    assert qr["isActive"] is True

    # Cleanup: we can't delete easily, but the code is random so no conflict


def test_qrcodes_edit_redirect_with_bearer_token(base_url):
    """PUT /api/qrcodes with Bearer token edits redirectUrl (dynamic QR)."""
    token = _get_mobile_token(base_url)

    # Create
    label = f"mobile-edit-{uuid.uuid4().hex[:8]}"
    create_r = requests.post(
        f"{base_url}/api/qrcodes",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"label": label, "mode": "REDIRECT", "redirectUrl": "https://before.example.com"},
        timeout=10,
    )
    assert create_r.status_code == 200
    qr_id = create_r.json()["qrcode"]["id"]

    # Edit redirectUrl
    new_url = "https://after.example.com/changed"
    put_r = requests.put(
        f"{base_url}/api/qrcodes",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"id": qr_id, "redirectUrl": new_url},
        timeout=10,
    )
    assert put_r.status_code == 200, f"Edit failed: {put_r.status_code} {put_r.text}"
    updated = put_r.json()["qrcode"]
    assert updated["redirectUrl"] == new_url


def test_qrcodes_invalid_bearer_token(base_url):
    """Invalid bearer token → 401."""
    r = requests.get(
        f"{base_url}/api/qrcodes",
        headers={"Authorization": "Bearer invalid-token-string"},
        timeout=10,
    )
    assert r.status_code == 401


def test_qrcodes_no_auth(base_url):
    """No auth at all → 401."""
    r = requests.get(f"{base_url}/api/qrcodes", timeout=10)
    assert r.status_code == 401


def test_web_session_still_works(base_url, owner_session):
    """Web session (cookie auth) still works after refactor — no regression."""
    r = owner_session.get(f"{base_url}/api/qrcodes", timeout=10)
    assert r.status_code == 200
    assert "qrcodes" in r.json()
