import pytest
import uuid
import requests as req_lib

from robokassa_helpers import robokassa_result_url


def _pay_subscription(session, base_url, plan="PRO", billing="monthly"):
    sub_r = session.post(
        f"{base_url}/api/subscription",
        json={
            "action": "subscribe",
            "plan": plan,
            "billing": billing,
            "recurringConsent": True,
        },
    )
    assert sub_r.status_code == 200, sub_r.text
    data = sub_r.json()
    if data.get("mode") == "mock":
        pytest.skip("Robokassa not configured")
    inv_id = data["paymentId"]
    out_sum = f"{data['amount']:.2f}"
    wh = req_lib.get(robokassa_result_url(base_url, inv_id, out_sum))
    assert wh.status_code == 200
    return inv_id, data["amount"]


@pytest.fixture
def partner_session(base_url):
    s = req_lib.Session()
    email = f"partner-{uuid.uuid4().hex[:8]}@test.com"
    password = "test123456"

    r = s.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": password,
            "name": "Partner Test",
            "consentPd": True,
        },
    )
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"

    csrf_resp = s.get(f"{base_url}/api/auth/csrf")
    csrf_token = csrf_resp.json()["csrfToken"]
    s.post(
        f"{base_url}/api/auth/callback/credentials",
        data={
            "email": email,
            "password": password,
            "csrfToken": csrf_token,
            "json": "true",
        },
        allow_redirects=False,
    )
    yield s, email
    s.cookies.clear()


@pytest.fixture
def referral_session(base_url, partner_session):
    partner_s, _ = partner_session

    r = partner_s.get(f"{base_url}/api/partner")
    assert r.status_code == 200
    ref_code = r.json()["referralCode"]
    assert ref_code is not None

    s = req_lib.Session()
    email = f"ref-{uuid.uuid4().hex[:8]}@test.com"
    password = "test123456"

    r = s.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": password,
            "name": "Referred User",
            "consentPd": True,
            "ref": ref_code,
        },
    )
    assert r.status_code == 200, f"Ref register failed: {r.status_code} {r.text}"

    csrf_resp = s.get(f"{base_url}/api/auth/csrf")
    csrf_token = csrf_resp.json()["csrfToken"]
    s.post(
        f"{base_url}/api/auth/callback/credentials",
        data={
            "email": email,
            "password": password,
            "csrfToken": csrf_token,
            "json": "true",
        },
        allow_redirects=False,
    )
    yield s, email, ref_code
    s.cookies.clear()


def test_partner_requires_auth(base_url):
    s = req_lib.Session()
    r = s.get(f"{base_url}/api/partner")
    assert r.status_code == 401


def test_partner_generates_referral_code(partner_session, base_url):
    s, _ = partner_session
    r = s.get(f"{base_url}/api/partner")
    assert r.status_code == 200
    data = r.json()

    assert data["referralCode"] is not None
    assert len(data["referralCode"]) == 8
    assert "referralLink" in data
    assert data["referralCode"] in data["referralLink"]
    assert "stats" in data
    assert data["stats"]["totalReferrals"] == 0
    assert data["stats"]["totalEarned"] == 0
    assert data["stats"]["availableBalance"] == 0


def test_partner_code_stable(partner_session, base_url):
    s, _ = partner_session
    r1 = s.get(f"{base_url}/api/partner")
    code1 = r1.json()["referralCode"]

    r2 = s.get(f"{base_url}/api/partner")
    code2 = r2.json()["referralCode"]

    assert code1 == code2


def test_register_with_referral_code_links_user(base_url, referral_session):
    _, _, ref_code = referral_session
    assert ref_code is not None


def test_partner_sees_referred_user(partner_session, referral_session, base_url):
    partner_s, _ = partner_session
    ref_email = referral_session[1]

    r = partner_s.get(f"{base_url}/api/partner")
    assert r.status_code == 200
    data = r.json()

    assert data["stats"]["totalReferrals"] >= 1
    referred_emails = [u["email"] for u in data["referredUsers"]]
    assert ref_email in referred_emails


def test_register_with_invalid_ref_code_still_works(base_url):
    s = req_lib.Session()
    email = f"noref-{uuid.uuid4().hex[:8]}@test.com"
    r = s.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": "test123456",
            "name": "No Ref User",
            "consentPd": True,
            "ref": "INVALIDCODE",
        },
    )
    assert r.status_code == 200


