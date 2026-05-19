import pytest
import requests

from conftest import find_qrcode_by_code, upload_test_file_asset


# --- QR Code Mode CRUD ---


def test_create_qrcode_mode_review(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "qrmode_rev01",
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
            "code": "qrmode_red01",
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
            "code": "qrmode_bc01",
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
            "code": "qrmode_wf01",
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
            "code": "qrmode_file01",
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
            "code": "qrmode_sw01",
            "establishmentId": owner_establishment_id,
            "mode": "REVIEW",
        },
    )
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
            "code": "qrmode_sw02",
            "establishmentId": owner_establishment_id,
            "mode": "REVIEW",
        },
    )
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
            "code": "qrmode_sw03",
            "establishmentId": owner_establishment_id,
            "mode": "REVIEW",
        },
    )
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
            "code": "qrmode_sw_file01",
            "establishmentId": owner_establishment_id,
            "mode": "REVIEW",
        },
    )
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
            "code": "qrmode_def01",
            "establishmentId": owner_establishment_id,
        },
    )
    assert r.status_code == 200
    assert r.json()["qrcode"]["mode"] == "REVIEW"


# --- Scan: REDIRECT mode ---


def test_scan_redirect_mode(base_url, owner_session, owner_establishment_id):
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "scan_redir01",
            "establishmentId": owner_establishment_id,
            "mode": "REDIRECT",
            "redirectUrl": "https://example.com/redirect-target",
        },
    )

    r = requests.get(f"{base_url}/api/scan/scan_redir01")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is False
    assert data["redirectUrl"] == "https://example.com/redirect-target"


# --- Scan: BUSINESS_CARD mode ---


def test_scan_business_card_without_card_linked(base_url, owner_session, owner_establishment_id):
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "scan_bc_no01",
            "establishmentId": owner_establishment_id,
            "mode": "BUSINESS_CARD",
        },
    )

    r = requests.get(f"{base_url}/api/scan/scan_bc_no01")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is True
    assert data["code"] == "scan_bc_no01"


def test_scan_business_card_with_card_linked(base_url, owner_session, owner_establishment_id):
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "scan_bc_yes01",
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
        if qr["code"] == "scan_bc_yes01":
            qr_id = qr["id"]
            break
    assert qr_id is not None

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "businessCardId": card_id},
    )

    r = requests.get(f"{base_url}/api/scan/scan_bc_yes01")
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
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "scan_bc_cnt01",
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
        if qr["code"] == "scan_bc_cnt01":
            qr_id = qr["id"]
            break
    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "businessCardId": card_id},
    )

    r1 = requests.get(f"{base_url}/api/scan/scan_bc_cnt01")
    assert r1.status_code == 200
    r2 = requests.get(f"{base_url}/api/scan/scan_bc_cnt01")
    assert r2.status_code == 200


# --- Scan: WIFI mode ---


def test_scan_wifi_without_config_linked(base_url, owner_session, owner_establishment_id):
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "scan_wf_no01",
            "establishmentId": owner_establishment_id,
            "mode": "WIFI",
        },
    )

    r = requests.get(f"{base_url}/api/scan/scan_wf_no01")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is True
    assert data["code"] == "scan_wf_no01"


def test_scan_wifi_with_config_linked(base_url, owner_session, owner_establishment_id):
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "scan_wf_yes01",
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
        if qr["code"] == "scan_wf_yes01":
            qr_id = qr["id"]
            break
    assert qr_id is not None

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "wifiConfigId": wifi_id},
    )

    r = requests.get(f"{base_url}/api/scan/scan_wf_yes01")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is False
    assert data["mode"] == "WIFI"
    assert data["wifiConfig"]["ssid"] == "TestNetwork_E2E"
    assert data["wifiConfig"]["password"] == "testpass123"
    assert data["wifiConfig"]["encryption"] == "WPA"
    assert data["wifiConfig"]["hidden"] is False


def test_scan_wifi_increments_counter(base_url, owner_session, owner_establishment_id):
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "scan_wf_cnt01",
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
        if qr["code"] == "scan_wf_cnt01":
            qr_id = qr["id"]
            break
    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "wifiConfigId": wifi_id},
    )

    r1 = requests.get(f"{base_url}/api/scan/scan_wf_cnt01")
    assert r1.status_code == 200
    r2 = requests.get(f"{base_url}/api/scan/scan_wf_cnt01")
    assert r2.status_code == 200


# --- Scan: FILE mode ---


