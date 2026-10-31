import uuid

import requests as req_lib

from conftest import login, set_user_plan, reset_user_to_free


def unique_email(prefix="qs"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@test.example.com"


def test_quick_start_saves_industry_and_applies_qr_style(base_url):
    email = unique_email("qs-auto")
    password = "secure123"
    reg = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    assert reg.status_code == 200
    session = req_lib.Session()
    login(session, base_url, email, password)

    response = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "reviews",
            "name": "Автосервис Тест",
            "industry": "AUTO",
            "yandexMapsUrl": "https://yandex.ru/maps/org/auto_test/123/",
        },
    )
    assert response.status_code == 200, response.text

    establishments = session.get(f"{base_url}/api/establishments").json()["establishments"]
    assert establishments[0]["industry"] == "AUTO"

    qr_id = response.json()["qrcode"]["id"]
    qr = session.get(f"{base_url}/api/qrcodes", params={"id": qr_id})
    assert qr.status_code == 200, qr.text
    assert qr.json()["qrcode"]["qrStyleTemplateId"] == "qr-preset-auto"


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


def test_quick_start_reviews_normalizes_url_without_https(base_url):
    email = unique_email("qs-norm")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    session = req_lib.Session()
    login(session, base_url, email, password)
    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "reviews",
            "name": "Normalize URL Cafe",
            "yandexMapsUrl": "yandex.ru/maps/org/test/123",
        },
    )
    assert r.status_code == 200, r.text
    ests = session.get(f"{base_url}/api/establishments")
    assert ests.status_code == 200
    assert ests.json()["establishments"][0]["yandexMapsUrl"] == "https://yandex.ru/maps/org/test/123"


def test_quick_start_reviews_rejects_search_url(base_url):
    email = unique_email("qs-search")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    session = req_lib.Session()
    login(session, base_url, email, password)
    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "reviews",
            "name": "Search URL Cafe",
            "yandexMapsUrl": "https://yandex.ru/maps/search/кафе",
        },
    )
    assert r.status_code == 400
    assert "карточку" in r.json().get("error", "").lower()


def test_quick_start_reviews_rejects_short_share_url(base_url):
    email = unique_email("qs-short")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    session = req_lib.Session()
    login(session, base_url, email, password)
    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "reviews",
            "name": "Short URL Cafe",
            "yandexMapsUrl": "https://yandex.ru/maps/-/CDwZ6KMr",
        },
    )
    assert r.status_code == 400
    err = r.json().get("error", "").lower()
    assert "коротк" in err or "org" in err


def test_quick_start_reviews_rejects_maps_homepage(base_url):
    email = unique_email("qs-home")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    session = req_lib.Session()
    login(session, base_url, email, password)
    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "reviews",
            "name": "Homepage Cafe",
            "yandexMapsUrl": "https://yandex.ru/maps/",
        },
    )
    assert r.status_code == 400
    assert "карточку" in r.json().get("error", "").lower()


def test_quick_start_landing_requires_pro(base_url, admin_session):
    email = unique_email("qs3")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    session = req_lib.Session()
    login(session, base_url, email, password)
    blocked = session.post(
        f"{base_url}/api/setup/quick-start",
        json={"intent": "landing", "name": "Guest Page Only"},
    )
    assert blocked.status_code == 403
    assert blocked.json().get("upgradeRequired") == "PRO"

    set_user_plan(admin_session, base_url, "PRO", email)
    try:
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
    finally:
        reset_user_to_free(admin_session, base_url, email)


def test_quick_start_landing_with_yandex_enables_reviews(base_url, admin_session):
    email = unique_email("qs3b")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    session = req_lib.Session()
    login(session, base_url, email, password)
    yandex = "https://yandex.ru/maps/org/test/456/"
    set_user_plan(admin_session, base_url, "PRO", email)
    try:
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
    finally:
        reset_user_to_free(admin_session, base_url, email)


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


def test_quick_start_existing_establishment_adds_review_qr(base_url):
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
            "intent": "reviews",
            "name": "Existing Org Cafe",
            "yandexMapsUrl": "https://yandex.ru/maps/org/existing/111/",
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


