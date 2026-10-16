import time

import pytest
import requests

from conftest import (
    find_qrcode_by_code,
    reset_user_to_free,
    set_user_plan,
    upload_test_file_asset,
    unique_code,
)


# --- QR Code Mode CRUD ---


def test_create_qrcode_mode_review(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": unique_code("qrrev"),
            "establishmentId": owner_establishment_id,
            "mode": "REVIEW",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["qrcode"]["mode"] == "REVIEW"


def test_create_qrcode_mode_redirect(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": unique_code("qrred"),
            "establishmentId": owner_establishment_id,
            "mode": "REDIRECT",
            "redirectUrl": "https://example.com/promo",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["qrcode"]["mode"] == "REDIRECT"
    assert data["qrcode"]["redirectUrl"] == "https://example.com/promo"


def test_create_qrcode_mode_business_card(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": unique_code("qrbc"),
            "establishmentId": owner_establishment_id,
            "mode": "BUSINESS_CARD",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["qrcode"]["mode"] == "BUSINESS_CARD"


def test_create_qrcode_mode_wifi(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": unique_code("qrwf"),
            "establishmentId": owner_establishment_id,
            "mode": "WIFI",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["qrcode"]["mode"] == "WIFI"


def test_create_qrcode_mode_file(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": unique_code("qrfl"),
            "establishmentId": owner_establishment_id,
            "mode": "FILE",
        },
    )
    assert r.status_code == 200
    assert r.json()["qrcode"]["mode"] == "FILE"


def test_update_qrcode_switch_mode_to_redirect(owner_session, base_url, owner_establishment_id):
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": unique_code("qrswred"),
            "establishmentId": owner_establishment_id,
            "mode": "REVIEW",
        },
    )
    assert create_r.status_code == 200, f"Create failed: {create_r.status_code} {create_r.text}"
    qr_id = create_r.json()["qrcode"]["id"]

    r = owner_session.put(
        f"{base_url}/api/qrcodes",
        json={
            "id": qr_id,
            "mode": "REDIRECT",
            "redirectUrl": "https://maps.yandex.ru/some-org",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["qrcode"]["mode"] == "REDIRECT"
    assert data["qrcode"]["redirectUrl"] == "https://maps.yandex.ru/some-org"


def test_update_qrcode_switch_mode_to_business_card(owner_session, base_url, owner_establishment_id):
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": unique_code("qrswbc"),
            "establishmentId": owner_establishment_id,
            "mode": "REVIEW",
        },
    )
    assert create_r.status_code == 200, f"Create failed: {create_r.status_code} {create_r.text}"
    qr_id = create_r.json()["qrcode"]["id"]

    r = owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "mode": "BUSINESS_CARD"},
    )
    assert r.status_code == 200
    assert r.json()["qrcode"]["mode"] == "BUSINESS_CARD"


def test_update_qrcode_switch_mode_to_wifi(owner_session, base_url, owner_establishment_id):
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": unique_code("qrswwf"),
            "establishmentId": owner_establishment_id,
            "mode": "REVIEW",
        },
    )
    assert create_r.status_code == 200, f"Create failed: {create_r.status_code} {create_r.text}"
    qr_id = create_r.json()["qrcode"]["id"]

    r = owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "mode": "WIFI"},
    )
    assert r.status_code == 200
    assert r.json()["qrcode"]["mode"] == "WIFI"


def test_update_qrcode_switch_mode_to_file(owner_session, base_url, owner_establishment_id):
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": unique_code("qrswfl"),
            "establishmentId": owner_establishment_id,
            "mode": "REVIEW",
        },
    )
    assert create_r.status_code == 200, f"Create failed: {create_r.status_code} {create_r.text}"
    qr_id = create_r.json()["qrcode"]["id"]

    r = owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "mode": "FILE"},
    )
    assert r.status_code == 200
    assert r.json()["qrcode"]["mode"] == "FILE"


def test_qrcode_default_mode_is_review(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": unique_code("qrdef"),
            "establishmentId": owner_establishment_id,
        },
    )
    assert r.status_code == 200
    assert r.json()["qrcode"]["mode"] == "REVIEW"


# --- Scan: REDIRECT mode ---


