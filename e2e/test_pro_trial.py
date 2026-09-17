"""E2E: пробный период PRO (14 дней) и микросайт после его окончания."""

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests as req_lib

from conftest import login

CRON_SECRET = os.environ.get("CRON_SECRET", "test-cron-secret-for-e2e")
PASSWORD = "secure123"


def unique_email(prefix="trial"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@test.example.com"


def register_and_login(base_url, email=None):
    email = email or unique_email()
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "name": "Trial User",
            "consentPd": True,
        },
    )
    assert r.status_code == 200, r.text
    user = r.json()["user"]

    session = req_lib.Session()
    login(session, base_url, email, PASSWORD)
    return session, user


YANDEX_MAPS_URL = "https://yandex.ru/maps/org/test_cafe/1234567890/"


def quick_start_landing(session, base_url, name="Пробный микросайт"):
    return session.post(
        f"{base_url}/api/setup/quick-start",
        json={"intent": "landing", "name": name, "yandexMapsUrl": YANDEX_MAPS_URL},
    )


def assert_landing_open(base_url, code):
    """LANDING отдаётся гостям: в ответе нет landingLocked."""
    scan = req_lib.get(f"{base_url}/api/scan/{code}")
    assert scan.status_code == 200, scan.text
    assert scan.json().get("landingLocked") is None, scan.text


def set_trial_end(admin_session, base_url, user_id, ends_at):
    r = admin_session.patch(
        f"{base_url}/api/admin/users/{user_id}",
        json={"proTrialEndsAt": ends_at.isoformat()},
    )
    assert r.status_code == 200, r.text


def run_renewal_cron(base_url):
    return req_lib.post(
        f"{base_url}/api/cron/renew-subscriptions",
        headers={"Authorization": f"Bearer {CRON_SECRET}"},
    )


class TestProTrialActivation:
    def test_fresh_user_is_eligible(self, base_url):
        session, _ = register_and_login(base_url)
        r = session.get(f"{base_url}/api/subscription/trial")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["eligible"] is True
        assert data["active"] is False
        assert data["used"] is False
        assert data["days"] == 14

    def test_trial_requires_auth(self, base_url):
        r = req_lib.post(f"{base_url}/api/subscription/trial")
        assert r.status_code == 401

    def test_landing_blocked_before_trial(self, base_url):
        session, _ = register_and_login(base_url)
        r = quick_start_landing(session, base_url)
        assert r.status_code == 403, r.text
        assert r.json().get("upgradeRequired") == "PRO"

    def test_trial_unlocks_landing(self, base_url):
        session, _ = register_and_login(base_url)

        started = session.post(f"{base_url}/api/subscription/trial")
        assert started.status_code == 200, started.text
        assert started.json()["days"] == 14

        state = session.get(f"{base_url}/api/subscription").json()
        assert state["plan"] == "PRO"
        assert state["hasPaidFeatures"] is True
        assert state["trial"]["active"] is True
        assert 0 < state["trial"]["daysLeft"] <= 14

        created = quick_start_landing(session, base_url)
        assert created.status_code == 200, created.text
        assert created.json()["qrcode"]["mode"] == "LANDING"

        assert_landing_open(base_url, created.json()["qrcode"]["code"])

    def test_trial_cannot_start_twice(self, base_url):
        session, _ = register_and_login(base_url)
        assert session.post(f"{base_url}/api/subscription/trial").status_code == 200

        again = session.post(f"{base_url}/api/subscription/trial")
        assert again.status_code == 409, again.text

        state = session.get(f"{base_url}/api/subscription/trial").json()
        assert state["used"] is True
        assert state["eligible"] is False


