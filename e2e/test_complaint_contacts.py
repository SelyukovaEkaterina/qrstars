import requests as req_lib


def test_negative_review_is_saved_with_contact(base_url, owner_establishment_id, owner_session):
    r = req_lib.post(
        f"{base_url}/api/reviews",
        json={
            "establishmentId": owner_establishment_id,
            "rating": 2,
            "comment": "Холодный кофе",
            "guestName": "Ирина",
            "guestPhone": "@irina",
            "isNegative": True,
            "pdConsentGiven": True,
        },
    )
    assert r.status_code == 200
    review_id = r.json()["reviewId"]

    listed = owner_session.get(f"{base_url}/api/reviews", params={"negative": "true"})
    assert listed.status_code == 200
    match = next((item for item in listed.json()["reviews"] if item["id"] == review_id), None)
    assert match is not None
    assert match["guestPhone"] == "@irina"
    assert match["comment"] == "Холодный кофе"