def test_scan_redirect_mode(base_url, owner_session, owner_establishment_id):
    code = unique_code("scnredir")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "REDIRECT",
            "redirectUrl": "https://example.com/redirect-target",
        },
    )

    r = requests.get(f"{base_url}/api/scan/{code}")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is False
    assert data["redirectUrl"] == "https://example.com/redirect-target"


def test_create_qrcode_redirect_url_with_cyrillic_is_encoded(
    owner_session, base_url, owner_establishment_id
):
    r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": unique_code("qrredcyr"),
            "establishmentId": owner_establishment_id,
            "mode": "REDIRECT",
            "redirectUrl": "https://yandex.ru/maps/org/foo/1/reviews/?text=Ломбард 585&z=15",
        },
    )
    assert r.status_code == 200
    saved = r.json()["qrcode"]["redirectUrl"]
    assert saved.isascii(), saved
    assert "%D0%9B%D0%BE%D0%BC%D0%B1%D0%B0%D1%80%D0%B4" in saved


def test_scan_redirect_mode_with_cyrillic_url(
    base_url, owner_session, admin_session, owner_establishment_id
):
    """Location допускает только ASCII — кириллица в URL не должна ломать /q/[code]."""
    set_user_plan(admin_session, base_url, "PRO")
    try:
        code = unique_code("scnredcyr")
        owner_session.post(
            f"{base_url}/api/qrcodes",
            json={
                "code": code,
                "establishmentId": owner_establishment_id,
                "mode": "REDIRECT",
                "redirectUrl": "https://yandex.ru/maps/org/bar/2/reviews/?text=Кофейня Уют",
            },
        )

        r = requests.get(f"{base_url}/q/{code}", allow_redirects=False)
        assert r.status_code in (302, 303, 307, 308), f"{r.status_code} {r.text[:300]}"
        location = r.headers["location"]
        assert location.isascii(), location
        assert location.startswith("https://yandex.ru/maps/org/bar/2/reviews/")
    finally:
        reset_user_to_free(admin_session, base_url)


# --- Scan: REDIRECT interstitial (FREE) ---


def _create_redirect_qr(owner_session, base_url, establishment_id, target):
    code = unique_code("scnint")
    r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": establishment_id,
            "mode": "REDIRECT",
            "redirectUrl": target,
        },
    )
    assert r.status_code == 200, r.text
    return code


def test_free_redirect_shows_qrstars_interstitial(
    base_url, owner_session, admin_session, owner_establishment_id
):
    reset_user_to_free(admin_session, base_url)
    code = _create_redirect_qr(
        owner_session, base_url, owner_establishment_id, "https://example.com/free-target"
    )

    r = requests.get(f"{base_url}/q/{code}", allow_redirects=False)
    assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    html = r.text
    assert "https://example.com/free-target" in html
    assert "Перейти сейчас" in html
    assert "utm_source=qr_interstitial" in html
    assert 'http-equiv="refresh"' in html.lower()


def test_free_redirect_interstitial_counts_scan(
    base_url, owner_session, admin_session, owner_establishment_id
):
    reset_user_to_free(admin_session, base_url)
    code = _create_redirect_qr(
        owner_session, base_url, owner_establishment_id, "https://example.com/counted"
    )
    requests.get(f"{base_url}/q/{code}", allow_redirects=False)

    deadline = time.time() + 15
    scans = 0
    while time.time() < deadline:
        qr = find_qrcode_by_code(owner_session, base_url, code)
        scans = (qr or {}).get("scansCount", 0)
        if scans >= 1:
            break
        time.sleep(1)
    assert scans >= 1


def test_pro_redirect_skips_interstitial(
    base_url, owner_session, admin_session, owner_establishment_id
):
    set_user_plan(admin_session, base_url, "PRO")
    try:
        code = _create_redirect_qr(
            owner_session, base_url, owner_establishment_id, "https://example.com/pro-target"
        )
        r = requests.get(f"{base_url}/q/{code}", allow_redirects=False)
        assert r.status_code in (302, 303, 307, 308), f"{r.status_code} {r.text[:300]}"
        assert r.headers["location"] == "https://example.com/pro-target"
    finally:
        reset_user_to_free(admin_session, base_url)


