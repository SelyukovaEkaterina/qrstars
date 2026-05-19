import pytest


# --- Business Card CRUD ---


def test_create_business_card(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/business-cards",
        json={
            "fullName": "Иван Иванов",
            "title": "Менеджер",
            "company": "ООО Тест",
            "phone": "+79991234567",
            "email": "ivan@test.com",
            "website": "https://test.com",
            "address": "г. Москва, ул. Тестовая, 1",
            "about": "Опытный менеджер",
            "theme": "dark",
            "accentColor": "#ff0000",
        },
    )
    assert r.status_code == 200
    data = r.json()
    card = data["businessCard"]
    assert card["fullName"] == "Иван Иванов"
    assert card["title"] == "Менеджер"
    assert card["company"] == "ООО Тест"
    assert card["phone"] == "+79991234567"
    assert card["email"] == "ivan@test.com"
    assert card["website"] == "https://test.com"
    assert card["address"] == "г. Москва, ул. Тестовая, 1"
    assert card["about"] == "Опытный менеджер"
    assert card["theme"] == "dark"
    assert card["accentColor"] == "#ff0000"


def test_create_business_card_minimal(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/business-cards",
        json={"fullName": "Минимал Тестов"},
    )
    assert r.status_code == 200
    card = r.json()["businessCard"]
    assert card["fullName"] == "Минимал Тестов"
    assert card["title"] is None
    assert card["company"] is None
    assert card["theme"] == "minimal"
    assert card["accentColor"] == "#4f46e5"


def test_create_business_card_without_name(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/business-cards",
        json={"title": "Без имени"},
    )
    assert r.status_code == 400


def test_create_business_card_with_social_links(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/business-cards",
        json={
            "fullName": "Социальный Тестов",
            "socialLinks": [
                {"platform": "telegram", "url": "https://t.me/test"},
                {"platform": "vk", "url": "https://vk.com/test"},
            ],
        },
    )
    assert r.status_code == 200
    card = r.json()["businessCard"]
    assert len(card["socialLinks"]) == 2
    assert card["socialLinks"][0]["platform"] == "telegram"


def test_create_business_card_unauthorized(base_url):
    r = base_url
    import requests
    resp = requests.post(
        f"{r}/api/business-cards",
        json={"fullName": "Хакер"},
    )
    assert resp.status_code == 401


def test_get_business_cards(owner_session, base_url):
    owner_session.post(
        f"{base_url}/api/business-cards",
        json={"fullName": "Лист Тестов"},
    )

    r = owner_session.get(f"{base_url}/api/business-cards")
    assert r.status_code == 200
    data = r.json()
    assert "businessCards" in data
    assert isinstance(data["businessCards"], list)
    assert len(data["businessCards"]) > 0


def test_update_business_card(owner_session, base_url):
    create_r = owner_session.post(
        f"{base_url}/api/business-cards",
        json={"fullName": "Обновляем Тестова"},
    )
    card_id = create_r.json()["businessCard"]["id"]

    link_qr_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={"code": "bc_upd_link01", "mode": "BUSINESS_CARD"},
    )
    qr_id = link_qr_r.json()["qrcode"]["id"]

    import requests
    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "businessCardId": card_id},
    )

    r = owner_session.put(
        f"{base_url}/api/business-cards",
        json={
            "id": card_id,
            "fullName": "Обновлён Тестов",
            "title": "Новая должность",
            "phone": "+79990001111",
        },
    )
    assert r.status_code == 200
    card = r.json()["businessCard"]
    assert card["fullName"] == "Обновлён Тестов"
    assert card["title"] == "Новая должность"
    assert card["phone"] == "+79990001111"


def test_update_business_card_not_found(owner_session, base_url):
    r = owner_session.put(
        f"{base_url}/api/business-cards",
        json={"id": "nonexistent_id", "fullName": "Не существует"},
    )
    assert r.status_code == 404


def test_update_business_card_missing_id(owner_session, base_url):
    r = owner_session.put(
        f"{base_url}/api/business-cards",
        json={"fullName": "Без ID"},
    )
    assert r.status_code == 400


