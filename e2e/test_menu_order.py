"""
E2E-тесты: режим корзины в QR-меню (POST /api/menus/order).

Позитивные сценарии:
- Заказ с полными данными (имя, стол, комментарий)
- Заказ с минимальными данными (только имя)
- Заказ с опциональными полями (телефон, email, адрес)
- Заказ с несколькими позициями разного количества

Негативные сценарии:
- Нет establishmentId
- Несуществующий establishment
- Пустая корзина (items отсутствуют / пустой массив)
- Нет имени гостя
- Некорректные qty (отрицательные, нули, не числа)
- Rate limit (6-й запрос с одного IP должен вернуть 429)
"""

import pytest
import requests as req_lib
import uuid
import os


def unique_name():
    return f"e2e-{uuid.uuid4().hex[:6]}"


def unique_ip():
    """Generate a unique fake IP to isolate rate limits between tests."""
    h = uuid.uuid4().hex
    a = int(h[0:2], 16) % 254 + 1
    b = int(h[2:4], 16) % 254 + 1
    c = int(h[4:6], 16) % 254 + 1
    return f"10.{a}.{b}.{c}"


# ── Фикстура: меню с cartEnabled=True ──────────────────────────────────────

@pytest.fixture(scope="module")
def cart_menu(owner_session, base_url, owner_establishment_id):
    """Создаёт меню с cartEnabled=True, привязывает к заведению как основное."""
    r = owner_session.post(
        f"{base_url}/api/menus",
        json={
            "establishmentId": owner_establishment_id,
            "title": "Меню для тестов заказов",
            "cartEnabled": True,
            "askPhone": True,
            "askEmail": True,
            "askAddress": True,
            "items": [
                {"name": "Капучино", "price": "290 ₽", "category": "Кофе"},
                {"name": "Круассан", "price": "180 ₽", "category": "Выпечка"},
                {"name": "Вода", "price": "80 ₽"},
            ],
        },
    )
    assert r.status_code == 200, f"Failed to create cart menu: {r.text}"
    menu = r.json()["menu"]
    assert menu["cartEnabled"] is True
    yield menu
    # Чистим
    owner_session.delete(f"{base_url}/api/menus", params={"id": menu["id"]})


@pytest.fixture(scope="module")
def menu_no_cart(owner_session, base_url, owner_establishment_id):
    """Создаёт меню с cartEnabled=False (по умолчанию), без привязки как основного."""
    r = owner_session.post(
        f"{base_url}/api/menus",
        json={
            "establishmentId": owner_establishment_id,
            "linkAsPrimary": False,
            "title": "Меню без корзины",
            "items": [{"name": "Борщ", "price": "350 ₽"}],
        },
    )
    assert r.status_code == 200, f"Failed to create menu_no_cart: {r.text}"
    menu = r.json()["menu"]
    yield menu
    owner_session.delete(f"{base_url}/api/menus", params={"id": menu["id"]})


# ── Тесты сохранения флагов cartEnabled / askPhone / askEmail / askAddress ──

def test_cart_enabled_flag_saved(cart_menu):
    assert cart_menu["cartEnabled"] is True


def test_ask_phone_flag_saved(cart_menu):
    assert cart_menu["askPhone"] is True


def test_ask_email_flag_saved(cart_menu):
    assert cart_menu["askEmail"] is True


def test_ask_address_flag_saved(cart_menu):
    assert cart_menu["askAddress"] is True


def test_cart_disabled_by_default(menu_no_cart):
    assert menu_no_cart.get("cartEnabled") is False


def test_update_menu_cart_enabled(owner_session, base_url, menu_no_cart):
    r = owner_session.put(
        f"{base_url}/api/menus",
        json={
            "id": menu_no_cart["id"],
            "cartEnabled": True,
            "askPhone": True,
        },
    )
    assert r.status_code == 200
    updated = r.json()["menu"]
    assert updated["cartEnabled"] is True
    assert updated["askPhone"] is True
    # Откатываем
    owner_session.put(
        f"{base_url}/api/menus",
        json={"id": menu_no_cart["id"], "cartEnabled": False, "askPhone": False},
    )


# ── Позитивные сценарии POST /api/menus/order ───────────────────────────────
# Все позитивные тесты требуют cart_menu, чтобы заведение имело cartEnabled=True.

def test_order_full_fields(base_url, owner_establishment_id, cart_menu):
    """Полный заказ: имя, стол, телефон, email, адрес, комментарий."""
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "establishmentId": owner_establishment_id,
            "guestName": "Иван Петров",
            "tableNumber": "7",
            "guestPhone": "+7 900 000-00-00",
            "guestEmail": "ivan@example.com",
            "guestAddress": "ул. Ленина, 1, кв. 5",
            "comment": "Без сахара",
            "items": [
                {"name": "Капучино", "price": "290 ₽", "qty": 2},
                {"name": "Круассан", "price": "180 ₽", "qty": 1},
            ],
        },
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    assert r.json().get("success") is True


def test_order_minimal(base_url, owner_establishment_id, cart_menu):
    """Минимальный заказ: только имя и одна позиция."""
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "establishmentId": owner_establishment_id,
            "guestName": "Анна",
            "items": [{"name": "Вода", "price": "80 ₽", "qty": 1}],
        },
    )
    assert r.status_code == 200
    assert r.json().get("success") is True


def test_order_no_price(base_url, owner_establishment_id, cart_menu):
    """Позиция без цены — итог не считается, но заказ принимается."""
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "establishmentId": owner_establishment_id,
            "guestName": "Тест",
            "items": [{"name": "Позиция без цены", "price": None, "qty": 3}],
        },
    )
    assert r.status_code == 200
    assert r.json().get("success") is True


