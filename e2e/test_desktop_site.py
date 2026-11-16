"""E2E: сайт для компьютера — шаблон в API микросайта, превью в кабинете, демо."""

import pytest
import requests

from conftest import reset_user_to_free, set_user_plan, unique_code


@pytest.fixture(autouse=True)
def clean_free_owner(admin_session, base_url):
    """Чистый FREE без истории оплаты: иначе микросайт заморожен и PUT шаблона — 403."""
    reset_user_to_free(admin_session, base_url)
    yield


def _page_url(base_url, est_id):
    return f"{base_url}/api/establishments/{est_id}/page"


def test_page_api_returns_resolved_template(owner_session, base_url, owner_establishment_id):
    r = owner_session.get(_page_url(base_url, owner_establishment_id))
    assert r.status_code == 200, r.text
    est = r.json()["establishment"]
    assert "siteTemplate" in est
    assert est["siteTemplateResolved"] in {"showcase", "classic", "editorial", "bold"}


def test_save_and_reset_site_template(owner_session, base_url, owner_establishment_id):
    try:
        r = owner_session.put(_page_url(base_url, owner_establishment_id), json={"siteTemplate": "editorial"})
        assert r.status_code == 200, r.text
        est = r.json()["establishment"]
        assert est["siteTemplate"] == "editorial"
        assert est["siteTemplateResolved"] == "editorial"

        again = owner_session.get(_page_url(base_url, owner_establishment_id)).json()["establishment"]
        assert again["siteTemplate"] == "editorial"
    finally:
        reset = owner_session.put(_page_url(base_url, owner_establishment_id), json={"siteTemplate": None})
        assert reset.status_code == 200, reset.text
        est = reset.json()["establishment"]
        assert est["siteTemplate"] is None
        # Без выбора — шаблон по отрасли, но всегда один из известных.
        assert est["siteTemplateResolved"] in {"showcase", "classic", "editorial", "bold"}


def test_unknown_site_template_rejected(owner_session, base_url, owner_establishment_id):
    for bad in ["neon", "<script>", 42, {"id": "bold"}]:
        r = owner_session.put(_page_url(base_url, owner_establishment_id), json={"siteTemplate": bad})
        assert r.status_code == 400, (bad, r.text)


def test_site_template_requires_auth(base_url, owner_establishment_id):
    r = requests.put(_page_url(base_url, owner_establishment_id), json={"siteTemplate": "bold"})
    assert r.status_code == 401


def test_site_template_frozen_after_downgrade(owner_session, admin_session, base_url, owner_establishment_id):
    """После окончания платного доступа шаблон, как и состав микросайта, заморожен."""
    set_user_plan(admin_session, base_url, "PRO")
    reset_user_to_free(admin_session, base_url, reset_paid_history=False)
    try:
        r = owner_session.put(_page_url(base_url, owner_establishment_id), json={"siteTemplate": "bold"})
        assert r.status_code == 403, r.text
        assert r.json().get("micrositeFrozen") is True
    finally:
        reset_user_to_free(admin_session, base_url)


def test_site_preview_page_for_owner(owner_session, base_url, owner_establishment_id):
    r = owner_session.get(f"{base_url}/site-preview/{owner_establishment_id}")
    assert r.status_code == 200, r.text[:500]
    assert "noindex" in r.text
    # FREE видит превью с подсказкой про PRO.
    assert "PRO" in r.text


def test_site_preview_requires_login(base_url, owner_establishment_id):
    r = requests.get(f"{base_url}/site-preview/{owner_establishment_id}", allow_redirects=False)
    assert r.status_code in (302, 303, 307, 308), r.status_code
    assert "/login" in r.headers.get("location", "")


def test_site_preview_foreign_project_not_found(admin_session, base_url, owner_establishment_id):
    # Админ — не участник проекта демо-владельца: чужой проект не открывается.
    r = admin_session.get(f"{base_url}/site-preview/{owner_establishment_id}", allow_redirects=False)
    assert r.status_code == 404, r.status_code


def test_site_preview_unknown_project(owner_session, base_url):
    r = owner_session.get(f"{base_url}/site-preview/{unique_code('nope')}", allow_redirects=False)
    assert r.status_code == 404