def test_quick_start_menu_creates_menu_mode_qr_with_items(base_url):
    email = unique_email("qs-menu")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    session = req_lib.Session()
    login(session, base_url, email, password)
    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={"intent": "menu", "name": "Menu Cafe"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["intent"] == "menu"
    assert data["qrcode"]["mode"] == "MENU"
    code = data["qrcode"]["code"]

    scan = req_lib.get(f"{base_url}/q/{code}", allow_redirects=False)
    assert scan.status_code == 200

    ests = session.get(f"{base_url}/api/establishments")
    assert ests.status_code == 200
    est_list = ests.json().get("establishments", [])
    assert len(est_list) == 1
    est_id = est_list[0]["id"]

    page = session.get(f"{base_url}/api/establishments/{est_id}/page")
    assert page.status_code == 200
    menu = page.json().get("establishment", {}).get("menu")
    assert menu is not None
    assert len(menu.get("items", [])) >= 3

    onboarding = session.get(f"{base_url}/api/user/onboarding")
    assert onboarding.status_code == 200
    assert onboarding.json().get("onboardingCompleted") is True


def test_quick_start_redirect_creates_project(base_url):
    email = unique_email("qs4")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "name": "Redirect Only", "consentPd": True},
    )
    session = req_lib.Session()
    login(session, base_url, email, password)

    missing_name = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "redirect",
            "redirectUrl": "https://example.com/promo",
        },
    )
    assert missing_name.status_code == 400, missing_name.text

    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "redirect",
            "name": "Промо-кампания",
            "redirectUrl": "https://example.com/promo",
            "qrLabel": "Промо-баннер",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["intent"] == "redirect"
    assert data["qrcode"]["mode"] == "REDIRECT"
    assert data["qrcode"]["label"] == "Промо-баннер"
    assert data["establishment"]["name"] == "Промо-кампания"

    ests = session.get(f"{base_url}/api/establishments")
    assert ests.status_code == 200
    assert len(ests.json().get("establishments", [])) == 1

    qrs = session.get(f"{base_url}/api/qrcodes")
    assert qrs.status_code == 200
    created = next(q for q in qrs.json().get("qrcodes", []) if q["id"] == data["qrcode"]["id"])
    assert created["establishmentId"] == data["establishment"]["id"]
    assert created["redirectUrl"] == "https://example.com/promo"

    status = session.get(f"{base_url}/api/setup/status")
    assert status.status_code == 200
    assert status.json().get("needsSetup") is False

    onboarding = session.get(f"{base_url}/api/user/onboarding")
    assert onboarding.status_code == 200
    assert onboarding.json().get("onboardingCompleted") is True


def test_quick_start_redirect_rejects_invalid_protocol(base_url):
    email = unique_email("qs5")
    password = "secure123"
    req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "name": "Bad URL", "consentPd": True},
    )
    session = req_lib.Session()
    login(session, base_url, email, password)

    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "redirect",
            "redirectUrl": "htttps://example.com/promo",
        },
    )
    assert r.status_code == 400, r.text
    assert "ссылка" in r.json().get("error", "").lower()


def _new_session(base_url, prefix):
    email = unique_email(prefix)
    password = "secure123"
    reg = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    assert reg.status_code == 200, reg.text
    session = req_lib.Session()
    login(session, base_url, email, password)
    return session


def test_quick_start_reviews_with_2gis_only_routes_free_guests_to_2gis(base_url):
    session = _new_session(base_url, "qs-2gis")
    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "reviews",
            "name": "2GIS Coffee",
            "twoGisUrl": "https://2gis.ru/moscow/firm/70000001012345678/37.6,55.7?m=1",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["qrcode"]["mode"] == "REVIEW"

    est = session.get(f"{base_url}/api/establishments").json()["establishments"][0]
    assert est["twoGisUrl"] == "https://2gis.ru/moscow/firm/70000001012345678"
    assert not est.get("yandexMapsUrl")

    scan = req_lib.get(f"{base_url}/api/scan/{data['qrcode']['code']}")
    assert scan.status_code == 200, scan.text
    routing = scan.json()["reviewRouting"]
    assert routing["5"]["action"] == "TWO_GIS"
    assert routing["4"]["action"] == "TWO_GIS"
    assert routing["2"]["action"] == "COMPLAINT"

    page = req_lib.get(f"{base_url}/q/{data['qrcode']['code']}")
    assert page.status_code == 200


def test_quick_start_reviews_yandex_still_wins_on_free(base_url):
    session = _new_session(base_url, "qs-both")
    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "reviews",
            "name": "Both Maps",
            "yandexMapsUrl": "https://yandex.ru/maps/org/test/123/",
            "twoGisUrl": "https://2gis.ru/moscow/firm/123",
        },
    )
    assert r.status_code == 200, r.text
    scan = req_lib.get(f"{base_url}/api/scan/{r.json()['qrcode']['code']}")
    assert scan.json()["reviewRouting"]["5"]["action"] == "YANDEX"


def test_quick_start_reviews_rejects_2gis_search_url(base_url):
    session = _new_session(base_url, "qs-2gis-bad")
    for bad in ["https://2gis.ru/moscow/search/кафе", "https://2gis.ru/", "https://example.com/firm/1"]:
        r = session.post(
            f"{base_url}/api/setup/quick-start",
            json={"intent": "reviews", "name": "Bad 2GIS", "twoGisUrl": bad},
        )
        assert r.status_code == 400, (bad, r.text)
        assert "2GIS" in r.json()["error"]
    assert session.get(f"{base_url}/api/establishments").json()["establishments"] == []


def test_quick_start_existing_establishment_reviews_uses_saved_2gis(base_url):
    session = _new_session(base_url, "qs-2gis-existing")
    first = session.post(
        f"{base_url}/api/setup/quick-start",
        json={"intent": "reviews", "name": "Saved 2GIS", "twoGisUrl": "https://2gis.ru/spb/firm/555"},
    )
    assert first.status_code == 200, first.text
    est_id = first.json()["establishment"]["id"]

    second = session.post(
        f"{base_url}/api/setup/quick-start",
        json={"intent": "reviews", "establishmentId": est_id},
    )
    assert second.status_code == 200, second.text
    assert second.json()["qrcode"]["mode"] == "REVIEW"