class TestAfterProTrial:
    @pytest.fixture
    def expired_trial(self, base_url, admin_session):
        """Пользователь с микросайтом, у которого триал уже закрыт cron-ом."""
        session, user = register_and_login(base_url)
        assert session.post(f"{base_url}/api/subscription/trial").status_code == 200

        created = quick_start_landing(session, base_url)
        assert created.status_code == 200, created.text
        payload = created.json()

        set_trial_end(
            admin_session,
            base_url,
            user["id"],
            datetime.now(timezone.utc) - timedelta(days=1),
        )
        cron = run_renewal_cron(base_url)
        assert cron.status_code == 200, cron.text

        return {
            "session": session,
            "user": user,
            "establishment_id": payload["establishment"]["id"],
            "code": payload["qrcode"]["code"],
        }

    def test_plan_returns_to_free(self, base_url, expired_trial):
        state = expired_trial["session"].get(f"{base_url}/api/subscription").json()
        assert state["plan"] == "FREE"
        assert state["hasPaidFeatures"] is False
        assert state["trial"]["active"] is False
        assert state["trial"]["used"] is True
        assert state["trial"]["eligible"] is False

    def test_microsite_stays_public(self, base_url, expired_trial):
        assert_landing_open(base_url, expired_trial["code"])

    def test_microsite_settings_frozen(self, base_url, expired_trial):
        session = expired_trial["session"]
        est_id = expired_trial["establishment_id"]

        page = session.get(f"{base_url}/api/establishments/{est_id}/page")
        assert page.status_code == 200, page.text
        assert page.json()["micrositeFrozen"] is True
        assert page.json()["hadPaidAccess"] is True

        blocked = session.put(
            f"{base_url}/api/establishments/{est_id}/page",
            json={"pageModules": {"menu": True, "review": False, "businessCard": True, "wifi": True}},
        )
        assert blocked.status_code == 403, blocked.text
        assert blocked.json().get("upgradeRequired") == "PRO"

        blocked_subtitle = session.put(
            f"{base_url}/api/establishments/{est_id}/page",
            json={"landingSubtitle": "Новый подзаголовок"},
        )
        assert blocked_subtitle.status_code == 403, blocked_subtitle.text

        # Брендинг применяется и к бесплатным страницам — он не заморожен.
        branding = session.put(
            f"{base_url}/api/establishments/{est_id}/page",
            json={"brandColor": "#ff0000"},
        )
        assert branding.status_code == 200, branding.text

    def test_section_content_still_editable(self, base_url, expired_trial):
        """Меню и визитка нужны бесплатным QR — их правка не блокируется."""
        session = expired_trial["session"]
        est_id = expired_trial["establishment_id"]

        r = session.put(
            f"{base_url}/api/establishments/{est_id}/page",
            json={"landingTipsPhone": "+79990000000"},
        )
        assert r.status_code == 200, r.text


class TestExistingOwnersNotDowngraded:
    """Старые пользователи не должны терять то, что у них уже работало."""

    def set_plan(self, admin_session, base_url, user_id, plan):
        r = admin_session.patch(
            f"{base_url}/api/admin/users/{user_id}",
            json={"subscriptionPlan": plan},
        )
        assert r.status_code == 200, r.text

    def test_free_owner_without_paid_history_can_edit_microsite(self, base_url):
        """FREE-владелец без платной истории правит страницу как раньше."""
        session, _ = register_and_login(base_url)
        created = session.post(
            f"{base_url}/api/setup/quick-start",
            json={
                "intent": "review",
                "name": "Без микросайта",
                "yandexMapsUrl": YANDEX_MAPS_URL,
            },
        )
        assert created.status_code == 200, created.text
        est_id = created.json()["establishment"]["id"]

        page = session.get(f"{base_url}/api/establishments/{est_id}/page")
        assert page.status_code == 200, page.text
        assert page.json()["micrositeFrozen"] is False

        r = session.put(
            f"{base_url}/api/establishments/{est_id}/page",
            json={"brandColor": "#2563eb"},
        )
        assert r.status_code == 200, r.text

    def test_former_paying_owner_keeps_microsite_published(
        self, base_url, admin_session
    ):
        """Оплата закончилась — таблички продолжают открывать микросайт."""
        session, user = register_and_login(base_url)
        self.set_plan(admin_session, base_url, user["id"], "PRO")

        created = quick_start_landing(session, base_url, name="Бывший PRO")
        assert created.status_code == 200, created.text
        payload = created.json()

        self.set_plan(admin_session, base_url, user["id"], "FREE")

        assert_landing_open(base_url, payload["qrcode"]["code"])

        page = session.get(
            f"{base_url}/api/establishments/{payload['establishment']['id']}/page"
        )
        assert page.status_code == 200, page.text
        assert page.json()["micrositeFrozen"] is True
