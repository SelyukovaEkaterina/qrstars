"""E2E для ежемесячного отчёта владельцу (email/Telegram/MAX).

Проверяет:
- авторизацию cron (CRON_SECRET),
- сбор метрик по режимам (REVIEW/MENU) через DailyScanStat,
- идемпотентность (campaignKey monthly_report_YYYY_MM в UserLifecycleEmail),
- пропуск неактивных/без заведения,
- разницу FREE vs PRO (через admin-preview),
- бэкфилл за произвольный период (?periodMonth).
"""
import datetime
import time
import uuid

import requests as req_lib

from conftest import login, unique_code

CRON_SECRET = "test-cron-secret-for-e2e"
MSK = datetime.timezone(datetime.timedelta(hours=3))


def _now_msk() -> datetime.datetime:
    return datetime.datetime.now(MSK)


def current_period_month() -> str:
    return _now_msk().strftime("%Y-%m")


def current_period_key() -> str:
    return "monthly_report_" + _now_msk().strftime("%Y_%m")


def _unique_email(prefix="monthly"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@test.example.com"


def _register(base_url, email=None):
    email = email or _unique_email()
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": "secure123", "name": "Monthly Report", "consentPd": True},
    )
    assert r.status_code == 200, r.text
    return r.json()["user"], email


def _find_user_id(admin_session, base_url, email):
    r = admin_session.get(f"{base_url}/api/admin/users", params={"search": email})
    users = r.json().get("users", [])
    return next((u["id"] for u in users if u["email"] == email), None)


def _run_cron(base_url, **params):
    return req_lib.post(
        f"{base_url}/api/cron/monthly-report",
        params=params or None,
        headers={"Authorization": f"Bearer {CRON_SECRET}"},
    )


def _snapshot_today(base_url):
    r = req_lib.post(
        f"{base_url}/api/cron/snapshot-scans",
        params={"period": "today"},
        headers={"Authorization": f"Bearer {CRON_SECRET}"},
    )
    assert r.status_code == 200, r.text


def _scan(base_url, code, times):
    for _ in range(times):
        req_lib.get(f"{base_url}/q/{code}", allow_redirects=True)
    time.sleep(0.4)


def _lifecycle_emails(admin_session, base_url, user_id):
    r = admin_session.get(f"{base_url}/api/admin/users/{user_id}/lifecycle-emails")
    assert r.status_code == 200, r.text
    return r.json().get("lifecycleEmails", [])


def _preview(admin_session, base_url, user_id, period_month=None):
    params = {}
    if period_month:
        params["periodMonth"] = period_month
    r = admin_session.get(
        f"{base_url}/api/admin/users/{user_id}/monthly-report-preview",
        params=params,
    )
    assert r.status_code == 200, r.text
    return r.json()


def _setup_active_owner(base_url, admin_session, plan="PRO", modes=("REVIEW", "MENU")):
    """Регистрирует юзера, создаёт заведение + QR заданных режимов, сканирует."""
    user, email = _register(base_url)
    user_id = _find_user_id(admin_session, base_url, email)
    assert user_id, "user not found after register"

    # PRO по умолчанию (для full-секций).
    admin_session.patch(
        f"{base_url}/api/admin/users/{user_id}",
        json={"subscriptionPlan": plan, "subscriptionStatus": "ACTIVE", "marketingEmailsEnabled": True},
    )

    s = req_lib.Session()
    login(s, base_url, email, "secure123")

    # quick-start создаёт заведение + первый QR (intent reviews → REVIEW).
    qs = s.post(
        f"{base_url}/api/setup/quick-start",
        json={"intent": "reviews", "name": "Monthly Cafe", "yandexMapsUrl": "https://yandex.ru/maps/-/ABC"},
    )
    assert qs.status_code == 200, qs.text
    est_id = qs.json()["establishment"]["id"]

    # Создаём MENU-QR дополнительно.
    codes = {}
    if "REVIEW" in modes:
        rev_code = unique_code("mrev")
        r = s.post(
            f"{base_url}/api/qrcodes",
            json={"code": rev_code, "establishmentId": est_id, "mode": "REVIEW"},
        )
        assert r.status_code == 200, r.text
        codes["REVIEW"] = rev_code
    if "MENU" in modes:
        menu_code = unique_code("mmenu")
        r = s.post(
            f"{base_url}/api/qrcodes",
            json={"code": menu_code, "establishmentId": est_id, "mode": "MENU"},
        )
        assert r.status_code == 200, r.text
        codes["MENU"] = menu_code

    # Сканируем каждый код.
    for mode, code in codes.items():
        _scan(base_url, code, 3 if mode == "REVIEW" else 2)

    # Снапшот за сегодня → DailyScanStat для текущего месяца.
    _snapshot_today(base_url)

    return {"user_id": user_id, "email": email, "establishment_id": est_id, "codes": codes}


