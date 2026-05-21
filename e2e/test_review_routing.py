import pytest
import requests


def test_scan_review_returns_routing(base_url, owner_session, owner_establishment_id):
    owner_session.post(
        f"{base_url}/api/qrcodes",
        json={
            "code": "scan_routing01",
            "establishmentId": owner_establishment_id,
            "mode": "REVIEW",
        },
    )

    r = requests.get(f"{base_url}/api/scan/scan_routing01")
    assert r.status_code == 200
    data = r.json()
    assert data["needsActivation"] is False
    assert "reviewRouting" in data
    assert data["reviewRouting"]["1"]["action"] == "COMPLAINT"
    assert data["reviewRouting"]["4"]["action"] == "TWO_GIS"
    assert data["reviewRouting"]["5"]["action"] == "YANDEX"
    assert "platformUrls" in data
    assert data["platformUrls"]["yandexMapsUrl"] is not None


def test_free_user_cannot_save_review_routing(owner_session, base_url, owner_establishment_id):
    custom = {
        "1": {
            "action": "COMPLAINT",
            "promptTitle": "Test",
            "promptSubtitle": "Sub",
            "thanksTitle": "Thanks",
            "thanksSubtitle": "Sub thanks",
            "ctaLabel": "Send",
        }
    }
    for star in ("2", "3", "4", "5"):
        custom[star] = custom["1"].copy()

    r = owner_session.put(
        f"{base_url}/api/settings",
        json={"id": owner_establishment_id, "reviewRouting": custom},
    )
    assert r.status_code == 403


def test_pro_user_can_save_review_routing(admin_session, owner_session, base_url, owner_establishment_id):
    users = admin_session.get(f"{base_url}/api/admin/users", params={"search": "demo@smartreview.ru"}).json()
    demo_user = next((u for u in users["users"] if u["email"] == "demo@smartreview.ru"), None)
    assert demo_user is not None

    admin_session.patch(
        f"{base_url}/api/admin/users/{demo_user['id']}",
        json={"subscriptionPlan": "PRO", "subscriptionStatus": "ACTIVE"},
    )

    custom = {
        "5": {
            "action": "AVITO",
            "promptTitle": "Спасибо за 5 звёзд!",
            "promptSubtitle": "Оставьте отзыв на Авито",
            "thanksTitle": "Супер!",
            "thanksSubtitle": "Ждём вас снова",
            "ctaLabel": "На Авито",
        }
    }
    for star in ("1", "2", "3", "4"):
        custom[star] = {
            "action": "COMPLAINT",
            "promptTitle": "Жалоба",
            "promptSubtitle": "Напишите нам",
            "thanksTitle": "Принято",
            "thanksSubtitle": "Ответим скоро",
            "ctaLabel": "Отправить",
        }

    r = owner_session.put(
        f"{base_url}/api/settings",
        json={"id": owner_establishment_id, "reviewRouting": custom},
    )
    assert r.status_code == 200
    assert r.json()["establishment"]["reviewRouting"]["5"]["action"] == "AVITO"

    admin_session.patch(
        f"{base_url}/api/admin/users/{demo_user['id']}",
        json={"subscriptionPlan": "FREE", "subscriptionStatus": "ACTIVE"},
    )
