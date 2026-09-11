import uuid
from urllib.parse import parse_qs, urlparse

import requests


def yandex_code(yandex_id, email, first_name="Яна", last_name="Яндексова"):
    return f"valid|{yandex_id}|{email}|{first_name}|{last_name}"


def start_yandex_login(session, base_url):
    response = session.get(f"{base_url}/auth/yandex", allow_redirects=False)
    assert response.status_code == 307
    location = response.headers["Location"]
    assert location.startswith("https://oauth.yandex.ru/authorize?")
    return parse_qs(urlparse(location).query)["state"][0]


def finish_yandex_login(session, base_url, code, state):
    return session.get(
        f"{base_url}/auth/yandex/callback",
        params={"code": code, "state": state},
        allow_redirects=False,
    )


def test_yandex_login_creates_passwordless_user_and_session(base_url):
    suffix = uuid.uuid4().hex[:10]
    email = f"yandex-{suffix}@test.example.com"
    session = requests.Session()

    state = start_yandex_login(session, base_url)
    response = finish_yandex_login(
        session, base_url, yandex_code(suffix, email), state
    )

    assert response.status_code == 307
    assert response.headers["Location"].endswith("/dashboard")
    profile = session.get(f"{base_url}/api/auth/session").json()["user"]
    assert profile["email"] == email
    assert profile["name"] == "Яна Яндексова"


def test_yandex_login_links_existing_user_by_email(base_url):
    suffix = uuid.uuid4().hex[:10]
    email = f"yandex-link-{suffix}@test.example.com"
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
    state = start_yandex_login(session, base_url)
    response = finish_yandex_login(
        session, base_url, yandex_code(suffix, email, "Новое", "Имя"), state
    )

    assert response.status_code == 307
    profile = session.get(f"{base_url}/api/auth/session").json()["user"]
    assert profile["id"] == existing_id
    assert profile["name"] == "Существующий пользователь"


def test_yandex_login_rejects_invalid_state_and_code(base_url):
    session = requests.Session()
    state = start_yandex_login(session, base_url)

    invalid_state = finish_yandex_login(
        session,
        base_url,
        yandex_code("1", "user@test.example.com"),
        f"{state}-invalid",
    )
    assert invalid_state.status_code == 307
    assert "/login?yandex_error=" in invalid_state.headers["Location"]
    assert session.get(f"{base_url}/api/auth/session").json() == {}

    state = start_yandex_login(session, base_url)
    invalid_code = finish_yandex_login(session, base_url, "invalid-code", state)
    assert invalid_code.status_code == 307
    assert "/login?yandex_error=" in invalid_code.headers["Location"]
    assert session.get(f"{base_url}/api/auth/session").json() == {}