def test_scan_redirect_mode_without_establishment(base_url, owner_session):
    code = unique_code("scnredno")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "mode": "REDIRECT",
            "redirectUrl": "https://example.com/no-establishment",
        },
    )

    r = requests.get(f"{base_url}/api/scan/{code}")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is False
    assert data["redirectUrl"] == "https://example.com/no-establishment"


# --- Scan: BUSINESS_CARD mode ---


def test_scan_business_card_without_card_linked(base_url, owner_session, owner_establishment_id):
    code = unique_code("scnbcno")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "BUSINESS_CARD",
        },
    )

    r = requests.get(f"{base_url}/api/scan/{code}")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is True
    assert data["code"] == code


def test_scan_business_card_with_card_linked(base_url, owner_session, owner_establishment_id):
    code = unique_code("scnbcyes")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "BUSINESS_CARD",
        },
    )

    card_r = owner_session.post(
        f"{base_url}/api/business-cards",
        json={
            "fullName": "Иван Петров",
            "title": "Бариста",
            "company": "Кофейня «Бобр»",
            "phone": "+79991112233",
            "email": "ivan@example.com",
        },
    )
    assert card_r.status_code == 200
    card_id = card_r.json()["businessCard"]["id"]

    list_r = owner_session.get(f"{base_url}/api/qrcodes", params={"establishmentId": owner_establishment_id})
    qr_id = None
    for qr in list_r.json()["qrcodes"]:
        if qr["code"] == code:
            qr_id = qr["id"]
            break
    assert qr_id is not None

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "businessCardId": card_id},
    )

    r = requests.get(f"{base_url}/api/scan/{code}")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is False
    assert data["mode"] == "BUSINESS_CARD"
    assert data["businessCard"]["fullName"] == "Иван Петров"
    assert data["businessCard"]["title"] == "Бариста"
    assert data["businessCard"]["company"] == "Кофейня «Бобр»"
    assert data["businessCard"]["phone"] == "+79991112233"
    assert data["businessCard"]["email"] == "ivan@example.com"


def test_scan_business_card_increments_counter(base_url, owner_session, owner_establishment_id):
    code = unique_code("scnbccnt")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "BUSINESS_CARD",
        },
    )

    card_r = owner_session.post(
        f"{base_url}/api/business-cards",
        json={"fullName": "Счётчик Тестов"},
    )
    card_id = card_r.json()["businessCard"]["id"]

    list_r = owner_session.get(f"{base_url}/api/qrcodes", params={"establishmentId": owner_establishment_id})
    qr_id = None
    for qr in list_r.json()["qrcodes"]:
        if qr["code"] == code:
            qr_id = qr["id"]
            break
    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "businessCardId": card_id},
    )

    r1 = requests.get(f"{base_url}/api/scan/{code}")
    assert r1.status_code == 200
    r2 = requests.get(f"{base_url}/api/scan/{code}")
    assert r2.status_code == 200


# --- Scan: WIFI mode ---


def test_scan_wifi_without_config_linked(base_url, owner_session, owner_establishment_id):
    code = unique_code("scnwfno")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "WIFI",
        },
    )

    r = requests.get(f"{base_url}/api/scan/{code}")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is True
    assert data["code"] == code


def test_scan_wifi_with_config_linked(base_url, owner_session, owner_establishment_id):
    code = unique_code("scnwfyes")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "WIFI",
        },
    )

    wifi_r = owner_session.post(
        f"{base_url}/api/wifi-configs",
        json={
            "ssid": "TestNetwork_E2E",
            "password": "testpass123",
            "encryption": "WPA",
            "hidden": False,
        },
    )
    assert wifi_r.status_code == 200
    wifi_id = wifi_r.json()["wifiConfig"]["id"]

    list_r = owner_session.get(f"{base_url}/api/qrcodes", params={"establishmentId": owner_establishment_id})
    qr_id = None
    for qr in list_r.json()["qrcodes"]:
        if qr["code"] == code:
            qr_id = qr["id"]
            break
    assert qr_id is not None

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "wifiConfigId": wifi_id},
    )

    r = requests.get(f"{base_url}/api/scan/{code}")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is False
    assert data["mode"] == "WIFI"
    assert data["wifiConfig"]["ssid"] == "TestNetwork_E2E"
    assert data["wifiConfig"]["password"] == "testpass123"
    assert data["wifiConfig"]["encryption"] == "WPA"
    assert data["wifiConfig"]["hidden"] is False


