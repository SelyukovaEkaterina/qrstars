"""E2E для дневных снапшотов сканов (DailyScanStat).

Проверяет, что FREE-сканы (которые не пишут detail-лог в QRScan)
корректно агрегируются через DailyScanStat и видны в отчётной аналитике.
"""
import time

import requests

from conftest import reset_user_to_free, unique_code

CRON_SECRET = "test-cron-secret-for-e2e"


def _scan(base_url, code, times):
    for _ in range(times):
        requests.get(f"{base_url}/q/{code}", allow_redirects=True)
    # Без Redis в тестовом окружении запись scansCount синхронная, но даём фору.
    time.sleep(0.3)


def _scans_count(session, base_url, qr_id):
    r = session.get(f"{base_url}/api/qrcodes", params={"id": qr_id})
    assert r.status_code == 200, r.text
    return r.json()["qrcode"]["scansCount"]


def _snapshot(base_url, period="today"):
    r = requests.post(
        f"{base_url}/api/cron/snapshot-scans",
        params={"period": period},
        headers={"Authorization": f"Bearer {CRON_SECRET}"},
    )
    assert r.status_code == 200, r.text
    return r.json()


def _inspect(session, base_url, qr_id):
    r = session.get(
        f"{base_url}/api/admin/scan-snapshots", params={"qrCodeId": qr_id}
    )
    assert r.status_code == 200, r.text
    return r.json()["rows"]


def test_daily_scan_snapshot_counts_free_scans(
    owner_session, admin_session, base_url, owner_establishment_id, http
):
    """FREE-сканы учитываются в DailyScanStat (baseline=0, затем дельта)."""
    reset_user_to_free(admin_session, base_url)

    code = unique_code("snap")
    create_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": code,
            "establishmentId": owner_establishment_id,
            "mode": "REVIEW",
        },
    )
    assert create_r.status_code == 200, create_r.text
    qr = next(
        q
        for q in owner_session.get(
            f"{base_url}/api/qrcodes", params={"establishmentId": owner_establishment_id}
        ).json()["qrcodes"]
        if q["code"] == code
    )
    qr_id = qr["id"]

    # 1. K1 сканов на FREE-тарифе
    _scan(base_url, code, 3)
    scans_after_first = _scans_count(owner_session, base_url, qr_id)

    # 2. Первый снапшот за сегодня. Новый QR (создан сегодня, нет вчерашнего
    #    baseline) → count = scansCount (все сканы за день).
    res = _snapshot(base_url, period="today")
    assert res["ok"] is True
    assert res["rowsUpserted"] >= 1

    rows = _inspect(admin_session, base_url, qr_id)
    assert rows, "Expected at least one DailyScanStat row"
    baseline = rows[0]  # latest by date desc
    assert baseline["count"] == scans_after_first, (
        f"New QR same-day count must equal scansCount, got {baseline['count']}"
    )
    assert baseline["snapshot"] == scans_after_first

    # 3. Ещё K2 сканов
    _scan(base_url, code, 2)
    scans_after_second = _scans_count(owner_session, base_url, qr_id)
    assert scans_after_second == scans_after_first + 2

    # 4. Повторный снапшот (upsert того же дня) → count = scansCount (обновлён)
    res2 = _snapshot(base_url, period="today")
    assert res2["ok"] is True

    rows2 = _inspect(admin_session, base_url, qr_id)
    updated = rows2[0]
    assert updated["count"] == scans_after_second, (
        f"Re-snapshot must reflect new scansCount, got {updated['count']}"
    )
    assert updated["snapshot"] == scans_after_second
    assert updated["date"] == baseline["date"], "Same day → same date key"


def test_scan_snapshots_admin_requires_admin(base_url, http):
    """Инспекта снапшотов требует ADMIN-сессию."""
    r = http.get(f"{base_url}/api/admin/scan-snapshots")
    assert r.status_code == 401
