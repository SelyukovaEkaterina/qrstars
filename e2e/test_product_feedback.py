"""Product feedback: authenticated owners can send an idea; invalid requests are rejected."""

import requests


def test_product_feedback_requires_auth(base_url):
    response = requests.post(
        f"{base_url}/api/product-feedback", json={"message": "Нужна новая функция"}
    )
    assert response.status_code == 401


def test_product_feedback_accepts_idea(owner_session, base_url):
    response = owner_session.post(
        f"{base_url}/api/product-feedback",
        json={"message": "Добавьте фильтр отзывов по площадке", "pageUrl": "https://app.qrstars.ru/dashboard/reviews"},
    )
    assert response.status_code == 201
    assert response.json()["id"]


def test_product_feedback_rejects_empty_message(owner_session, base_url):
    response = owner_session.post(f"{base_url}/api/product-feedback", json={"message": "   "})
    assert response.status_code == 400