def test_scan_wifi_increments_counter(base_url, owner_session, owner_establishment_id):
    code = unique_code("scnwfcnt")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "WIFI",
        },
    )

    wifi_r = owner_session.post(
        f"{base_url}/api/wifi-configs",
        json={"ssid": "CounterWifi_E2E"},
    )
    wifi_id = wifi_r.json()["wifiConfig"]["id"]

    list_r = owner_session.get(f"{base_url}/api/qrcodes", params={"establishmentId": owner_establishment_id})
    qr_id = None
    for qr in list_r.json()["qrcodes"]:
        if qr["code"] == code:
            qr_id = qr["id"]
            break
    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "wifiConfigId": wifi_id},
    )

    r1 = requests.get(f"{base_url}/api/scan/{code}")
    assert r1.status_code == 200
    r2 = requests.get(f"{base_url}/api/scan/{code}")
    assert r2.status_code == 200


# --- Scan: FILE mode ---


def test_scan_file_without_asset_linked(base_url, owner_session, owner_establishment_id):
    code = unique_code("scnflno")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "FILE",
        },
    )

    r = requests.get(f"{base_url}/api/scan/{code}")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is True
    assert data["code"] == code


def test_scan_file_with_asset_linked(base_url, owner_session, owner_establishment_id):
    code = unique_code("scnflyes")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "FILE",
        },
    )

    file_asset = upload_test_file_asset(
        owner_session,
        base_url,
        file_name="menu.pdf",
        title="Меню ресторана",
    )

    qr = find_qrcode_by_code(
        owner_session, base_url, code, owner_establishment_id
    )
    assert qr is not None

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr["id"], "fileAssetId": file_asset["id"], "mode": "FILE"},
    )

    r = requests.get(f"{base_url}/api/scan/{code}")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is False
    assert data["mode"] == "FILE"
    assert data["fileAsset"]["fileName"] == "menu.pdf"
    assert data["fileAsset"]["title"] == "Меню ресторана"
    assert data["fileAsset"]["mimeType"] == "application/pdf"
    assert data["fileAsset"]["fileUrl"]
    assert data["fileAsset"]["fileSize"] > 0


def test_scan_file_increments_counter(base_url, owner_session, owner_establishment_id):
    code = unique_code("scnflcnt")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "FILE",
        },
    )

    file_asset = upload_test_file_asset(owner_session, base_url, file_name="counter.pdf")

    qr = find_qrcode_by_code(
        owner_session, base_url, code, owner_establishment_id
    )
    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr["id"], "fileAssetId": file_asset["id"]},
    )

    before = owner_session.get(
        f"{base_url}/api/qrcodes", params={"id": qr["id"]}
    ).json()["qrcode"]["scansCount"]

    r1 = requests.get(f"{base_url}/api/scan/{code}")
    assert r1.status_code == 200
    r2 = requests.get(f"{base_url}/api/scan/{code}")
    assert r2.status_code == 200

    time.sleep(0.5)

    after = owner_session.get(
        f"{base_url}/api/qrcodes", params={"id": qr["id"]}
    ).json()["qrcode"]["scansCount"]
    assert after >= before + 2


# --- Scan: REVIEW mode (default) ---


def test_scan_review_mode_returns_establishment(base_url, owner_session, owner_establishment_id):
    code = unique_code("scnrev")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "REVIEW",
        },
    )

    r = requests.get(f"{base_url}/api/scan/{code}")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is False
    assert data["establishmentName"] is not None
    assert data["qrCodeId"] is not None
    assert "reviewRouting" in data
    assert "platformUrls" in data
    assert data.get("mode") is None


# --- Scan: unactivated QR with non-REVIEW mode ---


def test_scan_unactivated_business_card_mode(base_url, owner_session):
    code = unique_code("scnbunact")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "mode": "BUSINESS_CARD",
        },
    )

    r = requests.get(f"{base_url}/api/scan/{code}")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is True