def test_scan_file_without_asset_linked(base_url, owner_session, owner_establishment_id):
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "scan_file_no01",
            "establishmentId": owner_establishment_id,
            "mode": "FILE",
        },
    )

    r = requests.get(f"{base_url}/api/scan/scan_file_no01")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is True
    assert data["code"] == "scan_file_no01"


def test_scan_file_with_asset_linked(base_url, owner_session, owner_establishment_id):
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "scan_file_yes01",
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
        owner_session, base_url, "scan_file_yes01", owner_establishment_id
    )
    assert qr is not None

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr["id"], "fileAssetId": file_asset["id"], "mode": "FILE"},
    )

    r = requests.get(f"{base_url}/api/scan/scan_file_yes01")
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
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "scan_file_cnt01",
            "establishmentId": owner_establishment_id,
            "mode": "FILE",
        },
    )

    file_asset = upload_test_file_asset(owner_session, base_url, file_name="counter.pdf")

    qr = find_qrcode_by_code(
        owner_session, base_url, "scan_file_cnt01", owner_establishment_id
    )
    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr["id"], "fileAssetId": file_asset["id"]},
    )

    before = owner_session.get(
        f"{base_url}/api/qrcodes", params={"id": qr["id"]}
    ).json()["qrcode"]["scansCount"]

    r1 = requests.get(f"{base_url}/api/scan/scan_file_cnt01")
    assert r1.status_code == 200
    r2 = requests.get(f"{base_url}/api/scan/scan_file_cnt01")
    assert r2.status_code == 200

    after = owner_session.get(
        f"{base_url}/api/qrcodes", params={"id": qr["id"]}
    ).json()["qrcode"]["scansCount"]
    assert after >= before + 2


# --- Scan: REVIEW mode (default) ---


def test_scan_review_mode_returns_establishment(base_url, owner_session, owner_establishment_id):
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "scan_rev01",
            "establishmentId": owner_establishment_id,
            "mode": "REVIEW",
        },
    )

    r = requests.get(f"{base_url}/api/scan/scan_rev01")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is False
    assert data["establishmentName"] is not None
    assert data["qrCodeId"] is not None
    assert data["redirectUrl"] is not None
    assert data.get("mode") is None


# --- Scan: unactivated QR with non-REVIEW mode ---


def test_scan_unactivated_business_card_mode(base_url, owner_session):
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "scan_bc_unact",
            "mode": "BUSINESS_CARD",
        },
    )

    r = requests.get(f"{base_url}/api/scan/scan_bc_unact")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is True


def test_scan_unactivated_wifi_mode(base_url, owner_session):
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "scan_wf_unact",
            "mode": "WIFI",
        },
    )

    r = requests.get(f"{base_url}/api/scan/scan_wf_unact")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is True


def test_scan_unactivated_file_mode(base_url, owner_session):
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "scan_file_unact",
            "mode": "FILE",
        },
    )

    r = requests.get(f"{base_url}/api/scan/scan_file_unact")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is True


# --- QR code includes businessCard/wifiConfig/fileAsset in GET ---


def test_get_qrcode_includes_business_card(owner_session, base_url, owner_establishment_id):
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "qr_bc_get01",
            "establishmentId": owner_establishment_id,
            "mode": "BUSINESS_CARD",
        },
    )
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
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "qr_wf_get01",
            "establishmentId": owner_establishment_id,
            "mode": "WIFI",
        },
    )
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
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "qr_file_get01",
            "establishmentId": owner_establishment_id,
            "mode": "FILE",
        },
    )
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
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "qr_file_list01",
            "establishmentId": owner_establishment_id,
            "mode": "FILE",
        },
    )
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
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "qr_bc_unlk01",
            "establishmentId": owner_establishment_id,
            "mode": "BUSINESS_CARD",
        },
    )
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

    r = requests.get(f"{base_url}/api/scan/qr_bc_unlk01")
    assert r.status_code == 200
    assert r.json()["needsActivation"] is True


def test_unlink_wifi_config_from_qr(owner_session, base_url, owner_establishment_id):
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "qr_wf_unlk01",
            "establishmentId": owner_establishment_id,
            "mode": "WIFI",
        },
    )
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

    r = requests.get(f"{base_url}/api/scan/qr_wf_unlk01")
    assert r.status_code == 200
    assert r.json()["needsActivation"] is True


def test_unlink_file_asset_from_qr(owner_session, base_url, owner_establishment_id):
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "qr_file_unlk01",
            "establishmentId": owner_establishment_id,
            "mode": "FILE",
        },
    )
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

    r = requests.get(f"{base_url}/api/scan/qr_file_unlk01")
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
