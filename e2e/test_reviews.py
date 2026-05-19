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


def test_get_reviews(base_url, owner_establishment_id):
    r = req_lib.get(
        f"{base_url}/api/reviews",
        params={"establishmentId": owner_establishment_id},
    )
    assert r.status_code == 200
    data = r.json()
    assert "reviews" in data
    assert "total" in data
    assert isinstance(data["reviews"], list)
    assert data["total"] >= 0


def test_get_reviews_with_pagination(base_url, owner_establishment_id):
    r = req_lib.get(
        f"{base_url}/api/reviews",
        params={"establishmentId": owner_establishment_id, "limit": "5", "offset": "0"},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["reviews"]) <= 5


def test_get_reviews_missing_establishment(base_url):
    r = req_lib.get(f"{base_url}/api/reviews")
    assert r.status_code == 400