def test_scan_unactivated_wifi_mode(base_url, owner_session):
    code = unique_code("scnwfunact")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "mode": "WIFI",
        },
    )

    r = requests.get(f"{base_url}/api/scan/{code}")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is True


def test_scan_unactivated_file_mode(base_url, owner_session):
    code = unique_code("scnflunact")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "mode": "FILE",
        },
    )

    r = requests.get(f"{base_url}/api/scan/{code}")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is True


# --- QR code includes businessCard/wifiConfig/fileAsset in GET ---


def test_get_qrcode_includes_business_card(owner_session, base_url, owner_establishment_id):
    code = unique_code("qrbcget")
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "BUSINESS_CARD",
        },
    )
    assert create_r.status_code == 200, f"Create failed: {create_r.status_code} {create_r.text}"
    qr_id = create_r.json()["qrcode"]["id"]

    card_r = owner_session.post(
        f"{base_url}/api/business-cards",
        json={"fullName": "Тест Визиточник", "phone": "+79990000000"},
    )
    card_id = card_r.json()["businessCard"]["id"]

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "businessCardId": card_id},
    )

    r = owner_session.get(f"{base_url}/api/qrcodes", params={"id": qr_id})
    assert r.status_code == 200
    data = r.json()
    assert data["qrcode"]["businessCard"] is not None
    assert data["qrcode"]["businessCard"]["fullName"] == "Тест Визиточник"


def test_get_qrcode_includes_wifi_config(owner_session, base_url, owner_establishment_id):
    code = unique_code("qrwfget")
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "WIFI",
        },
    )
    assert create_r.status_code == 200, f"Create failed: {create_r.status_code} {create_r.text}"
    qr_id = create_r.json()["qrcode"]["id"]

    wifi_r = owner_session.post(
        f"{base_url}/api/wifi-configs",
        json={"ssid": "GetTestWifi", "password": "pass123", "encryption": "WPA2"},
    )
    wifi_id = wifi_r.json()["wifiConfig"]["id"]

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "wifiConfigId": wifi_id},
    )

    r = owner_session.get(f"{base_url}/api/qrcodes", params={"id": qr_id})
    assert r.status_code == 200
    data = r.json()
    assert data["qrcode"]["wifiConfig"] is not None
    assert data["qrcode"]["wifiConfig"]["ssid"] == "GetTestWifi"


def test_get_qrcode_includes_file_asset(owner_session, base_url, owner_establishment_id):
    code = unique_code("qrflget")
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "FILE",
        },
    )
    assert create_r.status_code == 200, f"Create failed: {create_r.status_code} {create_r.text}"
    qr_id = create_r.json()["qrcode"]["id"]

    file_asset = upload_test_file_asset(
        owner_session,
        base_url,
        file_name="price-list.pdf",
        title="Прайс-лист",
    )

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "fileAssetId": file_asset["id"]},
    )

    r = owner_session.get(f"{base_url}/api/qrcodes", params={"id": qr_id})
    assert r.status_code == 200
    data = r.json()
    assert data["qrcode"]["fileAsset"] is not None
    assert data["qrcode"]["fileAsset"]["fileName"] == "price-list.pdf"
    assert data["qrcode"]["fileAsset"]["title"] == "Прайс-лист"


def test_list_qrcodes_includes_file_asset(owner_session, base_url, owner_establishment_id):
    code = unique_code("qrfllist")
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "FILE",
        },
    )
    assert create_r.status_code == 200, f"Create failed: {create_r.status_code} {create_r.text}"
    qr_id = create_r.json()["qrcode"]["id"]

    file_asset = upload_test_file_asset(owner_session, base_url, file_name="catalog.pdf")
    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "fileAssetId": file_asset["id"]},
    )

    r = owner_session.get(
        f"{base_url}/api/qrcodes", params={"establishmentId": owner_establishment_id}
    )
    assert r.status_code == 200
    qr = next(q for q in r.json()["qrcodes"] if q["id"] == qr_id)
    assert qr["mode"] == "FILE"
    assert qr["fileAsset"]["fileName"] == "catalog.pdf"


