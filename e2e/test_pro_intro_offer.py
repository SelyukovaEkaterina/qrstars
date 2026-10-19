import os
import uuid
from datetime import datetime, timedelta, timezone

import requests as req_lib

from conftest import login
from robokassa_helpers import robokassa_result_url

CRON_SECRET = os.environ.get("CRON_SECRET", "test-cron-secret-for-e2e")


def unique_email():
    return f"pro-offer-{uuid.uuid4().hex[:8]}@test.example.com"


def register(base_url, email=None):
    email = email or unique_email()
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": "secure123", "name": "Offer User", "consentPd": True},
    )
    assert r.status_code == 200, r.text
    return r.json()["user"], email


def run_cron(base_url):
    r = req_lib.post(
        f"{base_url}/api/cron/lifecycle-emails",
        headers={"Authorization": f"Bearer {CRON_SECRET}"},
    )
    assert r.status_code == 200, r.text
    return r.json()


def patch_user(admin_session, base_url, user_id, **fields):
    r = admin_session.patch(f"{base_url}/api/admin/users/{user_id}", json=fields)
    assert r.status_code == 200, r.text


def sent_keys_for(cron_json, user_id):
    return [
        item.get("campaignKey")
        for item in cron_json.get("sent", [])
        if item.get("userId") == user_id
    ]


def finish_subscribe(base_url, response, expected_amount):
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["amount"] == expected_amount
    if data.get("mode") == "mock":
        return data
    inv_id = data["paymentId"]
    out_sum = f"{data['amount']:.2f}"
    paid = req_lib.get(robokassa_result_url(base_url, inv_id, out_sum))
    assert paid.status_code == 200, paid.text
    assert paid.text == f"OK{inv_id}"
    return data


def lifecycle_keys(admin_session, base_url, user_id):
    r = admin_session.get(f"{base_url}/api/admin/users/{user_id}/lifecycle-emails")
    assert r.status_code == 200, r.text
    return [item["campaignKey"] for item in r.json().get("lifecycleEmails", [])]


def prepare_qr_user(base_url, admin_session, *, first_scan_days_ago, scans, cutoff_days_ago):
    user, email = register(base_url)
    session = req_lib.Session()
    login(session, base_url, email, "secure123")
    started = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "reviews",
            "name": "Кофейня оффера",
            "yandexMapsUrl": "https://yandex.ru/maps/org/test/123/",
        },
    )
    assert started.status_code == 200, started.text
    now = datetime.now(timezone.utc)
    patch_user(
        admin_session,
        base_url,
        user["id"],
        backdateProOfferSendsTo=(now - timedelta(days=2)).isoformat(),
    )
    patch_user(
        admin_session,
        base_url,
        user["id"],
        firstScanAt=(now - timedelta(days=first_scan_days_ago)).isoformat(),
        scansCount=scans,
        proOfferCampaignStartedAt=(now - timedelta(days=cutoff_days_ago)).isoformat(),
    )
    return user, email, session


