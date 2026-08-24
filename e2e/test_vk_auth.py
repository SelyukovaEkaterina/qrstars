import uuid

import requests


ORIGIN = "http://localhost:3000"
CODE_VERIFIER = "a" * 64


def vk_code(vk_id, email, first_name="Иван", last_name="Иванов"):
    return f"valid|{vk_id}|{email}|{first_name}|{last_name}"


def vk_login(session, base_url, code):
    return session.post(
        f"{base_url}/auth/vk",
        headers={"Origin": ORIGIN},
        json={
            "code": code,
            "deviceId": "e2e-device",
            "codeVerifier": CODE_VERIFIER,
            "state": "e2e-state",
        },
    )


def test_vk_login_creates_passwordless_user_and_session(base_url):
    suffix = uuid.uuid4().hex[:10]
    email = f"vk-{suffix}@test.example.com"
    session = requests.Session()

    response = vk_login(session, base_url, vk_code(suffix, email))

    assert response.status_code == 200
    assert response.json()["success"] is True
    profile = session.get(f"{base_url}/api/auth/session").json()["user"]
    assert profile["email"] == email
    assert profile["name"] == "Иван Иванов"


def test_vk_login_links_existing_user_by_email(base_url):
    suffix = uuid.uuid4().hex[:10]
    email = f"vk-link-{suffix}@test.example.com"
    registration = requests.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": "secure123",
            "name": "Существующий пользователь",
            "consentPd": True,
        },
    )
    assert registration.status_code == 200
    existing_id = registration.json()["user"]["id"]

    session = requests.Session()
    response = vk_login(session, base_url, vk_code(suffix, email, "Новое", "Имя"))

    assert response.status_code == 200
    profile = session.get(f"{base_url}/api/auth/session").json()["user"]
    assert profile["id"] == existing_id
    assert profile["email"] == email
    assert profile["name"] == "Существующий пользователь"


def test_vk_login_rejects_invalid_authorization_code(base_url):
    session = requests.Session()
    response = vk_login(session, base_url, "invalid-code")

    assert response.status_code == 401
    assert "error" in response.json()
    assert session.get(f"{base_url}/api/auth/session").json() == {}


def test_vk_login_validates_pkce_and_origin(base_url):
    without_origin = requests.post(
        f"{base_url}/auth/vk",
        json={
            "code": "valid|1|user@test.example.com|Иван|Иванов",
            "deviceId": "device",
            "codeVerifier": CODE_VERIFIER,
        },
    )
    assert without_origin.status_code == 403

    invalid_pkce = requests.post(
        f"{base_url}/auth/vk",
        headers={"Origin": ORIGIN},
        json={
            "code": "valid|1|user@test.example.com|Иван|Иванов",
            "deviceId": "device",
            "codeVerifier": "too-short",
        },
    )
    assert invalid_pkce.status_code == 400
