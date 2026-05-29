import pytest
import requests

from conftest import unique_code


# --- Wifi Config CRUD ---


def test_create_wifi_config(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/wifi-configs",
        json={
            "ssid": "TestWifi_E2E",
            "password": "securepass123",
            "encryption": "WPA",
            "hidden": False,
        },
    )
    assert r.status_code == 200
    config = r.json()["wifiConfig"]
    assert config["ssid"] == "TestWifi_E2E"
    assert config["password"] == "securepass123"
    assert config["encryption"] == "WPA"
    assert config["hidden"] is False


def test_create_wifi_config_minimal(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/wifi-configs",
        json={"ssid": "MinimalWifi_E2E"},
    )
    assert r.status_code == 200
    config = r.json()["wifiConfig"]
    assert config["ssid"] == "MinimalWifi_E2E"
    assert config["password"] is None
    assert config["encryption"] == "WPA"
    assert config["hidden"] is False


def test_create_wifi_config_without_ssid(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/wifi-configs",
        json={"password": "no_ssid_pass"},
    )
    assert r.status_code == 400


def test_create_wifi_config_open_network(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/wifi-configs",
        json={
            "ssid": "OpenWifi_E2E",
            "encryption": "nopass",
        },
    )
    assert r.status_code == 200
    config = r.json()["wifiConfig"]
    assert config["ssid"] == "OpenWifi_E2E"
    assert config["encryption"] == "nopass"


def test_create_wifi_config_wpa2(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/wifi-configs",
        json={
            "ssid": "WPA2Wifi_E2E",
            "password": "wpa2pass",
            "encryption": "WPA2",
        },
    )
    assert r.status_code == 200
    config = r.json()["wifiConfig"]
    assert config["encryption"] == "WPA2"


def test_create_wifi_config_hidden_network(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/wifi-configs",
        json={
            "ssid": "HiddenWifi_E2E",
            "password": "hiddenpass",
            "hidden": True,
        },
    )
    assert r.status_code == 200
    config = r.json()["wifiConfig"]
    assert config["hidden"] is True


def test_create_wifi_config_unauthorized(base_url):
    resp = requests.post(
        f"{base_url}/api/wifi-configs",
        json={"ssid": "Unauthorized"},
    )
    assert resp.status_code == 401


def test_get_wifi_configs(owner_session, base_url):
    owner_session.post(
        f"{base_url}/api/wifi-configs",
        json={"ssid": "ListWifi_E2E"},
    )

    r = owner_session.get(f"{base_url}/api/wifi-configs")
    assert r.status_code == 200
    data = r.json()
    assert "wifiConfigs" in data
    assert isinstance(data["wifiConfigs"], list)


def test_update_wifi_config(owner_session, base_url):
    create_r = owner_session.post(
        f"{base_url}/api/wifi-configs",
        json={"ssid": "UpdateWifi_E2E", "password": "oldpass"},
    )
    config_id = create_r.json()["wifiConfig"]["id"]

    link_qr_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={"code": unique_code("wfupd"), "mode": "WIFI"},
    )
    assert link_qr_r.status_code == 200, f"Create QR failed: {link_qr_r.status_code} {link_qr_r.text}"
    qr_id = link_qr_r.json()["qrcode"]["id"]

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "wifiConfigId": config_id},
    )

    r = owner_session.put(
        f"{base_url}/api/wifi-configs",
        json={
            "id": config_id,
            "ssid": "UpdatedWifi_E2E",
            "password": "newpass",
            "encryption": "WPA2",
            "hidden": True,
        },
    )
    assert r.status_code == 200
    config = r.json()["wifiConfig"]
    assert config["ssid"] == "UpdatedWifi_E2E"
    assert config["password"] == "newpass"
    assert config["encryption"] == "WPA2"
    assert config["hidden"] is True


def test_update_wifi_config_not_found(owner_session, base_url):
    r = owner_session.put(
        f"{base_url}/api/wifi-configs",
        json={"id": "nonexistent_id", "ssid": "Not Found"},
    )
    assert r.status_code == 404


def test_update_wifi_config_missing_id(owner_session, base_url):
    r = owner_session.put(
        f"{base_url}/api/wifi-configs",
        json={"ssid": "No ID"},
    )
    assert r.status_code == 400


def test_update_wifi_config_partial(owner_session, base_url):
    create_r = owner_session.post(
        f"{base_url}/api/wifi-configs",
        json={"ssid": "PartialWifi_E2E", "password": "origpass", "encryption": "WPA"},
    )
    config_id = create_r.json()["wifiConfig"]["id"]

    link_qr_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={"code": unique_code("wfpart"), "mode": "WIFI"},
    )
    assert link_qr_r.status_code == 200, f"Create QR failed: {link_qr_r.status_code} {link_qr_r.text}"
    qr_id = link_qr_r.json()["qrcode"]["id"]

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "wifiConfigId": config_id},
    )

    r = owner_session.put(
        f"{base_url}/api/wifi-configs",
        json={"id": config_id, "password": "newpassonly"},
    )
    assert r.status_code == 200
    config = r.json()["wifiConfig"]
    assert config["ssid"] == "PartialWifi_E2E"
    assert config["password"] == "newpassonly"
    assert config["encryption"] == "WPA"