class TestProIntroOffer:
    def test_sends_after_first_scan_window_and_not_twice(self, base_url, admin_session):
        user, _, session = prepare_qr_user(
            base_url,
            admin_session,
            first_scan_days_ago=20,
            scans=5,
            cutoff_days_ago=40,
        )
        cron = run_cron(base_url)
        assert "pro_offer_d14" in sent_keys_for(cron, user["id"])
        assert "pro_hint_d14" not in sent_keys_for(cron, user["id"])

        sub = session.get(f"{base_url}/api/subscription")
        assert sub.status_code == 200, sub.text
        offer = sub.json().get("introOffer")
        assert offer["amountRub"] == 690
        assert offer["listAmountRub"] == 990
        assert offer["code"].startswith("START30-")

        again = run_cron(base_url)
        assert "pro_offer_d14" not in sent_keys_for(again, user["id"])
        assert lifecycle_keys(admin_session, base_url, user["id"]).count("pro_offer_d14") == 1

    def test_skips_before_cutoff_recent_scan_few_scans_and_paid(self, base_url, admin_session):
        early, _, _ = prepare_qr_user(
            base_url, admin_session, first_scan_days_ago=20, scans=5, cutoff_days_ago=5
        )
        recent, _, _ = prepare_qr_user(
            base_url, admin_session, first_scan_days_ago=2, scans=5, cutoff_days_ago=40
        )
        quiet, _, _ = prepare_qr_user(
            base_url, admin_session, first_scan_days_ago=20, scans=2, cutoff_days_ago=40
        )
        paid, _, _ = prepare_qr_user(
            base_url, admin_session, first_scan_days_ago=20, scans=5, cutoff_days_ago=40
        )
        patch_user(admin_session, base_url, paid["id"], subscriptionPlan="PRO", subscriptionStatus="ACTIVE")

        bare, _ = register(base_url)
        now = datetime.now(timezone.utc)
        patch_user(
            admin_session,
            base_url,
            bare["id"],
            firstScanAt=(now - timedelta(days=20)).isoformat(),
            scansCount=10,
            proOfferCampaignStartedAt=(now - timedelta(days=40)).isoformat(),
        )

        # Последний patch ставит отсечку на 40 дней назад, поэтому «ранний» пользователь
        # проверяется отдельным прогоном до сдвига отсечки.
        patch_user(
            admin_session,
            base_url,
            early["id"],
            proOfferCampaignStartedAt=(now - timedelta(days=5)).isoformat(),
        )
        early_cron = run_cron(base_url)
        assert "pro_offer_d14" not in sent_keys_for(early_cron, early["id"])
        # Иначе следующий прогон с более ранней отсечкой догонит этот аккаунт.
        marked = admin_session.post(
            f"{base_url}/api/admin/users/{early['id']}/lifecycle-emails",
            json={"campaignKeys": ["pro_offer_d14"]},
        )
        assert marked.status_code == 200, marked.text

        patch_user(
            admin_session,
            base_url,
            early["id"],
            proOfferCampaignStartedAt=(now - timedelta(days=40)).isoformat(),
        )

        cron = run_cron(base_url)
        for user_id in (recent["id"], quiet["id"], paid["id"], bare["id"]):
            assert "pro_offer_d14" not in sent_keys_for(cron, user_id)
            assert "pro_offer_d14" not in lifecycle_keys(admin_session, base_url, user_id)

    def test_checkout_uses_own_code_and_rejects_foreign(self, base_url, admin_session):
        user, _, session = prepare_qr_user(
            base_url, admin_session, first_scan_days_ago=20, scans=5, cutoff_days_ago=40
        )
        run_cron(base_url)
        offer = session.get(f"{base_url}/api/subscription").json()["introOffer"]
        assert offer, "письмо не создало персональный код"

        other, other_email = register(base_url)
        other_session = req_lib.Session()
        login(other_session, base_url, other_email, "secure123")
        foreign = other_session.post(
            f"{base_url}/api/subscription",
            json={"action": "subscribe", "plan": "PRO", "recurringConsent": True, "promoCode": offer["code"]},
        )
        assert foreign.status_code == 400, foreign.text

        wrong = session.post(
            f"{base_url}/api/subscription",
            json={"action": "subscribe", "plan": "PRO", "recurringConsent": True, "promoCode": "START30-NOPE00"},
        )
        assert wrong.status_code == 400, wrong.text

        ok = session.post(
            f"{base_url}/api/subscription",
            json={"action": "subscribe", "plan": "PRO", "recurringConsent": True, "promoCode": offer["code"]},
        )
        finish_subscribe(base_url, ok, 690)

        after = session.get(f"{base_url}/api/subscription").json()
        assert after["plan"] == "PRO"
        assert after.get("introOffer") is None
        assert other["id"]

    def test_expired_code_charges_full_price(self, base_url, admin_session):
        user, _, session = prepare_qr_user(
            base_url, admin_session, first_scan_days_ago=20, scans=5, cutoff_days_ago=40
        )
        run_cron(base_url)
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        patch_user(admin_session, base_url, user["id"], introOfferExpiresAt=yesterday)

        sub = session.get(f"{base_url}/api/subscription").json()
        assert sub.get("introOffer") is None

        paid = session.post(
            f"{base_url}/api/subscription",
            json={"action": "subscribe", "plan": "PRO", "recurringConsent": True},
        )
        assert paid.status_code == 200, paid.text
        assert paid.json()["amount"] == 990

    def test_reminder_before_expiry_and_not_after_upgrade(self, base_url, admin_session):
        user, _, _ = prepare_qr_user(
            base_url, admin_session, first_scan_days_ago=20, scans=5, cutoff_days_ago=40
        )
        upgraded, _, _ = prepare_qr_user(
            base_url, admin_session, first_scan_days_ago=20, scans=5, cutoff_days_ago=40
        )
        run_cron(base_url)
        soon = (datetime.now(timezone.utc) + timedelta(hours=36)).isoformat()
        patch_user(admin_session, base_url, user["id"], introOfferExpiresAt=soon)
        patch_user(admin_session, base_url, upgraded["id"], introOfferExpiresAt=soon, subscriptionPlan="PRO", subscriptionStatus="ACTIVE")

        cron = run_cron(base_url)
        assert "pro_offer_reminder" in sent_keys_for(cron, user["id"])
        assert "pro_offer_reminder" not in sent_keys_for(cron, upgraded["id"])

        again = run_cron(base_url)
        assert "pro_offer_reminder" not in sent_keys_for(again, user["id"])

    def test_daily_cap_sends_five_and_leaves_the_rest(self, base_url, admin_session):
        users = []
        for _ in range(6):
            user, _, _ = prepare_qr_user(
                base_url, admin_session, first_scan_days_ago=20, scans=5, cutoff_days_ago=40
            )
            users.append(user)

        cron = run_cron(base_url)
        sent_ids = [
            user["id"]
            for user in users
            if "pro_offer_d14" in sent_keys_for(cron, user["id"])
        ]
        assert len(sent_ids) == 5
        missed = [user["id"] for user in users if user["id"] not in sent_ids]
        assert len(missed) == 1

        again = run_cron(base_url)
        assert "pro_offer_d14" not in sent_keys_for(again, missed[0])
