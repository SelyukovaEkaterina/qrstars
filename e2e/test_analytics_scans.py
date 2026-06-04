from conftest import set_user_plan
import time


def test_analytics_period_scans(owner_session, admin_session, base_url, owner_establishment_id):
    set_user_plan(admin_session, base_url, "PRO")

    list_r = owner_session.get(
        f"{base_url}/api/qrcodes",
        params={"establishmentId": owner_establishment_id},
    )
    assert list_r.status_code == 200
    qrcodes = list_r.json().get("qrcodes", [])
    assert qrcodes, "Need at least one QR code"
    code = qrcodes[0]["code"]

    scan_r = owner_session.get(f"{base_url}/q/{code}", allow_redirects=True)
    assert scan_r.status_code == 200

    matching = []
    for _ in range(15):
        analytics_r = owner_session.get(f"{base_url}/api/analytics", params={"period": "7d"})
        assert analytics_r.status_code == 200
        data = analytics_r.json()
        matching = [s for s in data.get("periodScans", []) if s["qrCode"] == code]
        if matching:
            break
        time.sleep(0.3)

    assert "periodScans" in data
    assert "dailyScans" in data
    assert "scanDayOfWeekStats" in data
    assert "scanHourStats" in data
    assert "deviceStats" in data
    assert len(data["scanDayOfWeekStats"]) == 7
    assert len(data["scanHourStats"]) == 24
    assert isinstance(data["periodScans"], list)
    assert matching, "Expected logged scan for QR code in analytics periodScans"
    scan = matching[0]
    assert scan["device"]
    assert scan["browser"]
    assert scan["region"]
    assert scan["createdAt"]

    assert data["stats"]["totalScans"] >= 1


def test_analytics_csv_fields_present(owner_session, admin_session, base_url):
    set_user_plan(admin_session, base_url, "PRO")
    r = owner_session.get(f"{base_url}/api/analytics", params={"period": "30d"})
    assert r.status_code == 200
    data = r.json()
    assert "periodReviews" in data
    assert "periodScans" in data


def test_free_plan_does_not_log_detailed_scans(
    owner_session, admin_session, base_url, owner_establishment_id
):
    from conftest import reset_user_to_free, unique_code
    import requests

    reset_user_to_free(admin_session, base_url)
    code = unique_code("freescn")
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "REVIEW",
        },
    )

    before = owner_session.get(
        f"{base_url}/api/qrcodes", params={"establishmentId": owner_establishment_id}
    ).json()["qrcodes"]
    qr = next(q for q in before if q["code"] == code)
    scans_before = qr["scansCount"]

    r = requests.get(f"{base_url}/q/{code}", allow_redirects=True)
    assert r.status_code == 200

    time.sleep(0.5)

    after = owner_session.get(
        f"{base_url}/api/qrcodes", params={"id": qr["id"]}
    ).json()["qrcode"]["scansCount"]
    assert after >= scans_before + 1

    set_user_plan(admin_session, base_url, "PRO")
    analytics_r = owner_session.get(f"{base_url}/api/analytics", params={"period": "7d"})
    assert analytics_r.status_code == 200
    matching = [s for s in analytics_r.json().get("periodScans", []) if s["qrCode"] == code]
    assert not matching, "FREE plan scan should not create detailed QRScan log"
