import uuid

import requests as req_lib

from conftest import login


def unique_email(prefix="qs"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@test.example.com"


def test_quick_start_reviews_creates_review_mode_qr(base_url):
    email = unique_email()
    password = "secure123"
    reg = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "name": "Quick Start", "consentPd": True},
    )
    assert reg.status_code == 200

    session = login(base_url, email, password)
    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "reviews",
            "name": "E2E Coffee",
            "yandexMapsUrl": "https://yandex.ru/maps/org/test/123/",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["establishment"]["name"] == "E2E Coffee"
    assert data["qrcode"]["mode"] == "REVIEW"
    code = data["qrcode"]["code"]

    scan = req_lib.get(f"{base_url}/q/{code}", allow_redirects=False)
    assert scan.status_code == 200

    ests = session.get(f"{base_url}/api/establishments")
    assert ests.status_code == 200
    assert len(ests.json().get("establishments", [])) == 1


def test_quick_start_reviews_requires_yandex_url(base_url):
    email = unique_email("qs2")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    session = login(base_url, email, password)
    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={"intent": "reviews", "name": "No Maps"},
    )
    assert r.status_code == 400


def test_quick_start_landing_page_without_yandex(base_url):
    email = unique_email("qs3")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    session = login(base_url, email, password)
    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={"intent": "landing", "name": "Guest Page Only"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["intent"] == "landing"
    assert data["qrcode"]["mode"] == "LANDING"

    ests = session.get(f"{base_url}/api/establishments")
    assert ests.status_code == 200
    est_list = ests.json().get("establishments", [])
    assert len(est_list) == 1

    page = session.get(f"{base_url}/api/establishments/{est_list[0]['id']}/page")
    assert page.status_code == 200
    modules = page.json().get("pageModules", {})
    assert modules.get("review") is True
    assert modules.get("menu") is True
