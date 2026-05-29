import uuid
import requests as req_lib


def unique_email(prefix="e2e"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@test.example.com"


def test_register_success(base_url):
    email = unique_email("reg")
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": "secure123",
            "name": "E2E User",
            "consentPd": True,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert "user" in data
    assert data["user"]["email"] == email


def test_register_without_consent(base_url):
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={
            "email": unique_email(),
            "password": "secure123",
            "consentPd": False,
        },
    )
    assert r.status_code == 400


def test_register_missing_email(base_url):
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"password": "secure123", "consentPd": True},
    )
    assert r.status_code == 400


def test_register_missing_password(base_url):
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": unique_email(), "consentPd": True},
    )
    assert r.status_code == 400


def test_register_short_password(base_url):
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": unique_email(), "password": "12345", "consentPd": True},
    )
    assert r.status_code == 400


def test_register_duplicate_email(base_url):
    email = unique_email("dup")
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": "secure123", "consentPd": True},
    )
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": "anotherpass", "consentPd": True},
    )
    assert r.status_code == 409


def test_register_with_referral_code(base_url):
    from conftest import login

    partner_email = unique_email("partner")
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": partner_email, "password": "pass1234", "consentPd": True},
    )
    s = req_lib.Session()
    login(s, base_url, partner_email, "pass1234")
    partner_r = s.get(f"{base_url}/api/partner")
    ref_code = partner_r.json()["referralCode"]

    new_email = unique_email("referred")
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={
            "email": new_email,
            "password": "pass1234",
            "consentPd": True,
            "ref": ref_code,
        },
    )
    assert r.status_code == 200


def test_forgot_password_known_email(base_url):
    r = req_lib.post(
        f"{base_url}/api/auth/forgot-password",
        json={"email": "demo@smartreview.ru"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is True


def test_forgot_password_unknown_email(base_url):
    r = req_lib.post(
        f"{base_url}/api/auth/forgot-password",
        json={"email": "nobody@nowhere.example.com"},
    )
    assert r.status_code == 200
    assert r.json().get("success") is True


def test_forgot_password_missing_email(base_url):
    r = req_lib.post(f"{base_url}/api/auth/forgot-password", json={})
    assert r.status_code == 400


def test_reset_password_invalid_token(base_url):
    r = req_lib.post(
        f"{base_url}/api/auth/reset-password",
        json={"token": "completely-invalid-token", "password": "newpassword123"},
    )
    assert r.status_code == 400


def test_reset_password_missing_fields(base_url):
    r = req_lib.post(
        f"{base_url}/api/auth/reset-password",
        json={"token": "sometoken"},
    )
    assert r.status_code == 400


def test_reset_password_short_password(base_url):
    r = req_lib.post(
        f"{base_url}/api/auth/reset-password",
        json={"token": "sometoken", "password": "123"},
    )
    assert r.status_code == 400
