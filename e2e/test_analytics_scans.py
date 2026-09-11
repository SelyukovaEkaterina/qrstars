from conftest import set_user_plan, reset_user_to_free, unique_code
import requests
import time


def _create_qr_and_scan(owner_session, base_url, establishment_id, prefix):
    code = unique_code(prefix)
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={"code": code, "establishmentId": establishment_id, "mode": "REVIEW"},
    )
    assert create_r.status_code in (200, 201), create_r.text

    scan_r = requests.get(f"{base_url}/q/{code}", allow_redirects=True)
    assert scan_r.status_code == 200

    for _ in range(20):
        qrcodes = owner_session.get(
            f"{base_url}/api/qrcodes", params={"establishmentId": establishment_id}
        ).json()["qrcodes"]
        qr = next(q for q in qrcodes if q["code"] == code)
        if qr["scansCount"] >= 1:
            return code, qr
        time.sleep(0.3)
    raise AssertionError(f"Scan for {code} never reached scansCount")


def _qr_stats(owner_session, base_url, code, period="7d"):
    r = owner_session.get(f"{base_url}/api/analytics", params={"period": period})
    assert r.status_code == 200
    data = r.json()
    qr = next((q for q in data["qrcodes"] if q["code"] == code), None)
    assert qr is not None, f"QR {code} missing in analytics response"
    return data, qr


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


def test_analytics_counts_scans_without_detailed_logs(
    owner_session, admin_session, base_url, owner_establishment_id
):
    """Сканы на FREE попадают в объёмные метрики (DailyScanStat + дельта за сегодня)."""
    from datetime import datetime, timedelta, timezone

    reset_user_to_free(admin_session, base_url)
    code, qr = _create_qr_and_scan(
        owner_session, base_url, owner_establishment_id, "freeagg"
    )
    scans = qr["scansCount"]

    set_user_plan(admin_session, base_url, "PRO")
    data, analytics_qr = _qr_stats(owner_session, base_url, code)

    assert analytics_qr["scansCount"] == scans
    assert data["stats"]["totalScans"] >= scans
    assert not [s for s in data["periodScans"] if s["qrCode"] == code], (
        "FREE scan must stay out of the detailed log"
    )

    msk_today = (datetime.now(timezone.utc) + timedelta(hours=3)).strftime("%Y-%m-%d")
    today_point = next((d for d in data["dailyScans"] if d["date"] == msk_today), None)
    assert today_point is not None, "dailyScans must include the current MSK day"
    assert today_point["count"] >= scans

    review_mode = next((m for m in data["scansByMode"] if m["mode"] == "REVIEW"), None)
    assert review_mode is not None and review_mode["scans"] >= scans


def test_analytics_scans_not_double_counted_after_snapshot(
    owner_session, admin_session, base_url, owner_establishment_id
):
    """Снапшот за сегодня не удваивает сканы: живая дельта считается от него."""
    reset_user_to_free(admin_session, base_url)
    code, _ = _create_qr_and_scan(
        owner_session, base_url, owner_establishment_id, "snapagg"
    )

    set_user_plan(admin_session, base_url, "PRO")
    _, before = _qr_stats(owner_session, base_url, code)

    snapshot_r = requests.post(
        f"{base_url}/api/cron/snapshot-scans", params={"period": "today"}
    )
    assert snapshot_r.status_code == 200, snapshot_r.text

    _, after = _qr_stats(owner_session, base_url, code)
    assert after["scansCount"] == before["scansCount"]