def test_order_multiple_items_different_qty(base_url, owner_establishment_id, cart_menu):
    """Несколько позиций с разным количеством."""
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "establishmentId": owner_establishment_id,
            "guestName": "Группа",
            "tableNumber": "12",
            "items": [
                {"name": "Капучино", "price": "290 ₽", "qty": 3},
                {"name": "Круассан", "price": "180 ₽", "qty": 5},
                {"name": "Вода", "price": "80 ₽", "qty": 10},
            ],
        },
    )
    assert r.status_code == 200
    assert r.json().get("success") is True


def test_order_with_qr_label(base_url, owner_establishment_id, cart_menu):
    """Передаётся qrLabel — должен попасть в уведомление (ответ всё равно 200)."""
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "establishmentId": owner_establishment_id,
            "qrLabel": "Стол 3 (терраса)",
            "guestName": "Мария",
            "items": [{"name": "Латте", "price": "320 ₽", "qty": 1}],
        },
    )
    assert r.status_code == 200
    assert r.json().get("success") is True


def test_order_optional_fields_only_phone(base_url, owner_establishment_id, cart_menu):
    """Только телефон из опциональных полей."""
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "establishmentId": owner_establishment_id,
            "guestName": "Сергей",
            "guestPhone": "+7 912 345-67-89",
            "items": [{"name": "Эспрессо", "price": "190 ₽", "qty": 1}],
        },
    )
    assert r.status_code == 200
    assert r.json().get("success") is True


# ── Негативные сценарии ──────────────────────────────────────────────────────
# Каждый тест использует уникальный IP, чтобы не задействовать общий rate-limit.

def test_order_missing_establishment_id(base_url):
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "guestName": "Тест",
            "items": [{"name": "Кофе", "price": "200 ₽", "qty": 1}],
        },
    )
    assert r.status_code == 400
    assert "error" in r.json()


def test_order_nonexistent_establishment(base_url):
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "establishmentId": "nonexistent-id-xyz",
            "guestName": "Тест",
            "items": [{"name": "Кофе", "price": "200 ₽", "qty": 1}],
        },
    )
    assert r.status_code == 404
    assert "error" in r.json()


def test_order_empty_items_array(base_url, owner_establishment_id, cart_menu):
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "establishmentId": owner_establishment_id,
            "guestName": "Тест",
            "items": [],
        },
    )
    assert r.status_code == 400
    assert "error" in r.json()


def test_order_missing_items(base_url, owner_establishment_id, cart_menu):
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "establishmentId": owner_establishment_id,
            "guestName": "Тест",
        },
    )
    assert r.status_code == 400
    assert "error" in r.json()


def test_order_missing_guest_name(base_url, owner_establishment_id, cart_menu):
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "establishmentId": owner_establishment_id,
            "items": [{"name": "Кофе", "price": "200 ₽", "qty": 1}],
        },
    )
    assert r.status_code == 400
    err = r.json().get("error", "")
    assert "имя" in err.lower() or "name" in err.lower()


def test_order_empty_guest_name(base_url, owner_establishment_id, cart_menu):
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "establishmentId": owner_establishment_id,
            "guestName": "   ",
            "items": [{"name": "Кофе", "price": "200 ₽", "qty": 1}],
        },
    )
    assert r.status_code == 400


def test_order_item_zero_qty(base_url, owner_establishment_id, cart_menu):
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "establishmentId": owner_establishment_id,
            "guestName": "Тест",
            "items": [{"name": "Кофе", "price": "200 ₽", "qty": 0}],
        },
    )
    assert r.status_code == 400


def test_order_item_negative_qty(base_url, owner_establishment_id, cart_menu):
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "establishmentId": owner_establishment_id,
            "guestName": "Тест",
            "items": [{"name": "Кофе", "price": "200 ₽", "qty": -1}],
        },
    )
    assert r.status_code == 400


def test_order_item_missing_name(base_url, owner_establishment_id, cart_menu):
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "establishmentId": owner_establishment_id,
            "guestName": "Тест",
            "items": [{"price": "200 ₽", "qty": 1}],
        },
    )
    assert r.status_code == 400


def test_order_empty_establishment_id(base_url):
    r = req_lib.post(
        f"{base_url}/api/menus/order",
        headers={"X-Forwarded-For": unique_ip()},
        json={
            "establishmentId": "",
            "guestName": "Тест",
            "items": [{"name": "Кофе", "qty": 1}],
        },
    )
    assert r.status_code == 400


# ── Rate limit ───────────────────────────────────────────────────────────────

@pytest.mark.skipif(
    os.environ.get("RATE_LIMIT_DISABLED") == "true",
    reason="Rate limiting disabled in test environment",
)
def test_order_rate_limit(base_url, owner_establishment_id, cart_menu):
    """6-й запрос подряд с одного IP должен быть отклонён (429)."""
    # Используем фиксированный уникальный IP только для этого теста
    fixed_ip = f"10.99.{uuid.uuid4().int % 254 + 1}.{uuid.uuid4().int % 254 + 1}"
    payload = {
        "establishmentId": owner_establishment_id,
        "guestName": f"RateTest-{uuid.uuid4().hex[:4]}",
        "items": [{"name": "Кофе", "qty": 1}],
    }
    session = req_lib.Session()
    responses = []
    for _ in range(6):
        responses.append(
            session.post(
                f"{base_url}/api/menus/order",
                headers={"X-Forwarded-For": fixed_ip},
                json=payload,
            )
        )

    status_codes = [r.status_code for r in responses]
    assert 429 in status_codes, f"Expected at least one 429 in {status_codes}"
    rate_limited = [r for r in responses if r.status_code == 429]
    assert rate_limited[0].json().get("error")