def test_demo_landing_renders_desktop_site(base_url):
    for code in ["demo-landing", "demo2-landing", "demo3-landing"]:
        for template in ["showcase", "classic", "editorial", "bold"]:
            r = requests.get(f"{base_url}/q/{code}", params={"t": template})
            assert r.status_code == 200, (code, template, r.status_code)
            # Сервер рендерит обе версии; сайт для компьютера — с блоком контактов.
            assert "site-contacts" in r.text, (code, template)


# --- Сайт-визитка для компьютера ---

from test_business_card_master import guest_headers, new_user_session, quick_start_card  # noqa: E402


def test_card_site_on_free_has_classic_and_promo(base_url):
    session, _ = new_user_session(base_url, "cardsite")
    created = quick_start_card(session, base_url).json()
    code = created["qrcode"]["code"]

    page = requests.get(f"{base_url}/q/{code}")
    assert page.status_code == 200
    # Сайт-визитка рендерится рядом с мобильной версией.
    assert "site-contacts" in page.text
    assert "Отправить заявку" in page.text
    # FREE: заметная плашка «сделать такую же визитку».
    assert "сделать такую же визитку" in page.text
    # Разметка для поисковиков.
    assert "application/ld+json" in page.text
    assert "Сергей Петров — Электрик" in page.text


def test_card_site_template_follows_pro_choice(base_url, admin_session):
    session, email = new_user_session(base_url, "cardpro")
    created = quick_start_card(session, base_url).json()
    est_id = created["establishment"]["id"]
    code = created["qrcode"]["code"]

    set_user_plan(admin_session, base_url, "PRO", email=email)
    try:
        r = session.put(_page_url(base_url, est_id), json={"siteTemplate": "bold"})
        assert r.status_code == 200, r.text
        page = requests.get(f"{base_url}/q/{code}")
        assert page.status_code == 200
        # PRO без White Label-флага — без плашки сайта-визитки.
        assert "сделать такую же визитку" not in page.text
    finally:
        reset_user_to_free(admin_session, base_url, email=email)


def test_card_site_preview_for_card_project(base_url):
    session, _ = new_user_session(base_url, "cardprev")
    created = quick_start_card(session, base_url).json()
    est_id = created["establishment"]["id"]

    r = session.get(f"{base_url}/site-preview/{est_id}")
    assert r.status_code == 200
    assert "Сергей Петров" in r.text
    assert "Классика" in r.text

    stranger, _ = new_user_session(base_url, "cardprev-stranger")
    assert stranger.get(f"{base_url}/site-preview/{est_id}", allow_redirects=False).status_code == 404


def test_card_editor_shows_site_block(base_url):
    session, _ = new_user_session(base_url, "cardedit")
    est_id = quick_start_card(session, base_url).json()["establishment"]["id"]
    page = session.get(f"{base_url}/dashboard/projects/{est_id}/card")
    assert page.status_code == 200
    assert "Сайт-визитка для компьютера" in page.text


def test_demo_card_contact_is_not_saved(base_url):
    r = requests.post(
        f"{base_url}/api/business-cards/contact",
        json={"qrCode": "demo-master", "guestName": "Тест", "message": "Нужна розетка"},
        headers=guest_headers(),
    )
    assert r.status_code == 200, r.text
    assert r.json().get("demo") is True


def test_demo_master_renders_card_site(base_url):
    for template in ["showcase", "classic", "editorial", "bold"]:
        r = requests.get(f"{base_url}/q/demo-master", params={"t": template})
        assert r.status_code == 200
        assert "site-contacts" in r.text
        assert "Отправить заявку" in r.text


# --- Демо для селлеров маркетплейсов (H-008) ---


def test_demo_seller_page(base_url):
    r = requests.get(f"{base_url}/q/demo-seller")
    assert r.status_code == 200
    for text in ["Проблема с товаром?", "Оставить отзыв на Wildberries", "Оставить отзыв на Ozon", "Другие наши товары", "Как пользоваться лампой"]:
        assert text in r.text, text
    # Без фильтра оценок: блока «Оцените визит» (сбор отзывов 1–5★) на странице селлера нет.
    assert "Оцените визит" not in r.text
    assert "site-contacts" in r.text


def test_demo_seller_in_catalog(base_url):
    for template in ["showcase", "classic", "editorial", "bold"]:
        r = requests.get(f"{base_url}/q/demo-seller", params={"t": template})
        assert r.status_code == 200, template
