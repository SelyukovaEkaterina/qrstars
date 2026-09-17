"""E2E: establishment page content (Моя страница) and LANDING QR routing."""

import pytest
import requests

from conftest import unique_code, reset_user_to_free, set_user_plan


def test_establishment_page_api_get(owner_session, base_url, owner_establishment_id):
    r = owner_session.get(
        f"{base_url}/api/establishments/{owner_establishment_id}/page"
    )
    assert r.status_code == 200
    data = r.json()
    est = data["establishment"]
    assert est["id"] == owner_establishment_id
    assert "pageModules" in est
    assert est["pageModules"]["menu"] is True


def test_establishment_page_modules_toggle(owner_session, base_url, owner_establishment_id):
    r = owner_session.put(
        f"{base_url}/api/establishments/{owner_establishment_id}/page",
        json={"pageModules": {"menu": True, "review": False, "businessCard": True, "wifi": True}},
    )
    assert r.status_code == 200
    assert r.json()["establishment"]["pageModules"]["review"] is False

    r2 = owner_session.put(
        f"{base_url}/api/establishments/{owner_establishment_id}/page",
        json={"pageModules": {"menu": True, "review": True, "businessCard": True, "wifi": True}},
    )
    assert r2.status_code == 200


def test_create_qrcode_mode_landing_requires_pro(owner_session, admin_session, base_url, owner_establishment_id):
    reset_user_to_free(admin_session, base_url)
    r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": unique_code("qrland"),
            "establishmentId": owner_establishment_id,
            "mode": "LANDING",
        },
    )
    assert r.status_code == 403
    data = r.json()
    assert data.get("upgradeRequired") == "PRO"

    set_user_plan(admin_session, base_url, "PRO")
    try:
        r_ok = owner_session.post(
            f"{base_url}/api/qrcodes",
            json={
                "code": unique_code("qrlandp"),
                "establishmentId": owner_establishment_id,
                "mode": "LANDING",
            },
        )
        assert r_ok.status_code == 200, r_ok.text
        assert r_ok.json()["qrcode"]["mode"] == "LANDING"
        assert r_ok.json()["qrcode"]["landingGrandfathered"] is False
    finally:
        reset_user_to_free(admin_session, base_url)


def test_switch_review_to_landing_requires_pro(owner_session, admin_session, base_url, owner_establishment_id):
    reset_user_to_free(admin_session, base_url)
    created = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": unique_code("qrsw"),
            "establishmentId": owner_establishment_id,
            "mode": "REVIEW",
        },
    )
    assert created.status_code == 200
    qr_id = created.json()["qrcode"]["id"]
    switched = owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "mode": "LANDING"},
    )
    assert switched.status_code == 403
    assert switched.json().get("upgradeRequired") == "PRO"


def test_menu_linked_to_establishment(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/menus",
        json={
            "establishmentId": owner_establishment_id,
            "title": "Тестовое меню",
            "items": [{"name": "Борщ", "price": "300"}],
        },
    )
    assert r.status_code == 200
    menu_id = r.json()["menu"]["id"]

    page = owner_session.get(
        f"{base_url}/api/establishments/{owner_establishment_id}/page"
    ).json()
    assert page["establishment"]["menu"]["id"] == menu_id


def test_establishment_page_landing_subtitle(owner_session, base_url, owner_establishment_id):
    custom = "Добро пожаловать в нашу кофейню"
    r = owner_session.put(
        f"{base_url}/api/establishments/{owner_establishment_id}/page",
        json={"landingSubtitle": custom},
    )
    assert r.status_code == 200
    assert r.json()["establishment"]["landingSubtitle"] == custom

    r2 = owner_session.put(
        f"{base_url}/api/establishments/{owner_establishment_id}/page",
        json={"landingSubtitle": ""},
    )
    assert r2.status_code == 200
    assert r2.json()["establishment"]["landingSubtitle"] is None


def test_establishment_page_brand_color(owner_session, base_url, owner_establishment_id):
    r = owner_session.put(
        f"{base_url}/api/establishments/{owner_establishment_id}/page",
        json={"brandColor": "#059669", "pageAppearance": "dark"},
    )
    assert r.status_code == 200
    est = r.json()["establishment"]
    assert est["brandColor"] == "#059669"
    assert est["pageAppearance"] == "dark"

    r2 = owner_session.put(
        f"{base_url}/api/establishments/{owner_establishment_id}/page",
        json={"brandColor": "#4f46e5", "pageAppearance": "light"},
    )
    assert r2.status_code == 200


def test_establishment_page_api_unauthorized(base_url, owner_establishment_id):
    r = requests.get(f"{base_url}/api/establishments/{owner_establishment_id}/page")
    assert r.status_code in (401, 403)


def _find_grandfathered_landing(session, base_url, establishment_id):
    listed = session.get(f"{base_url}/api/qrcodes", params={"establishmentId": establishment_id})
    assert listed.status_code == 200
    for qr in listed.json().get("qrcodes", []):
        if qr.get("landingGrandfathered"):
            return qr
    return None


def test_grandfathered_landing_stays_on_free(owner_session, admin_session, base_url, owner_establishment_id):
    reset_user_to_free(admin_session, base_url)
    qr = _find_grandfathered_landing(owner_session, base_url, owner_establishment_id)
    if not qr:
        pytest.skip("No grandfathered LANDING QR in seed")

    keep = owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr["id"], "mode": "LANDING", "label": "Saved microsite"},
    )
    assert keep.status_code == 200, keep.text
    assert keep.json()["qrcode"]["mode"] == "LANDING"

    to_review = owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr["id"], "mode": "REVIEW"},
    )
    assert to_review.status_code == 200
    back = owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr["id"], "mode": "LANDING"},
    )
    assert back.status_code == 200, back.text
    assert back.json()["qrcode"]["mode"] == "LANDING"

    scan = requests.get(f"{base_url}/q/{qr['code']}", allow_redirects=False)
    assert scan.status_code == 200
    assert "временно недоступна" not in scan.text


def test_paid_landing_survives_downgrade(
    owner_session, admin_session, base_url, owner_establishment_id
):
    """После оплаты микросайт остаётся открытым, но его состав заморожен."""
    set_user_plan(admin_session, base_url, "PRO")
    try:
        created = owner_session.post(
            f"{base_url}/api/qrcodes",
            json={
                "code": unique_code("qrdn"),
                "establishmentId": owner_establishment_id,
                "mode": "LANDING",
            },
        )
        assert created.status_code == 200, created.text
        qr = created.json()["qrcode"]
        assert qr["landingGrandfathered"] is False
        code = qr["code"]
    finally:
        reset_user_to_free(admin_session, base_url, reset_paid_history=False)

    try:
        page = requests.get(f"{base_url}/q/{code}", allow_redirects=False)
        assert page.status_code == 200
        assert "временно недоступна" not in page.text

        api = requests.get(f"{base_url}/api/scan/{code}")
        assert api.status_code == 200, api.text

        frozen = owner_session.put(
            f"{base_url}/api/establishments/{owner_establishment_id}/page",
            json={"landingSubtitle": "После даунгрейда"},
        )
        assert frozen.status_code == 403, frozen.text

        # Брендинг работает и на бесплатных страницах — его не замораживаем.
        branding = owner_session.put(
            f"{base_url}/api/establishments/{owner_establishment_id}/page",
            json={"brandColor": "#4f46e5"},
        )
        assert branding.status_code == 200, branding.text
    finally:
        reset_user_to_free(admin_session, base_url)
