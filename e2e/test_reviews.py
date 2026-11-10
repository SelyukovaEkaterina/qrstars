import pytest
import requests as req_lib


def test_create_review_positive(base_url, owner_establishment_id):
    r = req_lib.post(
        f"{base_url}/api/reviews",
        json={
            "establishmentId": owner_establishment_id,
            "rating": 5,
            "comment": "E2E test positive review",
            "guestName": "E2E Guest",
            "isNegative": False,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["reviewId"] is not None


def test_create_review_negative(base_url, owner_establishment_id):
    r = req_lib.post(
        f"{base_url}/api/reviews",
        json={
            "establishmentId": owner_establishment_id,
            "rating": 2,
            "comment": "E2E test negative review",
            "guestName": "Angry Guest",
            "guestPhone": "+79991112233",
            "isNegative": True,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True


def test_create_review_missing_fields(base_url):
    r = req_lib.post(
        f"{base_url}/api/reviews",
        json={"rating": 5},
    )
    assert r.status_code == 400


def test_get_reviews(base_url, owner_session, owner_establishment_id):
    r = owner_session.get(
        f"{base_url}/api/reviews",
        params={"establishmentId": owner_establishment_id},
    )
    assert r.status_code == 200
    data = r.json()
    assert "reviews" in data
    assert "total" in data
    assert isinstance(data["reviews"], list)
    assert data["total"] >= 0


def test_get_reviews_with_pagination(base_url, owner_session, owner_establishment_id):
    r = owner_session.get(
        f"{base_url}/api/reviews",
        params={"establishmentId": owner_establishment_id, "limit": "5", "offset": "0"},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["reviews"]) <= 5


def test_get_reviews_missing_establishment(base_url, owner_session):
    r = owner_session.get(f"{base_url}/api/reviews")
    assert r.status_code == 200
    data = r.json()
    assert "reviews" in data


def _post_review(base_url, payload, ip):
    # Свой IP на тест — не упираемся в лимит 10 отзывов/мин с одного адреса.
    return req_lib.post(f"{base_url}/api/reviews", json=payload, headers={"X-Forwarded-For": ip})


@pytest.mark.parametrize(
    "patch",
    [
        {"rating": 4.5},
        {"rating": "5"},
        {"rating": 0},
        {"comment": "x" * 2001},
        {"guestName": "n" * 101},
        {"guestPhone": "p" * 121},
        {"comment": {"nested": True}},
    ],
)
def test_create_review_rejects_invalid_fields(base_url, owner_establishment_id, patch):
    payload = {"establishmentId": owner_establishment_id, "rating": 2, "comment": "ok", "isNegative": True}
    payload.update(patch)
    r = _post_review(base_url, payload, "10.77.0.1")
    assert r.status_code == 400, r.text


def test_create_review_coerces_non_boolean_is_negative(base_url, owner_session, owner_establishment_id):
    """Строковый isNegative раньше ронял Prisma с 500."""
    r = _post_review(
        base_url,
        {"establishmentId": owner_establishment_id, "rating": 3, "comment": "e2e-coerce", "isNegative": "yes"},
        "10.77.0.2",
    )
    assert r.status_code == 200, r.text


def test_create_negative_review_responds_fast(base_url, owner_establishment_id):
    """Уведомления уходят после ответа — гость не ждёт Telegram/SMTP."""
    import time

    started = time.monotonic()
    r = _post_review(
        base_url,
        {
            "establishmentId": owner_establishment_id,
            "rating": 1,
            "comment": "E2E fast complaint",
            "guestPhone": "@e2e_guest",
            "isNegative": True,
            "pdConsentGiven": True,
        },
        "10.77.0.3",
    )
    assert r.status_code == 200, r.text
    assert time.monotonic() - started < 3