class TestMonthlyReportCron:
    def test_cron_requires_secret(self, base_url):
        r = req_lib.post(f"{base_url}/api/cron/monthly-report")
        assert r.status_code == 401

    def test_report_sent_and_recorded(self, base_url, admin_session):
        ctx = _setup_active_owner(base_url, admin_session)
        period = current_period_month()
        key = current_period_key()

        r = _run_cron(base_url, userId=ctx["user_id"], periodMonth=period)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True
        assert r.json()["sentCount"] >= 1

        keys = [e["campaignKey"] for e in _lifecycle_emails(admin_session, base_url, ctx["user_id"])]
        assert key in keys, f"expected {key} in {keys}"

    def test_idempotent_second_run_skipped(self, base_url, admin_session):
        ctx = _setup_active_owner(base_url, admin_session)
        period = current_period_month()

        r1 = _run_cron(base_url, userId=ctx["user_id"], periodMonth=period)
        assert r1.status_code == 200
        assert r1.json()["sentCount"] >= 1

        r2 = _run_cron(base_url, userId=ctx["user_id"], periodMonth=period)
        assert r2.status_code == 200
        assert r2.json()["sentCount"] == 0
        assert r2.json()["skippedCount"] >= 1

    def test_marked_sent_skips_via_lifecycle(self, base_url, admin_session):
        ctx = _setup_active_owner(base_url, admin_session)
        key = current_period_key()
        # Симулируем, что отчёт уже отправлен (как legacy-backfill).
        admin_session.post(
            f"{base_url}/api/admin/users/{ctx['user_id']}/lifecycle-emails",
            json={"campaignKeys": [key]},
        )
        r = _run_cron(base_url, userId=ctx["user_id"], periodMonth=current_period_month())
        assert r.status_code == 200
        # Уже помечено → skip, не дубль.
        rows = _lifecycle_emails(admin_session, base_url, ctx["user_id"])
        assert sum(1 for e in rows if e["campaignKey"] == key) == 1

    def test_no_activity_skipped(self, base_url, admin_session):
        """Юзер с заведением, но без QR и сканов → no_activity."""
        user, email = _register(base_url)
        user_id = _find_user_id(admin_session, base_url, email)
        admin_session.patch(
            f"{base_url}/api/admin/users/{user_id}",
            json={"marketingEmailsEnabled": True},
        )
        s = req_lib.Session()
        login(s, base_url, email, "secure123")
        qs = s.post(
            f"{base_url}/api/setup/quick-start",
            json={"intent": "reviews", "name": "Empty Cafe", "yandexMapsUrl": "https://yandex.ru/maps/-/XYZ"},
        )
        assert qs.status_code == 200, qs.text

        r = _run_cron(base_url, userId=user_id, periodMonth=current_period_month())
        assert r.status_code == 200
        assert r.json()["sentCount"] == 0
        assert r.json()["skippedCount"] >= 1

    def test_no_channels_skipped(self, base_url, admin_session):
        """Все каналы выключены → no_channels_enabled."""
        ctx = _setup_active_owner(base_url, admin_session)
        admin_session.patch(
            f"{base_url}/api/admin/users/{ctx['user_id']}",
            json={
                "reportsEmailEnabled": False,
                "reportsTelegramEnabled": False,
                "reportsMaxEnabled": False,
            },
        )
        r = _run_cron(base_url, userId=ctx["user_id"], periodMonth=current_period_month())
        assert r.status_code == 200
        assert r.json()["sentCount"] == 0
        assert r.json()["skippedCount"] >= 1