def test_webhook_creates_partner_earning(base_url, referral_session):
    ref_s, ref_email, _ = referral_session

    session_r = ref_s.get(f"{base_url}/api/auth/session")
    ref_user_id = session_r.json()["user"]["id"]

    inv_id, amount = _pay_subscription(ref_s, base_url)
    assert inv_id is not None
    assert amount > 0


def test_webhook_partner_earning_appears(base_url, partner_session):
    partner_s, partner_email = partner_session

    r = partner_s.get(f"{base_url}/api/partner")
    ref_code = r.json()["referralCode"]

    s = req_lib.Session()
    ref_email = f"earn-{uuid.uuid4().hex[:8]}@test.com"
    reg_r = s.post(
        f"{base_url}/api/auth/register",
        json={
            "email": ref_email,
            "password": "test123456",
            "consentPd": True,
            "ref": ref_code,
        },
    )
    assert reg_r.status_code == 200

    csrf_resp = s.get(f"{base_url}/api/auth/csrf")
    csrf_token = csrf_resp.json()["csrfToken"]
    s.post(
        f"{base_url}/api/auth/callback/credentials",
        data={
            "email": ref_email,
            "password": "test123456",
            "csrfToken": csrf_token,
            "json": "true",
        },
        allow_redirects=False,
    )

    session_r = s.get(f"{base_url}/api/auth/session")
    ref_user_id = session_r.json()["user"]["id"]

    inv_id, amount = _pay_subscription(s, base_url)

    partner_r = partner_s.get(f"{base_url}/api/partner")
    data = partner_r.json()

    assert len(data["earnings"]) >= 1
    earning = data["earnings"][0]
    expected_commission = round(amount * 0.15, 2)
    assert earning["amount"] == expected_commission
    assert earning["paymentAmount"] == amount
    assert earning["status"] == "PENDING"
    assert earning["description"] is not None
    assert "15%" in earning["description"]


def test_webhook_no_earning_without_referrer(base_url):
    s = req_lib.Session()
    email = f"norefer-{uuid.uuid4().hex[:8]}@test.com"
    s.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": "test123456",
            "consentPd": True,
        },
    )

    csrf_resp = s.get(f"{base_url}/api/auth/csrf")
    csrf_token = csrf_resp.json()["csrfToken"]
    s.post(
        f"{base_url}/api/auth/callback/credentials",
        data={
            "email": email,
            "password": "test123456",
            "csrfToken": csrf_token,
            "json": "true",
        },
        allow_redirects=False,
    )

    session_r = s.get(f"{base_url}/api/auth/session")
    user_id = session_r.json()["user"]["id"]

    _pay_subscription(s, base_url)


def test_withdraw_requires_auth(base_url):
    s = req_lib.Session()
    r = s.post(
        f"{base_url}/api/partner/withdraw",
        json={"amount": 10000, "recepientName": "Test", "recepientInn": "1234567890", "recepientType": "IP"},
    )
    assert r.status_code == 401


def test_withdraw_minimum_amount(partner_session, base_url):
    s, _ = partner_session
    r = s.post(
        f"{base_url}/api/partner/withdraw",
        json={"amount": 5000, "recepientName": "Test", "recepientInn": "1234567890", "recepientType": "IP"},
    )
    assert r.status_code == 400
    assert "10 000" in r.json()["error"]


def test_withdraw_insufficient_funds(partner_session, base_url):
    s, _ = partner_session
    r = s.post(
        f"{base_url}/api/partner/withdraw",
        json={"amount": 10000, "recepientName": "Test", "recepientInn": "1234567890", "recepientType": "IP"},
    )
    assert r.status_code == 400


def test_withdraw_missing_fields(partner_session, base_url):
    s, _ = partner_session
    r = s.post(
        f"{base_url}/api/partner/withdraw",
        json={"amount": 10000},
    )
    assert r.status_code == 400


def test_register_with_own_ref_code(base_url, partner_session):
    partner_s, partner_email = partner_session

    r = partner_s.get(f"{base_url}/api/partner")
    ref_code = r.json()["referralCode"]

    s = req_lib.Session()
    reg_r = s.post(
        f"{base_url}/api/auth/register",
        json={
            "email": partner_email,
            "password": "test123456",
            "consentPd": True,
            "ref": ref_code,
        },
    )
    assert reg_r.status_code == 409
