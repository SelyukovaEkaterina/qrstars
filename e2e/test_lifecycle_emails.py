import os
import uuid
from datetime import datetime, timedelta, timezone

import requests as req_lib

CRON_SECRET = os.environ.get("CRON_SECRET", "test-cron-secret-for-e2e")


def unique_email(prefix="lifecycle"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@test.example.com"


def register_user(base_url, email=None):
    email = email or unique_email()
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": "secure123",
            "name": "Lifecycle User",
            "consentPd": True,
        },
    )
    assert r.status_code == 200, r.text
    return r.json()["user"], email


def get_lifecycle_emails(admin_session, base_url, user_id):
    r = admin_session.get(f"{base_url}/api/admin/users/{user_id}/lifecycle-emails")
    assert r.status_code == 200, r.text
    return r.json().get("lifecycleEmails", [])


def run_lifecycle_cron(base_url):
    return req_lib.post(
        f"{base_url}/api/cron/lifecycle-emails",
        headers={"Authorization": f"Bearer {CRON_SECRET}"},
    )


def run_feedback_launch(base_url):
    return req_lib.post(
        f"{base_url}/api/cron/feedback-launch",
        headers={"Authorization": f"Bearer {CRON_SECRET}"},
    )


def get_test_token(admin_session, base_url, user_id, purpose, survey_kind="d7"):
    params = {"purpose": purpose}
    if purpose == "feedback":
        params["surveyKind"] = survey_kind
    r = admin_session.get(
        f"{base_url}/api/admin/users/{user_id}/signed-tokens",
        params=params,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


class TestLifecycleEmailsCron:
    def test_feedback_launch_requires_secret(self, base_url):
        r = req_lib.post(f"{base_url}/api/cron/feedback-launch")
        assert r.status_code == 401

    def test_feedback_launch_idempotent(self, base_url, admin_session):
        r1 = run_feedback_launch(base_url)
        assert r1.status_code == 200, r1.text
        r2 = run_feedback_launch(base_url)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("sentCount", 0) == 0

    def test_legacy_backfill_skips_nudge_cron(self, base_url, admin_session):
        """Seeded demo user is legacy — nudge emails should not fire on cron."""
        users_r = admin_session.get(
            f"{base_url}/api/admin/users", params={"search": "demo@smartreview.ru"}
        )
        user = users_r.json()["users"][0]
        old_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        admin_session.patch(
            f"{base_url}/api/admin/users/{user['id']}",
            json={"createdAt": old_date},
        )

        # Simulate legacy backfill: mark nudge campaigns as sent
        admin_session.post(
            f"{base_url}/api/admin/users/{user['id']}/lifecycle-emails",
            json={"campaignKeys": [
                "no_establishment_d1", "no_establishment_d3",
                "no_qr_d1", "no_qr_d4",
                "no_scans_d2", "no_scans_d5",
                "no_reviews_d3", "connect_telegram_d2",
                "pro_hint_d14", "welcome",
            ]},
        )

        # Run feedback-launch (simulates post-deploy: marks feedback as sent for legacy)
        run_feedback_launch(base_url)

        r = run_lifecycle_cron(base_url)
        assert r.status_code == 200
        sent_for_user = [
            item
            for item in r.json().get("sent", [])
            if item.get("userId") == user["id"]
            and item.get("campaignKey") in ("no_establishment_d1", "pro_hint_d14", "feedback_d7")
        ]
        assert sent_for_user == []

    def test_cron_requires_secret(self, base_url):
        r = req_lib.post(f"{base_url}/api/cron/lifecycle-emails")
        assert r.status_code == 401

    def test_register_records_welcome_email(self, base_url, admin_session):
        user, _ = register_user(base_url)
        # sendLifecycleEmail is fire-and-forget — poll for the record
        import time
        keys = []
        for _ in range(15):
            emails = get_lifecycle_emails(admin_session, base_url, user["id"])
            keys = [e["campaignKey"] for e in emails]
            if "welcome" in keys:
                break
            time.sleep(0.3)
        assert "welcome" in keys

    def test_welcome_not_sent_twice_by_cron(self, base_url, admin_session):
        user, _ = register_user(base_url)
        r = run_lifecycle_cron(base_url)
        assert r.status_code == 200
        emails = get_lifecycle_emails(admin_session, base_url, user["id"])
        welcome_count = sum(1 for e in emails if e["campaignKey"] == "welcome")
        assert welcome_count == 1

    def test_feedback_d7_after_seven_days(self, base_url, admin_session):
        user, _ = register_user(base_url)
        old_date = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
        patch_r = admin_session.patch(
            f"{base_url}/api/admin/users/{user['id']}",
            json={"createdAt": old_date},
        )
        assert patch_r.status_code == 200, patch_r.text

        r = run_lifecycle_cron(base_url)
        assert r.status_code == 200
        data = r.json()
        sent_keys = [item["campaignKey"] for item in data.get("sent", [])]
        assert "feedback_d7" in sent_keys

        emails = get_lifecycle_emails(admin_session, base_url, user["id"])
        assert any(e["campaignKey"] == "feedback_d7" for e in emails)

    def test_unsubscribe_skips_lifecycle_cron(self, base_url, admin_session):
        user, _ = register_user(base_url)
        old_date = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
        admin_session.patch(
            f"{base_url}/api/admin/users/{user['id']}",
            json={"createdAt": old_date, "marketingEmailsEnabled": False},
        )

        r = run_lifecycle_cron(base_url)
        assert r.status_code == 200
        sent_for_user = [
            item for item in r.json().get("sent", []) if item.get("userId") == user["id"]
        ]
        assert sent_for_user == []


class TestFeedbackForm:
    def test_feedback_submit(self, base_url, admin_session):
        user, _ = register_user(base_url)
        token = get_test_token(admin_session, base_url, user["id"], "feedback")

        r = req_lib.post(
            f"{base_url}/api/feedback",
            json={
                "token": token,
                "npsScore": 9,
                "comment": "Great product e2e",
                "contactOk": False,
            },
        )
        assert r.status_code == 200, r.text

        dup = req_lib.post(
            f"{base_url}/api/feedback",
            json={"token": token, "npsScore": 8},
        )
        assert dup.status_code == 409

    def test_feedback_d7_not_sent_after_submit(self, base_url, admin_session):
        user, _ = register_user(base_url)
        token = get_test_token(admin_session, base_url, user["id"], "feedback")
        req_lib.post(
            f"{base_url}/api/feedback",
            json={"token": token, "npsScore": 10},
        )

        old_date = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
        admin_session.patch(
            f"{base_url}/api/admin/users/{user['id']}",
            json={"createdAt": old_date},
        )
        r = run_lifecycle_cron(base_url)
        assert r.status_code == 200
        sent_keys = [
            item["campaignKey"]
            for item in r.json().get("sent", [])
            if item.get("userId") == user["id"]
        ]
        assert "feedback_d7" not in sent_keys

    def test_feedback_d90_survey_kind(self, base_url, admin_session):
        user, _ = register_user(base_url)
        token = get_test_token(admin_session, base_url, user["id"], "feedback", "d90")

        r = req_lib.get(f"{base_url}/api/feedback", params={"token": token})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["surveyKind"] == "d90"
        assert data["survey"]["title"] == "QrStars через 3 месяца"

    def test_feedback_d90_requires_activity(self, base_url, admin_session):
        user, _ = register_user(base_url)
        old_date = (datetime.now(timezone.utc) - timedelta(days=91)).isoformat()
        admin_session.patch(
            f"{base_url}/api/admin/users/{user['id']}",
            json={"createdAt": old_date},
        )
        r = run_lifecycle_cron(base_url)
        assert r.status_code == 200
        sent_keys = [
            item["campaignKey"]
            for item in r.json().get("sent", [])
            if item.get("userId") == user["id"]
        ]
        assert "feedback_d90" not in sent_keys

    def test_feedback_d90_after_ninety_days_active_user(self, base_url, admin_session):
        from conftest import login

        user, email = register_user(base_url)
        s = req_lib.Session()
        login(s, base_url, email, "secure123")
        qs = s.post(
            f"{base_url}/api/setup/quick-start",
            json={
                "intent": "reviews",
                "name": "Lifecycle Cafe",
                "yandexMapsUrl": "https://yandex.ru/maps/-/ABC",
            },
        )
        assert qs.status_code == 200, qs.text
        est_id = qs.json()["establishment"]["id"]

        rev = req_lib.post(
            f"{base_url}/api/reviews",
            json={
                "establishmentId": est_id,
                "rating": 5,
                "comment": "e2e lifecycle d90",
                "isNegative": False,
            },
        )
        assert rev.status_code == 200, rev.text

        old_date = (datetime.now(timezone.utc) - timedelta(days=91)).isoformat()
        admin_session.patch(
            f"{base_url}/api/admin/users/{user['id']}",
            json={"createdAt": old_date},
        )

        r = run_lifecycle_cron(base_url)
        assert r.status_code == 200
        sent_keys = [
            item["campaignKey"]
            for item in r.json().get("sent", [])
            if item.get("userId") == user["id"]
        ]
        assert "feedback_d90" in sent_keys


class TestUnsubscribe:
    def test_unsubscribe_disables_marketing(self, base_url, admin_session):
        user, _ = register_user(base_url)
        token = get_test_token(admin_session, base_url, user["id"], "unsubscribe")
        r = req_lib.get(f"{base_url}/api/unsubscribe", params={"token": token})
        assert r.status_code == 200
        assert "отписались" in r.text.lower()

        old_date = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
        admin_session.patch(
            f"{base_url}/api/admin/users/{user['id']}",
            json={"createdAt": old_date},
        )
        cron_r = run_lifecycle_cron(base_url)
        assert cron_r.status_code == 200
        sent_for_user = [
            item
            for item in cron_r.json().get("sent", [])
            if item.get("userId") == user["id"]
        ]
        assert sent_for_user == []