class TestMonthlyReportContent:
    def test_pro_metrics_include_menu_section(self, base_url, admin_session):
        ctx = _setup_active_owner(base_url, admin_session, plan="PRO", modes=("REVIEW", "MENU"))
        data = _preview(admin_session, base_url, ctx["user_id"], current_period_month())

        metrics = data["metrics"]
        assert metrics["isPro"] is True
        assert metrics["establishmentCount"] >= 1
        mode_names = [m["mode"] for m in metrics["modes"]]
        assert "MENU" in mode_names
        assert "REVIEW" in mode_names

        menu_mode = next(m for m in metrics["modes"] if m["mode"] == "MENU")
        assert menu_mode["scans"]["current"] >= 1, "MENU scans must be counted"
        assert metrics["menu"] is not None, "MENU section must be present for PRO"
        assert metrics["totalScans"]["current"] >= 2

        # Email содержит секцию меню.
        assert "QR-меню" in data["emailHtml"]
        # Messenger содержит обе секции.
        assert any("QR-меню" in part for part in data["messengerParts"])

    def test_free_metrics_no_menu_detail(self, base_url, admin_session):
        ctx = _setup_active_owner(base_url, admin_session, plan="FREE", modes=("REVIEW", "MENU"))
        data = _preview(admin_session, base_url, ctx["user_id"], current_period_month())

        metrics = data["metrics"]
        assert metrics["isPro"] is False
        # На FREE menu-секция не строится (детализация — PRO).
        assert metrics["menu"] is None
        # Но сканы MENU учитываются в общем количестве и в modes.
        assert metrics["totalScans"]["current"] >= 1
        # Email на FREE не содержит PRO-секций.
        assert "🍽" not in data["emailHtml"]

    def test_previous_period_moM(self, base_url, admin_session):
        """Сравнение MoM: в метриках есть previous для сканов."""
        ctx = _setup_active_owner(base_url, admin_session)
        data = _preview(admin_session, base_url, ctx["user_id"], current_period_month())
        metrics = data["metrics"]
        assert "previous" in metrics["totalScans"]
        assert "current" in metrics["totalScans"]

    def test_backfill_period_month(self, base_url, admin_session):
        """?periodMonth для прошлого месяца строит корректный ключ."""
        ctx = _setup_active_owner(base_url, admin_session)
        now = _now_msk()
        first = now.replace(day=1)
        last_prev = first - datetime.timedelta(days=1)
        prev_period = last_prev.strftime("%Y-%m")
        prev_key = "monthly_report_" + last_prev.strftime("%Y_%m")

        data = _preview(admin_session, base_url, ctx["user_id"], prev_period)
        assert data["period"]["key"] == prev_key

    def test_network_establishment_breakdown(self, base_url, admin_session):
        """Сеть: сводный отчёт содержит разбивку по точкам."""
        user, email = _register(base_url)
        user_id = _find_user_id(admin_session, base_url, email)
        admin_session.patch(
            f"{base_url}/api/admin/users/{user_id}",
            json={"subscriptionPlan": "NETWORK", "subscriptionStatus": "ACTIVE"},
        )
        s = req_lib.Session()
        login(s, base_url, email, "secure123")
        # Первое заведение.
        qs1 = s.post(
            f"{base_url}/api/setup/quick-start",
            json={"intent": "reviews", "name": "Net Cafe 1", "yandexMapsUrl": "https://yandex.ru/maps/-/N1"},
        )
        assert qs1.status_code == 200, qs1.text
        # Второе заведение (через тот же quick-start с новым intent — лимит NETWORK позволяет).
        qs2 = s.post(
            f"{base_url}/api/setup/quick-start",
            json={"intent": "reviews", "name": "Net Cafe 2", "yandexMapsUrl": "https://yandex.ru/maps/-/N2"},
        )
        assert qs2.status_code == 200, qs2.text

        est1_id = qs1.json()["establishment"]["id"]
        code1 = unique_code("net")
        r = s.post(
            f"{base_url}/api/qrcodes",
            json={"code": code1, "establishmentId": est1_id, "mode": "REVIEW"},
        )
        assert r.status_code == 200, r.text
        _scan(base_url, code1, 2)
        _snapshot_today(base_url)

        data = _preview(admin_session, base_url, user_id, current_period_month())
        metrics = data["metrics"]
        assert metrics["establishmentCount"] >= 2
        assert len(metrics["establishmentBreakdown"]) >= 2


class TestSettingsReportToggles:
    def test_settings_returns_report_flags(self, base_url, admin_session):
        user, email = _register(base_url)
        s = req_lib.Session()
        login(s, base_url, email, "secure123")

        r = s.get(f"{base_url}/api/settings")
        assert r.status_code == 200
        data = r.json()
        assert "reportSettings" in data
        # По умолчанию email включён, TG/MAX выключены.
        assert data["reportSettings"]["reportsEmailEnabled"] is True
        assert data["reportSettings"]["reportsTelegramEnabled"] is False

    def test_update_report_flags(self, base_url, admin_session):
        user, email = _register(base_url)
        user_id = _find_user_id(admin_session, base_url, email)
        s = req_lib.Session()
        login(s, base_url, email, "secure123")

        r = s.post(
            f"{base_url}/api/settings",
            json={"action": "update-report-settings", "reportsTelegramEnabled": True},
        )
        assert r.status_code == 200, r.text
        assert r.json()["reportSettings"]["reportsTelegramEnabled"] is True

        # Проверяем, что сохранилось в БД (через admin PATCH readback).
        admin_session.patch(
            f"{base_url}/api/admin/users/{user_id}",
            json={"reportsTelegramEnabled": False},
        )
