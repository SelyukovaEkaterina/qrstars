import pytest
import requests as req_lib


def test_create_menu_with_items(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/menus",
        json={
            "establishmentId": owner_establishment_id,
            "title": "Основное меню",
            "description": "Наши блюда",
            "items": [
                {"name": "Борщ", "price": "350", "category": "Супы"},
                {"name": "Стейк", "price": "850", "weight": "300г", "category": "Горячее"},
            ],
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert "menu" in data
    menu = data["menu"]
    assert menu["title"] == "Основное меню"
    assert len(menu["items"]) == 2
    assert menu["items"][0]["name"] == "Борщ"
    assert menu["items"][1]["price"] == "850"
    return menu["id"]


def test_create_menu_minimal(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/menus",
        json={
            "establishmentId": owner_establishment_id,
            "title": "Пустое меню",
        },
    )
    assert r.status_code == 200
    menu = r.json()["menu"]
    assert menu["items"] == []


def test_create_menu_unauthorized(base_url, owner_establishment_id):
    r = req_lib.post(
        f"{base_url}/api/menus",
        json={
            "establishmentId": owner_establishment_id,
            "title": "Неавторизован",
        },
    )
    assert r.status_code == 401


def test_create_menu_wrong_establishment(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/menus",
        json={
            "establishmentId": "nonexistent-id",
            "title": "Чужое заведение",
        },
    )
    assert r.status_code == 404


def test_update_menu(owner_session, base_url, owner_establishment_id):
    create_r = owner_session.post(
        f"{base_url}/api/menus",
        json={
            "establishmentId": owner_establishment_id,
            "title": "Меню до обновления",
            "items": [{"name": "Блюдо 1", "price": "100"}],
        },
    )
    menu_id = create_r.json()["menu"]["id"]

    r = owner_session.put(
        f"{base_url}/api/menus",
        json={
            "id": menu_id,
            "title": "Обновлённое меню",
            "description": "Новое описание",
            "items": [
                {"name": "Новое блюдо", "price": "500", "category": "Новая категория"},
            ],
        },
    )
    assert r.status_code == 200
    updated = r.json()["menu"]
    assert updated["title"] == "Обновлённое меню"
    assert len(updated["items"]) == 1
    assert updated["items"][0]["name"] == "Новое блюдо"


def test_update_menu_missing_id(owner_session, base_url):
    r = owner_session.put(
        f"{base_url}/api/menus",
        json={"title": "Без id"},
    )
    assert r.status_code == 400


def test_update_menu_not_found(owner_session, base_url):
    r = owner_session.put(
        f"{base_url}/api/menus",
        json={"id": "nonexistent", "title": "Не найдено"},
    )
    assert r.status_code == 404


def test_delete_menu(owner_session, base_url, owner_establishment_id):
    create_r = owner_session.post(
        f"{base_url}/api/menus",
        json={
            "establishmentId": owner_establishment_id,
            "title": "Меню для удаления",
            "items": [{"name": "Удалить меня", "price": "0"}],
        },
    )
    menu_id = create_r.json()["menu"]["id"]

    r = owner_session.delete(
        f"{base_url}/api/menus",
        params={"id": menu_id},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_delete_menu_missing_id(owner_session, base_url):
    r = owner_session.delete(f"{base_url}/api/menus")
    assert r.status_code == 400


def test_delete_menu_not_found(owner_session, base_url):
    r = owner_session.delete(
        f"{base_url}/api/menus",
        params={"id": "nonexistent"},
    )
    assert r.status_code == 404


def test_delete_menu_unauthorized(base_url, owner_establishment_id):
    r = req_lib.delete(
        f"{base_url}/api/menus",
        params={"id": "some-id"},
    )
    assert r.status_code == 401


def test_menu_items_order_preserved(owner_session, base_url, owner_establishment_id):
    items = [
        {"name": f"Блюдо {i}", "price": str(i * 100)}
        for i in range(1, 6)
    ]
    create_r = owner_session.post(
        f"{base_url}/api/menus",
        json={
            "establishmentId": owner_establishment_id,
            "title": "Меню с порядком",
            "items": items,
        },
    )
    menu = create_r.json()["menu"]
    names = [item["name"] for item in menu["items"]]
    assert names == [f"Блюдо {i}" for i in range(1, 6)]


def test_menu_hidden_item(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/menus",
        json={
            "establishmentId": owner_establishment_id,
            "title": "Меню со скрытым блюдом",
            "items": [
                {"name": "Видимое", "price": "100", "hidden": False},
                {"name": "Скрытое", "price": "200", "hidden": True},
            ],
        },
    )
    items = r.json()["menu"]["items"]
    visible = next(i for i in items if i["name"] == "Видимое")
    hidden = next(i for i in items if i["name"] == "Скрытое")
    assert visible["hidden"] is False
    assert hidden["hidden"] is True
