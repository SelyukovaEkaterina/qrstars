import uuid

import requests as req_lib


def unique_email(prefix="qa"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@e2e.qrstars.ru"


def test_qa_cookie_marks_registration_internal_test(admin_session, base_url):
    email = unique_email("cookie")
    password = "secure123"
    session = req_lib.Session()
    session.cookies.set("qrstars_no_analytics", "1", path="/")

    reg = session.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": password,
            "name": "QA Cookie User",
            "consentPd": True,
            "utm_campaign": "qa_check",
        },
    )
    assert reg.status_code == 200, reg.text
    user_id = reg.json()["user"]["id"]

    detail = admin_session.get(f"{base_url}/api/admin/users/{user_id}")
    assert detail.status_code == 200, detail.text
    user = detail.json()["user"]
    assert user["registrationSource"] == "internal_test"
    assert user["registrationUtm"]["utm_campaign"] == "qa_check"


def test_internal_test_email_without_cookie(admin_session, base_url):
    email = f"qa-{uuid.uuid4().hex[:8]}@example.com"
    reg = req_lib.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": "secure123",
            "name": "Internal Email User",
            "consentPd": True,
        },
    )
    assert reg.status_code == 200, reg.text
    user_id = reg.json()["user"]["id"]

    detail = admin_session.get(f"{base_url}/api/admin/users/{user_id}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["user"]["registrationSource"] == "internal_test"


def test_normal_registration_without_qa(admin_session, base_url):
    email = unique_email("real")
    reg = req_lib.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": "secure123",
            "name": "Real User",
            "consentPd": True,
        },
    )
    assert reg.status_code == 200, reg.text
    user_id = reg.json()["user"]["id"]

    detail = admin_session.get(f"{base_url}/api/admin/users/{user_id}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["user"]["registrationSource"] == "register"
