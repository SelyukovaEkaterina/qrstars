import uuid

import requests as req_lib

from conftest import login


def unique_email(prefix="onb"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@test.example.com"


def test_reviews_onboarding_sets_completed_and_event(base_url):
    email = unique_email()
    password = "secure123"
    reg = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "name": "Onboarding User", "consentPd": True},
    )
    assert reg.status_code == 200

    session = req_lib.Session()
    login(session, base_url, email, password)

    session.post(f"{base_url}/api/events", json={"event": "setup.intent_viewed"})
    session.post(
        f"{base_url}/api/events",
        json={"event": "setup.intent_selected", "props": {"intent": "reviews"}},
    )
    session.post(
        f"{base_url}/api/events",
        json={"event": "setup.form_submitted", "props": {"intent": "reviews"}},
    )

    qs = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "reviews",
            "name": "Onboarding Cafe",
            "yandexMapsUrl": "https://yandex.ru/maps/org/onboarding/123/",
        },
    )
    assert qs.status_code == 200, qs.text
    data = qs.json()
    assert data["establishment"]["name"] == "Onboarding Cafe"
    qr_id = data["qrcode"]["id"]

    session.post(
        f"{base_url}/api/events",
        json={
            "event": "setup.completed",
            "props": {"intent": "reviews", "qrCodeId": qr_id, "establishmentId": data["establishment"]["id"]},
        },
    )

    onboarding = session.get(f"{base_url}/api/user/onboarding")
    assert onboarding.status_code == 200
    assert onboarding.json().get("onboardingCompleted") is True

    listed = session.get(f"{base_url}/api/events")
    assert listed.status_code == 200
    completed = [
        e
        for e in listed.json().get("events", [])
        if e["event"] == "setup.completed"
    ]
    assert len(completed) >= 1
    assert completed[0]["props"]["intent"] == "reviews"
