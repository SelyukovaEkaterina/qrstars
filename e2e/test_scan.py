import pytest
import requests


def test_scan_active_qr(base_url):
    r = requests.get(f"{base_url}/api/scan/abc12345")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is False
    assert data["establishmentName"] is not None
    assert data["qrCodeId"] is not None
    assert data["redirectUrl"] is not None


def test_scan_unactivated_qr(base_url):
    r = requests.get(f"{base_url}/api/scan/xyz99999")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is True
    assert data["code"] == "xyz99999"


def test_scan_nonexistent_qr(base_url):
    r = requests.get(f"{base_url}/api/scan/nonexistent_code")
    assert r.status_code == 404
    data = r.json()
    assert "error" in data or "не найден" in data.get("error", "")


def test_scan_increments_counter(base_url):
    r1 = requests.get(f"{base_url}/api/scan/abc12345")
    assert r1.status_code == 200
    r2 = requests.get(f"{base_url}/api/scan/abc12345")
    assert r2.status_code == 200


def test_scan_active_qr_2(base_url):
    r = requests.get(f"{base_url}/api/scan/def67890")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is False
