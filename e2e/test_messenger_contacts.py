import pytest


def test_list_messenger_contacts_empty(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/messenger-contacts")
    assert r.status_code == 200
    data = r.json()
    assert "contacts" in data
    assert isinstance(data["contacts"], list)


def test_list_messenger_contacts_unauthorized(base_url):
    import requests

    r = requests.get(f"{base_url}/api/messenger-contacts")
    assert r.status_code == 401


def test_create_messenger_contact_telegram(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/messenger-contacts",
        json={
            "provider": "TELEGRAM",
            "externalId": "999001",
            "label": "Менеджер Telegram",
        },
    )
    assert r.status_code == 200
    contact = r.json()["contact"]
    assert contact["provider"] == "TELEGRAM"
    assert contact["externalId"] == "999001"
    assert contact["label"] == "Менеджер Telegram"


def test_create_multiple_messenger_contacts(owner_session, base_url):
    owner_session.post(
        f"{base_url}/api/messenger-contacts",
        json={"provider": "TELEGRAM", "externalId": "999002", "label": "Сотрудник 1"},
    )
    owner_session.post(
        f"{base_url}/api/messenger-contacts",
        json={"provider": "MAX", "externalId": "888001", "label": "Сотрудник MAX"},
    )

    r = owner_session.get(f"{base_url}/api/messenger-contacts")
    assert r.status_code == 200
    contacts = r.json()["contacts"]
    providers = {c["provider"] for c in contacts}
    assert "TELEGRAM" in providers
    assert "MAX" in providers


def test_create_messenger_contact_invalid_provider(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/messenger-contacts",
        json={"provider": "VK", "externalId": "1"},
    )
    assert r.status_code == 400


def test_delete_messenger_contact(owner_session, base_url):
    create_r = owner_session.post(
        f"{base_url}/api/messenger-contacts",
        json={"provider": "TELEGRAM", "externalId": "999003", "label": "Удаляемый"},
    )
    contact_id = create_r.json()["contact"]["id"]

    del_r = owner_session.delete(f"{base_url}/api/messenger-contacts?id={contact_id}")
    assert del_r.status_code == 200

    list_r = owner_session.get(f"{base_url}/api/messenger-contacts")
    ids = [c["id"] for c in list_r.json()["contacts"]]
    assert contact_id not in ids


def test_business_card_rejects_foreign_messenger_contact(owner_session, base_url):
    create_card = owner_session.post(
        f"{base_url}/api/business-cards",
        json={"fullName": "Контакт Тестов"},
    )
    card_id = create_card.json()["businessCard"]["id"]

    invalid = owner_session.put(
        f"{base_url}/api/business-cards",
        json={
            "id": card_id,
            "contactEnabled": True,
            "contactMessengerId": "nonexistent-contact-id",
        },
    )
    assert invalid.status_code == 400