def test_business_card_contact_validation(owner_session, base_url):
    create_r = owner_session.post(
        f"{base_url}/api/business-cards",
        json={"fullName": "Контакт Тестов"},
    )
    card_id = create_r.json()["businessCard"]["id"]

    link_qr_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={"code": "bc_contact_val01", "mode": "BUSINESS_CARD"},
    )
    qr_id = link_qr_r.json()["qrcode"]["id"]
    qr_code = link_qr_r.json()["qrcode"]["code"]

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "businessCardId": card_id, "isActive": True},
    )

    owner_session.put(
        f"{base_url}/api/business-cards",
        json={"id": card_id, "contactEnabled": True},
    )

    r = owner_session.post(
        f"{base_url}/api/business-cards/contact",
        json={"qrCode": qr_code, "guestName": "", "message": "Привет"},
    )
    assert r.status_code == 400

    r = owner_session.post(
        f"{base_url}/api/business-cards/contact",
        json={"qrCode": qr_code, "guestName": "Гость", "message": "x"},
    )
    assert r.status_code == 400

    r = owner_session.post(
        f"{base_url}/api/business-cards/contact",
        json={"qrCode": qr_code, "guestName": "Гость", "message": "Тестовое сообщение"},
    )
    assert r.status_code == 503


def test_business_card_contact_disabled(owner_session, base_url):
    create_r = owner_session.post(
        f"{base_url}/api/business-cards",
        json={"fullName": "Без связи"},
    )
    card_id = create_r.json()["businessCard"]["id"]

    link_qr_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={"code": "bc_contact_off01", "mode": "BUSINESS_CARD"},
    )
    qr_code = link_qr_r.json()["qrcode"]["code"]

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": link_qr_r.json()["qrcode"]["id"], "businessCardId": card_id, "isActive": True},
    )

    r = owner_session.post(
        f"{base_url}/api/business-cards/contact",
        json={"qrCode": qr_code, "guestName": "Гость", "message": "Сообщение"},
    )
    assert r.status_code == 403


def test_update_business_card_contact_fields(owner_session, base_url):
    contact_r = owner_session.post(
        f"{base_url}/api/messenger-contacts",
        json={
            "provider": "TELEGRAM",
            "externalId": "12345",
            "label": "Тест Telegram",
        },
    )
    assert contact_r.status_code == 200
    contact_id = contact_r.json()["contact"]["id"]

    create_r = owner_session.post(
        f"{base_url}/api/business-cards",
        json={"fullName": "Связь Тестов", "contactEnabled": True},
    )
    card_id = create_r.json()["businessCard"]["id"]

    r = owner_session.put(
        f"{base_url}/api/business-cards",
        json={
            "id": card_id,
            "contactEnabled": True,
            "contactMessengerId": contact_id,
        },
    )
    assert r.status_code == 200
    card = r.json()["businessCard"]
    assert card["contactEnabled"] is True
    assert card["contactMessengerId"] == contact_id


def test_get_business_card_by_id(owner_session, base_url):
    create_r = owner_session.post(
        f"{base_url}/api/business-cards",
        json={"fullName": "По ID"},
    )
    card_id = create_r.json()["businessCard"]["id"]

    r = owner_session.get(f"{base_url}/api/business-cards?id={card_id}")
    assert r.status_code == 200
    assert r.json()["businessCard"]["id"] == card_id


def test_update_business_card_theme_and_color(owner_session, base_url):
    create_r = owner_session.post(
        f"{base_url}/api/business-cards",
        json={"fullName": "Тема Тестова"},
    )
    card_id = create_r.json()["businessCard"]["id"]

    link_qr_r = owner_session.post(
        f"{base_url}/api/qrcodes",
        json={"code": "bc_theme_link01", "mode": "BUSINESS_CARD"},
    )
    qr_id = link_qr_r.json()["qrcode"]["id"]

    owner_session.put(
        f"{base_url}/api/qrcodes",
        json={"id": qr_id, "businessCardId": card_id},
    )

    r = owner_session.put(
        f"{base_url}/api/business-cards",
        json={"id": card_id, "theme": "gradient", "accentColor": "#00ff00"},
    )
    assert r.status_code == 200
    card = r.json()["businessCard"]
    assert card["theme"] == "gradient"
    assert card["accentColor"] == "#00ff00"
