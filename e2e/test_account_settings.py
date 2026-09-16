import uuid

import requests

from conftest import login


def _registered_session(base_url):
    email = f"account-{uuid.uuid4().hex[:8]}@test.example.com"
    password = "secure123"
    registration = requests.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": password,
            "name": "Account Settings",
            "consentPd": True,
        },
    )
    assert registration.status_code == 200, registration.text
    session = requests.Session()
    login(session, base_url, email, password)
    return session, email, password


def test_change_password_requires_current_password(base_url):
    session, _, _ = _registered_session(base_url)
    response = session.post(
        f"{base_url}/api/account/password",
        json={"currentPassword": "wrong-password", "newPassword": "new-secure-123"},
    )
    assert response.status_code == 400
    assert "неверно" in response.json()["error"]


def test_change_password_and_login_with_new_password(base_url):
    session, email, old_password = _registered_session(base_url)
    new_password = "new-secure-123"
    response = session.post(
        f"{base_url}/api/account/password",
        json={"currentPassword": old_password, "newPassword": new_password},
    )
    assert response.status_code == 200, response.text

    new_session = requests.Session()
    login(new_session, base_url, email, new_password)


def test_delete_request_requires_auth_and_is_idempotent(base_url):
    unauthorized = requests.post(f"{base_url}/api/account/delete-request")
    assert unauthorized.status_code == 401

    session, _, _ = _registered_session(base_url)
    first = session.post(f"{base_url}/api/account/delete-request")
    assert first.status_code == 200, first.text
    assert first.json()["alreadyRequested"] is False

    second = session.post(f"{base_url}/api/account/delete-request")
    assert second.status_code == 200, second.text
    assert second.json()["alreadyRequested"] is True