# --- Unlink business card / wifi config / file asset from QR ---


def test_unlink_business_card_from_qr(owner_session, base_url, owner_establishment_id):
    code = unique_code("qrbculnk")
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "BUSINESS_CARD",
        },
    )
    assert create_r.status_code == 200, f"Create failed: {create_r.status_code} {create_r.text}"
    qr_id = create_r.json()["qrcode"]["id"]

    card_r = owner_session.post(
        f"{base_url}/api/business-cards",
        json={"fullName": "Анлинк Тест"},
    )
    card_id = card_r.json()["businessCard"]["id"]

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "businessCardId": card_id},
    )

    unlink_r = owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "businessCardId": None},
    )
    assert unlink_r.status_code == 200

    r = requests.get(f"{base_url}/api/scan/{code}")
    assert r.status_code == 200
    assert r.json()["needsActivation"] is True


def test_unlink_wifi_config_from_qr(owner_session, base_url, owner_establishment_id):
    code = unique_code("qrwfulnk")
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "WIFI",
        },
    )
    assert create_r.status_code == 200, f"Create failed: {create_r.status_code} {create_r.text}"
    qr_id = create_r.json()["qrcode"]["id"]

    wifi_r = owner_session.post(
        f"{base_url}/api/wifi-configs",
        json={"ssid": "UnlinkWifi"},
    )
    wifi_id = wifi_r.json()["wifiConfig"]["id"]

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "wifiConfigId": wifi_id},
    )

    unlink_r = owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "wifiConfigId": None},
    )
    assert unlink_r.status_code == 200

    r = requests.get(f"{base_url}/api/scan/{code}")
    assert r.status_code == 200
    assert r.json()["needsActivation"] is True


def test_unlink_file_asset_from_qr(owner_session, base_url, owner_establishment_id):
    code = unique_code("qrflulnk")
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "FILE",
        },
    )
    assert create_r.status_code == 200, f"Create failed: {create_r.status_code} {create_r.text}"
    qr_id = create_r.json()["qrcode"]["id"]

    file_asset = upload_test_file_asset(owner_session, base_url, file_name="unlink.pdf")

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "fileAssetId": file_asset["id"]},
    )

    unlink_r = owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "fileAssetId": None},
    )
    assert unlink_r.status_code == 200

    r = requests.get(f"{base_url}/api/scan/{code}")
    assert r.status_code == 200
    assert r.json()["needsActivation"] is True


def test_update_file_asset_title(owner_session, base_url, owner_establishment_id):
    file_asset = upload_test_file_asset(
        owner_session, base_url, file_name="title-test.pdf", title="Старое название"
    )

    r = owner_session.put(
        f"{base_url}/api/file-assets",
        json={"id": file_asset["id"], "title": "Новое меню"},
    )
    assert r.status_code == 200
    assert r.json()["fileAsset"]["title"] == "Новое меню"


def test_delete_qrcode(owner_session, base_url, owner_establishment_id):
    code = unique_code("qrdel")
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "label": "Лишний",
            "establishmentId": owner_establishment_id,
            "mode": "REDIRECT",
            "redirectUrl": "https://example.com/gone",
        },
    )
    assert create_r.status_code == 200
    qr_id = create_r.json()["qrcode"]["id"]

    anon = requests.delete(f"{base_url}/api/qrcodes", params={"id": qr_id})
    assert anon.status_code == 401

    missing = owner_session.delete(f"{base_url}/api/qrcodes", params={"id": "missing-qr"})
    assert missing.status_code == 404

    no_id = owner_session.delete(f"{base_url}/api/qrcodes")
    assert no_id.status_code == 400

    deleted = owner_session.delete(f"{base_url}/api/qrcodes", params={"id": qr_id})
    assert deleted.status_code == 200
    assert deleted.json()["ok"] is True

    again = owner_session.delete(f"{base_url}/api/qrcodes", params={"id": qr_id})
    assert again.status_code == 404

    get_r = owner_session.get(f"{base_url}/api/qrcodes", params={"id": qr_id})
    assert get_r.status_code == 404

    page = requests.get(f"{base_url}/q/{code}")
    assert page.status_code == 200
    assert "QR-код не активирован" in page.text
