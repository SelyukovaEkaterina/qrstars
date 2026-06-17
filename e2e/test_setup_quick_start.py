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

    session = req_lib.Session()
    login(session, base_url, email, password)
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

    onboarding = session.get(f"{base_url}/api/user/onboarding")
    assert onboarding.status_code == 200
    assert onboarding.json().get("onboardingCompleted") is True


def test_quick_start_reviews_requires_yandex_url(base_url):
    email = unique_email("qs2")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    session = req_lib.Session()
    login(session, base_url, email, password)
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
    session = req_lib.Session()
    login(session, base_url, email, password)
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
    modules = page.json().get("establishment", {}).get("pageModules", {})
    assert modules.get("review") is False
    assert modules.get("menu") is True


def test_quick_start_landing_with_yandex_enables_reviews(base_url):
    email = unique_email("qs3b")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    session = req_lib.Session()
    login(session, base_url, email, password)
    yandex = "https://yandex.ru/maps/org/test/456/"
    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "landing",
            "name": "Landing With Reviews",
            "yandexMapsUrl": yandex,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["qrcode"]["mode"] == "LANDING"

    ests = session.get(f"{base_url}/api/establishments")
    est_list = ests.json().get("establishments", [])
    assert est_list[0]["yandexMapsUrl"] == yandex

    page = session.get(f"{base_url}/api/establishments/{est_list[0]['id']}/page")
    assert page.status_code == 200
    modules = page.json().get("establishment", {}).get("pageModules", {})
    assert modules.get("review") is True


def test_quick_start_existing_establishment_reviews_uses_saved_yandex(base_url):
    email = unique_email("qs5b")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    session = req_lib.Session()
    login(session, base_url, email, password)

    yandex = "https://yandex.ru/maps/org/existing-saved/789/"
    first = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "reviews",
            "name": "Cafe With Yandex",
            "yandexMapsUrl": yandex,
        },
    )
    assert first.status_code == 200, first.text
    est_id = first.json()["establishment"]["id"]

    second = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "reviews",
            "establishmentId": est_id,
        },
    )
    assert second.status_code == 200, second.text
    data = second.json()
    assert data["establishment"]["id"] == est_id
    assert data["qrcode"]["mode"] == "REVIEW"
    assert data["qrcode"]["code"] != first.json()["qrcode"]["code"]

    ests = session.get(f"{base_url}/api/establishments")
    assert ests.status_code == 200
    est_list = ests.json().get("establishments", [])
    assert len(est_list) == 1
    assert est_list[0]["yandexMapsUrl"] == yandex


def test_quick_start_existing_establishment_adds_landing_qr(base_url):
    email = unique_email("qs5")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    session = req_lib.Session()
    login(session, base_url, email, password)

    first = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "landing",
            "name": "Existing Org Cafe",
        },
    )
    assert first.status_code == 200, first.text
    est_id = first.json()["establishment"]["id"]

    second = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "reviews",
            "establishmentId": est_id,
            "yandexMapsUrl": "https://yandex.ru/maps/org/existing/789/",
        },
    )
    assert second.status_code == 200, second.text
    data = second.json()
    assert data["establishment"]["id"] == est_id
    assert data["qrcode"]["mode"] == "REVIEW"

    ests = session.get(f"{base_url}/api/establishments")
    assert ests.status_code == 200
    assert len(ests.json().get("establishments", [])) == 1


def test_quick_start_saves_legal_requisites(base_url):
    email = unique_email("qs-legal")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    session = req_lib.Session()
    login(session, base_url, email, password)
    legal_name = "ИП Тестов Тест Тестович"
    inn = "123456789012"
    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "reviews",
            "name": "Legal Requisites Cafe",
            "yandexMapsUrl": "https://yandex.ru/maps/org/legal/123/",
            "legalName": legal_name,
            "inn": inn,
        },
    )
    assert r.status_code == 200, r.text
    est_id = r.json()["establishment"]["id"]

    settings = session.get(f"{base_url}/api/settings", params={"id": est_id})
    assert settings.status_code == 200
    est = settings.json()["establishment"]
    assert est["legalName"] == legal_name
    assert est["inn"] == inn


def test_quick_start_redirect_without_establishment_skips_setup_guide(base_url):
    email = unique_email("qs4")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "name": "Redirect Only", "consentPd": True},
    )
    session = req_lib.Session()
    login(session, base_url, email, password)

    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "redirect",
            "redirectUrl": "https://example.com/promo",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["intent"] == "redirect"
    assert data["qrcode"]["mode"] == "REDIRECT"
    assert "establishment" not in data

    ests = session.get(f"{base_url}/api/establishments")
    assert ests.status_code == 200
    assert len(ests.json().get("establishments", [])) == 0

    status = session.get(f"{base_url}/api/setup/status")
    assert status.status_code == 200
    assert status.json().get("needsSetup") is False

    onboarding = session.get(f"{base_url}/api/user/onboarding")
    assert onboarding.status_code == 200
    assert onboarding.json().get("onboardingCompleted") is False
