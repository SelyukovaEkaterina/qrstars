"""«Приведи друга»: первая оплата приглашённого даёт +30 дней PRO ему и пригласившему.

Заменила денежную партнёрку (15%, вывод на ИП/ООО) 2026-11-15.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests as req_lib

from robokassa_helpers import robokassa_result_url

BONUS_DAYS = 30
DAY = timedelta(days=1)


def _register(base_url, prefix, ref=None):
    s = req_lib.Session()
    email = f"{prefix}-{uuid.uuid4().hex[:8]}@test.com"
    payload = {"email": email, "password": "test123456", "name": "Ref Test", "consentPd": True}
    if ref:
        payload["ref"] = ref
    r = s.post(f"{base_url}/api/auth/register", json=payload)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    csrf = s.get(f"{base_url}/api/auth/csrf").json()["csrfToken"]
    s.post(
        f"{base_url}/api/auth/callback/credentials",
        data={"email": email, "password": "test123456", "csrfToken": csrf, "json": "true"},
        allow_redirects=False,
    )
    return s, email


def _pay(session, base_url, plan="PRO", billing="yearly"):
    r = session.post(
        f"{base_url}/api/subscription",
        json={"action": "subscribe", "plan": plan, "billing": billing, "recurringConsent": True},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    if data.get("mode") == "mock":
        pytest.skip("Robokassa not configured")
    wh = req_lib.get(robokassa_result_url(base_url, data["paymentId"], f"{data['amount']:.2f}"))
    assert wh.status_code == 200, wh.text
    return data["paymentId"]


def _subscription(session, base_url):
    r = session.get(f"{base_url}/api/subscription")
    assert r.status_code == 200, r.text
    return r.json()


def _period_end(sub_data):
    return datetime.fromisoformat(sub_data["subscription"]["currentPeriodEnd"].replace("Z", "+00:00"))


def _assert_close(actual, expected, tolerance=DAY):
    assert abs(actual - expected) < tolerance, f"{actual} != {expected}"


def _now():
    return datetime.now(timezone.utc)


@pytest.fixture
def referrer(base_url):
    s, email = _register(base_url, "referrer")
    code = s.get(f"{base_url}/api/partner").json()["referralCode"]
    return s, email, code


# ── Ссылка и список приглашённых ───────────────────────────────────


def test_partner_requires_auth(base_url):
    assert req_lib.get(f"{base_url}/api/partner").status_code == 401


def test_referral_code_generated_and_stable(referrer, base_url):
    s, _, code = referrer
    data = s.get(f"{base_url}/api/partner").json()
    assert len(code) == 8
    assert data["referralCode"] == code
    assert data["referralLink"].endswith(f"/register?ref={code}")
    assert data["bonusDays"] == BONUS_DAYS
    assert data["stats"] == {"totalReferrals": 0, "paidReferrals": 0, "bonusDaysEarned": 0}
    # Денежной партнёрки больше нет.
    assert "earnings" not in data and "withdrawals" not in data


def test_referred_user_shown_with_masked_email(referrer, base_url):
    s, _, code = referrer
    _, friend_email = _register(base_url, "friend", ref=code)

    r = s.get(f"{base_url}/api/partner")
    assert friend_email not in r.text, "полный email приглашённого не должен уходить пригласившему"
    users = r.json()["referredUsers"]
    assert len(users) == 1
    masked = users[0]["emailMasked"]
    assert masked == f"{friend_email[0]}***@test.com"
    assert users[0]["paid"] is False
    assert "id" not in users[0]


def test_register_with_invalid_ref_code_still_works(base_url):
    s, _ = _register(base_url, "noref", ref="INVALIDCODE")
    assert _subscription(s, base_url)["referral"] is None


def test_register_with_own_ref_code_conflicts(referrer, base_url):
    _, email, code = referrer
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": "test123456", "consentPd": True, "ref": code},
    )
    assert r.status_code == 409


def test_withdraw_endpoint_removed(referrer, base_url):
    s, _, _ = referrer
    r = s.post(
        f"{base_url}/api/partner/withdraw",
        json={"recepientName": "Test", "recepientInn": "1234567890", "recepientType": "IP"},
    )
    assert r.status_code in (404, 405)


# ── Награды ────────────────────────────────────────────────────────


def test_friend_sees_pending_bonus_before_payment(referrer, base_url):
    _, _, code = referrer
    friend, _ = _register(base_url, "friend", ref=code)
    referral = _subscription(friend, base_url)["referral"]
    assert referral == {"invited": True, "bonusDays": BONUS_DAYS, "bonusGranted": False}


def test_friend_payment_rewards_both_free_referrer_gets_gift(referrer, base_url):
    ref_s, _, code = referrer
    friend, _ = _register(base_url, "friend", ref=code)

    _pay(friend, base_url, "PRO", "yearly")

    friend_sub = _subscription(friend, base_url)
    assert friend_sub["plan"] == "PRO"
    assert friend_sub["referral"]["bonusGranted"] is True
    _assert_close(_period_end(friend_sub), _now() + timedelta(days=365 + BONUS_DAYS))

    ref_sub = _subscription(ref_s, base_url)
    assert ref_sub["plan"] == "PRO"
    assert ref_sub["hasPaidFeatures"] is True
    assert ref_sub["subscription"]["giftReason"] == "referral"
    _assert_close(_period_end(ref_sub), _now() + timedelta(days=BONUS_DAYS))

    stats = ref_s.get(f"{base_url}/api/partner").json()
    assert stats["stats"]["paidReferrals"] == 1
    assert stats["stats"]["bonusDaysEarned"] == BONUS_DAYS
    assert stats["referredUsers"][0]["paid"] is True


def test_reward_is_granted_once_per_friend(referrer, base_url):
    ref_s, _, code = referrer
    friend, _ = _register(base_url, "friend", ref=code)

    _pay(friend, base_url, "PRO", "yearly")
    # Апгрейд до «Сети» — тоже первая оплата (INITIAL), но награда уже выдана.
    _pay(friend, base_url, "NETWORK", "yearly")

    stats = ref_s.get(f"{base_url}/api/partner").json()["stats"]
    assert stats["paidReferrals"] == 1
    assert stats["bonusDaysEarned"] == BONUS_DAYS
    _assert_close(_period_end(_subscription(ref_s, base_url)), _now() + timedelta(days=BONUS_DAYS))


def test_paid_referrer_gets_period_extended(referrer, base_url):
    ref_s, _, code = referrer
    _pay(ref_s, base_url, "PRO", "yearly")
    before = _period_end(_subscription(ref_s, base_url))

    friend, _ = _register(base_url, "friend", ref=code)
    _pay(friend, base_url, "PRO", "halfyear")

    ref_sub = _subscription(ref_s, base_url)
    assert ref_sub["subscription"]["giftReason"] is None
    _assert_close(_period_end(ref_sub), before + timedelta(days=BONUS_DAYS), tolerance=timedelta(minutes=5))


def test_gift_referrer_can_buy_pro_and_keeps_gift_days(referrer, base_url):
    ref_s, _, code = referrer
    friend, _ = _register(base_url, "friend", ref=code)
    _pay(friend, base_url, "PRO", "yearly")
    assert _subscription(ref_s, base_url)["subscription"]["giftReason"] == "referral"

    # Подарочный PRO не блокирует оплату, остаток дней переносится.
    _pay(ref_s, base_url, "PRO", "yearly")
    ref_sub = _subscription(ref_s, base_url)
    assert ref_sub["subscription"]["giftReason"] is None
    _assert_close(_period_end(ref_sub), _now() + timedelta(days=365 + BONUS_DAYS))


def test_payment_without_referrer_has_no_bonus(base_url):
    s, _ = _register(base_url, "norefer")
    _pay(s, base_url, "PRO", "yearly")
    sub = _subscription(s, base_url)
    assert sub["referral"] is None
    _assert_close(_period_end(sub), _now() + timedelta(days=365))
