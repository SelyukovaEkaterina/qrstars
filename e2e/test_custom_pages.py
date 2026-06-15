import pytest
import requests as req_lib


def test_create_custom_page_html(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/custom-pages",
        json={
            "establishmentId": owner_establishment_id,
            "menuItemLabel": "О нас",
            "title": "О нашем заведении",
            "content": "<p>Добро пожаловать!</p>",
            "type": "HTML",
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert "customPage" in data
    page = data["customPage"]
    assert page["menuItemLabel"] == "О нас"
    assert page["title"] == "О нашем заведении"
    assert page["type"] == "HTML"
    assert page["enabled"] is False


def test_create_custom_page_link(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/custom-pages",
        json={
            "establishmentId": owner_establishment_id,
            "menuItemLabel": "Наш сайт",
            "title": "Перейти на сайт",
            "type": "LINK",
            "url": "https://example.com",
            "icon": "🌐",
        },
    )
    assert r.status_code == 201
    page = r.json()["customPage"]
    assert page["type"] == "LINK"
    assert page["url"] == "https://example.com"
    assert page["icon"] == "🌐"


def test_create_custom_page_link_without_url(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/custom-pages",
        json={
            "establishmentId": owner_establishment_id,
            "menuItemLabel": "Ссылка",
            "title": "Ссылка без URL",
            "type": "LINK",
        },
    )
    assert r.status_code == 400


def test_create_custom_page_missing_required(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/custom-pages",
        json={
            "establishmentId": owner_establishment_id,
            "title": "Без метки",
        },
    )
    assert r.status_code == 400


def test_create_custom_page_missing_establishment(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/custom-pages",
        json={
            "menuItemLabel": "Тест",
            "title": "Без заведения",
        },
    )
    assert r.status_code == 400


def test_create_custom_page_wrong_establishment(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/custom-pages",
        json={
            "establishmentId": "nonexistent-id",
            "menuItemLabel": "Тест",
            "title": "Чужое заведение",
        },
    )
    assert r.status_code == 404


def test_create_custom_page_unauthorized(base_url, owner_establishment_id):
    r = req_lib.post(
        f"{base_url}/api/custom-pages",
        json={
            "establishmentId": owner_establishment_id,
            "menuItemLabel": "Тест",
            "title": "Неавторизован",
        },
    )
    assert r.status_code == 401


def test_list_custom_pages(owner_session, base_url, owner_establishment_id):
    owner_session.post(
        f"{base_url}/api/custom-pages",
        json={
            "establishmentId": owner_establishment_id,
            "menuItemLabel": "Список-тест",
            "title": "Страница для списка",
        },
    )

    r = owner_session.get(
        f"{base_url}/api/custom-pages",
        params={"establishmentId": owner_establishment_id},
    )
    assert r.status_code == 200
    data = r.json()
    assert "customPages" in data
    assert isinstance(data["customPages"], list)
    assert len(data["customPages"]) >= 1


def test_list_custom_pages_missing_establishment(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/custom-pages")
    assert r.status_code == 400


def test_list_custom_pages_unauthorized(base_url, owner_establishment_id):
    r = req_lib.get(
        f"{base_url}/api/custom-pages",
        params={"establishmentId": owner_establishment_id},
    )
    assert r.status_code == 401


def test_update_custom_page(owner_session, base_url, owner_establishment_id):
    create_r = owner_session.post(
        f"{base_url}/api/custom-pages",
        json={
            "establishmentId": owner_establishment_id,
            "menuItemLabel": "До правки",
            "title": "Старый заголовок",
            "content": "<p>Старый текст</p>",
        },
    )
    page_id = create_r.json()["customPage"]["id"]

    r = owner_session.put(
        f"{base_url}/api/custom-pages",
        json={
            "id": page_id,
            "menuItemLabel": "После правки",
            "title": "Новый заголовок",
            "content": "<p>Новый текст</p>",
            "enabled": False,
        },
    )
    assert r.status_code == 200
    updated = r.json()["customPage"]
    assert updated["menuItemLabel"] == "После правки"
    assert updated["title"] == "Новый заголовок"
    assert updated["enabled"] is False


def test_update_custom_page_missing_id(owner_session, base_url):
    r = owner_session.put(
        f"{base_url}/api/custom-pages",
        json={"title": "Без id"},
    )
    assert r.status_code == 400


def test_update_custom_page_not_found(owner_session, base_url):
    r = owner_session.put(
        f"{base_url}/api/custom-pages",
        json={"id": "nonexistent", "title": "Не найдено"},
    )
    assert r.status_code == 404


def test_delete_custom_page(owner_session, base_url, owner_establishment_id):
    create_r = owner_session.post(
        f"{base_url}/api/custom-pages",
        json={
            "establishmentId": owner_establishment_id,
            "menuItemLabel": "Удалить меня",
            "title": "Страница для удаления",
        },
    )
    page_id = create_r.json()["customPage"]["id"]

    r = owner_session.delete(
        f"{base_url}/api/custom-pages",
        params={"id": page_id},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True

    list_r = owner_session.get(
        f"{base_url}/api/custom-pages",
        params={"establishmentId": owner_establishment_id},
    )
    ids = [p["id"] for p in list_r.json()["customPages"]]
    assert page_id not in ids


def test_delete_custom_page_missing_id(owner_session, base_url):
    r = owner_session.delete(f"{base_url}/api/custom-pages")
    assert r.status_code == 400


def test_delete_custom_page_not_found(owner_session, base_url):
    r = owner_session.delete(
        f"{base_url}/api/custom-pages",
        params={"id": "nonexistent"},
    )
    assert r.status_code == 404
