"""QR-визитка мастера: онбординг intent=card, новые поля визитки, форма заявки, OG и реф-код через OAuth."""

import html
import re
import uuid

import requests as req_lib

from conftest import login, unique_code


def unique_email(prefix="card"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@test.example.com"


def new_user_session(base_url, prefix="card"):
    email = unique_email(prefix)
    password = "secure123"
    reg = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    assert reg.status_code == 200, reg.text
    session = req_lib.Session()
    login(session, base_url, email, password)
    return session, email


def quick_start_card(session, base_url, **overrides):
    payload = {
        "intent": "card",
        "name": "Сергей Петров",
        "profession": "Электрик",
        "phone": "8 (999) 123-45-67",
        "whatsapp": "8 (999) 123-45-67",
        "telegram": "@master_sergey",
        "serviceArea": "Казань, выезд по городу",
        "industry": "SERVICES",
    }
    payload.update(overrides)
    return session.post(f"{base_url}/api/setup/quick-start", json=payload)


def guest_headers():
    """Свой IP на тест: у формы заявки лимит 5 сообщений за 10 минут с одного IP."""
    return {"X-Forwarded-For": f"10.77.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"}


def og_content(page_html, prop):
    match = re.search(rf'<meta property="{prop}" content="([^"]*)"', page_html)
    return html.unescape(match.group(1)) if match else None


# --- Онбординг intent=card ---


def test_quick_start_card_creates_card_and_qr(base_url):
    session, _ = new_user_session(base_url)
    r = quick_start_card(session, base_url)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["intent"] == "card"
    assert data["qrcode"]["mode"] == "BUSINESS_CARD"
    assert data["qrcode"]["label"] == "Визитка"

    ests = session.get(f"{base_url}/api/establishments").json()["establishments"]
    assert len(ests) == 1
    assert ests[0]["name"] == "Сергей Петров"
    assert ests[0]["industry"] == "SERVICES"
    assert ests[0]["hasBusinessCard"] is True

    cards = session.get(f"{base_url}/api/business-cards").json()["businessCards"]
    assert len(cards) == 1
    card = cards[0]
    assert card["fullName"] == "Сергей Петров"
    assert card["title"] == "Электрик"
    assert card["whatsapp"] == "8 (999) 123-45-67"
    assert card["telegram"] == "@master_sergey"
    assert card["serviceArea"] == "Казань, выезд по городу"
    # Форма заявки работает сразу: email регистрации как канал по умолчанию
    assert card["contactEnabled"] is True
    assert card["contactMessenger"]["provider"] == "EMAIL"

    page = req_lib.get(f"{base_url}/q/{data['qrcode']['code']}")
    assert page.status_code == 200
    assert "Сергей Петров" in page.text
    assert "Позвонить" in page.text
    assert "tel:+79991234567" in page.text
    assert "https://wa.me/79991234567" in page.text
    assert "https://t.me/master_sergey" in page.text
    assert "Оставить заявку" in page.text


def test_quick_start_card_requires_phone(base_url):
    session, _ = new_user_session(base_url)
    r = quick_start_card(session, base_url, phone="", whatsapp="")
    assert r.status_code == 400
    assert "телефон" in r.json()["error"].lower()

    r = quick_start_card(session, base_url, phone="123")
    assert r.status_code == 400

    assert session.get(f"{base_url}/api/establishments").json()["establishments"] == []


def test_quick_start_card_requires_name(base_url):
    session, _ = new_user_session(base_url)
    r = quick_start_card(session, base_url, name="  ")
    assert r.status_code == 400
    assert r.json()["error"] == "Укажите имя"


def test_quick_start_card_unauthorized(base_url):
    r = req_lib.post(
        f"{base_url}/api/setup/quick-start",
        json={"intent": "card", "name": "Аноним", "phone": "+79990000000"},
    )
    assert r.status_code == 401


def test_quick_start_card_reuses_existing_project_card(base_url):
    session, _ = new_user_session(base_url)
    first = quick_start_card(session, base_url)
    assert first.status_code == 200, first.text
    est_id = first.json()["establishment"]["id"]

    second = quick_start_card(session, base_url, establishmentId=est_id, name="Другое имя")
    assert second.status_code == 200, second.text
    assert second.json()["qrcode"]["mode"] == "BUSINESS_CARD"

    cards = session.get(f"{base_url}/api/business-cards").json()["businessCards"]
    assert len(cards) == 1
    assert cards[0]["fullName"] == "Сергей Петров"

    page = req_lib.get(f"{base_url}/q/{second.json()['qrcode']['code']}")
    assert "Сергей Петров" in page.text


# --- Поля визитки мастера ---


def test_business_card_master_fields_are_normalized_and_rendered(base_url):
    session, _ = new_user_session(base_url)
    created = quick_start_card(session, base_url).json()
    card_id = session.get(f"{base_url}/api/business-cards").json()["businessCards"][0]["id"]

    services = [{"name": " Замена розетки ", "price": "от 400 ₽"}, {"name": "", "price": "100"}]
    services += [{"name": f"Услуга {i}", "price": ""} for i in range(40)]
    r = session.put(
        f"{base_url}/api/business-cards",
        json={
            "id": card_id,
            "services": services,
            "workHours": "Ежедневно 8:00–21:00",
            "reviewsUrl": "https://www.avito.ru/user/master/profile",
            "maxUrl": "https://max.ru/u/master",
            "about": "",
        },
    )
    assert r.status_code == 200, r.text
    card = r.json()["businessCard"]
    assert card["services"][0] == {"name": "Замена розетки", "price": "от 400 ₽"}
    assert len(card["services"]) == 30
    assert card["workHours"] == "Ежедневно 8:00–21:00"
    assert card["about"] is None
    # Поля, которых нет в запросе, не трогаем
    assert card["title"] == "Электрик"

    page = req_lib.get(f"{base_url}/q/{created['qrcode']['code']}").text
    assert "Услуги и цены" in page
    assert "Замена розетки" in page
    assert "от 400 ₽" in page
    assert "Отзывы обо мне" in page
    assert "https://max.ru/u/master" in page
    assert "Ежедневно 8:00–21:00" in page


def test_business_card_rejects_empty_name_on_update(base_url):
    session, _ = new_user_session(base_url)
    quick_start_card(session, base_url)
    card_id = session.get(f"{base_url}/api/business-cards").json()["businessCards"][0]["id"]
    r = session.put(f"{base_url}/api/business-cards", json={"id": card_id, "fullName": " "})
    assert r.status_code == 400


def test_business_card_unsafe_links_are_not_rendered(base_url):
    session, _ = new_user_session(base_url)
    created = quick_start_card(session, base_url).json()
    card_id = session.get(f"{base_url}/api/business-cards").json()["businessCards"][0]["id"]
    r = session.put(
        f"{base_url}/api/business-cards",
        json={
            "id": card_id,
            "reviewsUrl": "javascript:alert(1)",
            "socialLinks": [{"type": "vk", "url": "javascript:alert(2)"}],
        },
    )
    assert r.status_code == 200
    page = req_lib.get(f"{base_url}/q/{created['qrcode']['code']}").text
    assert "javascript:alert" not in page
    assert "Отзывы обо мне" not in page


# --- Превью ссылки в мессенджерах ---


def test_business_card_og_meta_uses_person(base_url):
    session, _ = new_user_session(base_url)
    created = quick_start_card(session, base_url).json()
    page = req_lib.get(f"{base_url}/q/{created['qrcode']['code']}").text
    assert og_content(page, "og:title") == "Сергей Петров — Электрик"
    assert "Казань" in (og_content(page, "og:description") or "")


# --- Форма «Оставить заявку» ---


def test_business_card_contact_sends_with_guest_phone(base_url):
    session, _ = new_user_session(base_url)
    created = quick_start_card(session, base_url).json()
    r = req_lib.post(
        f"{base_url}/api/business-cards/contact",
        headers=guest_headers(),
        json={
            "qrCode": created["qrcode"]["code"],
            "guestName": "Анна",
            "guestPhone": "+7 900 000-00-00",
            "message": "Выбило автомат, нужен мастер сегодня",
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["success"] is True


def test_business_card_contact_uses_project_card_for_qr_without_own_card(base_url):
    """QR переключили в «Визитку» из карточки QR: своей FK нет, визитка берётся с проекта."""
    session, _ = new_user_session(base_url)
    created = quick_start_card(session, base_url).json()
    est_id = created["establishment"]["id"]

    code = unique_code("bcest")
    qr = session.post(
        f"{base_url}/api/qrcodes",
        json={"code": code, "mode": "BUSINESS_CARD", "establishmentId": est_id},
    )
    assert qr.status_code == 200, qr.text
    assert qr.json()["qrcode"].get("businessCardId") is None

    page = req_lib.get(f"{base_url}/q/{code}")
    assert "Сергей Петров" in page.text

    r = req_lib.post(
        f"{base_url}/api/business-cards/contact",
        headers=guest_headers(),
        json={"qrCode": code, "guestName": "Гость", "message": "Нужна консультация"},
    )
    assert r.status_code == 200, r.text


# --- Редактор визитки в кабинете ---


def test_project_card_page_access(base_url):
    session, _ = new_user_session(base_url)
    created = quick_start_card(session, base_url).json()
    est_id = created["establishment"]["id"]

    page = session.get(f"{base_url}/dashboard/projects/{est_id}/card")
    assert page.status_code == 200
    assert "QR-визитка" in page.text

    stranger, _ = new_user_session(base_url, "stranger")
    quick_start_card(stranger, base_url)
    other = stranger.get(f"{base_url}/dashboard/projects/{est_id}/card")
    assert other.status_code == 404


# --- Демо и регистрация ---


def test_demo_master_card(base_url):
    r = req_lib.get(f"{base_url}/q/demo-master")
    assert r.status_code == 200
    assert "Сергей Петров" in r.text
    assert "Услуги и цены" in r.text
    assert og_content(r.text, "og:title") == "Сергей Петров — Электрик"


def test_register_page_card_subtitle(base_url):
    r = req_lib.get(f"{base_url}/register?intent=card")
    assert r.status_code == 200
    assert "QR-визитку" in r.text


def test_vk_signup_keeps_referral_code_from_cookie(base_url):
    partner, _ = new_user_session(base_url, "partner")
    ref_code = partner.get(f"{base_url}/api/partner").json()["referralCode"]

    suffix = uuid.uuid4().hex[:10]
    email = f"vk-ref-{suffix}@test.example.com"
    session = req_lib.Session()
    session.cookies.set("qrstars_reg_ref", ref_code)
    response = session.post(
        f"{base_url}/auth/vk",
        headers={"Origin": "http://localhost:3000"},
        json={
            "code": f"valid|{suffix}|{email}|Иван|Иванов",
            "deviceId": "e2e-device",
            "codeVerifier": "a" * 64,
            "state": "e2e-state",
        },
    )
    assert response.status_code == 200, response.text

    referred = [u["email"] for u in partner.get(f"{base_url}/api/partner").json()["referredUsers"]]
    assert email in referred
