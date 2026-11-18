"""E2E: своя Яндекс Метрика владельца (PRO / «Сеть») и заходы по короткому адресу."""

import re
import uuid

import requests

from conftest import reset_user_to_free, set_user_plan
from test_business_card_master import guest_headers, new_user_session, quick_start_card

BROWSER_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
)
SNIPPET = (
    "<script>(function(m,e,t,r,i,k,a){})(window, document,'script',"
    "'https://mc.yandex.ru/metrika/tag.js?id=55511122', 'ym');"
    "ym(55511122, 'init', {webvisor:true});</script>"
)


def _counter_on_page(html, counter_id, source):
    """OwnerMetrika — клиентский компонент: на сервере видны его пропсы в RSC-данных страницы."""
    q = r'\\*"'
    pattern = rf'{q}counterId{q}:{q}{counter_id}{q},{q}source{q}:{q}{source}{q}'
    return re.search(pattern, html) is not None


def _page_url(base_url, est_id):
    return f"{base_url}/api/establishments/{est_id}/page"


def _card_project(base_url, prefix):
    session, email = new_user_session(base_url, prefix)
    created = quick_start_card(session, base_url).json()
    return session, email, created["establishment"]["id"], created["qrcode"]["code"]


def _visit(base_url, slug, ua=BROWSER_UA, headers=None):
    h = {"User-Agent": ua, "Content-Type": "application/json", **(headers or guest_headers())}
    return requests.post(f"{base_url}/api/site-visit", json={"slug": slug}, headers=h)


def _site_visits(session, base_url, est_id):
    r = session.get(f"{base_url}/api/analytics", params={"establishmentId": est_id, "period": "7d"})
    assert r.status_code == 200, r.text
    return r.json()


def test_free_cannot_connect_counter(base_url):
    session, _, est_id, _ = _card_project(base_url, "metrika-free")
    r = session.put(_page_url(base_url, est_id), json={"metrikaCounterId": "12345678"})
    assert r.status_code == 403, r.text
    assert r.json().get("upgradeRequired") == "PRO"
    # Отключить можно всегда.
    r = session.put(_page_url(base_url, est_id), json={"metrikaCounterId": None})
    assert r.status_code == 200, r.text
    assert r.json()["establishment"]["metrikaCounterId"] is None


def test_counter_requires_auth(base_url, owner_establishment_id):
    r = requests.put(_page_url(base_url, owner_establishment_id), json={"metrikaCounterId": "12345678"})
    assert r.status_code == 401


def test_pro_counter_on_scan_and_short_address(base_url, admin_session):
    session, email, est_id, code = _card_project(base_url, "metrika-pro")
    set_user_plan(admin_session, base_url, "PRO", email=email)
    try:
        for bad in ["abc", "1234", "<script>alert(1)</script>", {"id": 1}]:
            r = session.put(_page_url(base_url, est_id), json={"metrikaCounterId": bad})
            assert r.status_code == 400, (bad, r.text)

        # Код счётчика целиком — номер достаём сами.
        r = session.put(_page_url(base_url, est_id), json={"metrikaCounterId": SNIPPET})
        assert r.status_code == 200, r.text
        assert r.json()["establishment"]["metrikaCounterId"] == "55511122"
        assert session.get(_page_url(base_url, est_id)).json()["establishment"]["metrikaCounterId"] == "55511122"

        scan = requests.get(f"{base_url}/q/{code}", headers=guest_headers())
        assert scan.status_code == 200
        assert _counter_on_page(scan.text, "55511122", "qr")
        assert not _counter_on_page(scan.text, "55511122", "direct")

        slug = f"mtr-{uuid.uuid4().hex[:8]}"
        r = session.put(_page_url(base_url, est_id), json={"shortSlug": slug})
        assert r.status_code == 200, r.text
        site = requests.get(f"{base_url}/a/{slug}")
        assert site.status_code == 200
        assert _counter_on_page(site.text, "55511122", "direct")

        # Тариф закончился — счётчик не загружается, но номер сохранён (включится после продления).
        reset_user_to_free(admin_session, base_url, email=email)
        scan = requests.get(f"{base_url}/q/{code}", headers=guest_headers())
        assert "55511122" not in scan.text
        assert session.get(_page_url(base_url, est_id)).json()["establishment"]["metrikaCounterId"] == "55511122"
    finally:
        reset_user_to_free(admin_session, base_url, email=email)


def test_short_address_visits_in_stats(base_url, admin_session):
    session, email, est_id, _ = _card_project(base_url, "metrika-visits")
    set_user_plan(admin_session, base_url, "PRO", email=email)
    try:
        # Без короткого адреса блока заходов нет.
        assert _site_visits(session, base_url, est_id).get("siteVisits") is None

        slug = f"vis-{uuid.uuid4().hex[:8]}"
        assert session.put(_page_url(base_url, est_id), json={"shortSlug": slug}).status_code == 200

        ip = guest_headers()
        assert _visit(base_url, slug, headers=ip).status_code == 204
        assert _visit(base_url, slug).status_code == 204
        # Роботы, чужие и битые адреса не считаются, но ответ всегда 204.
        assert _visit(base_url, slug, ua="Mozilla/5.0 (compatible; YandexBot/3.0)").status_code == 204
        assert _visit(base_url, "no-such-slug-" + uuid.uuid4().hex[:6]).status_code == 204
        assert _visit(base_url, "BAD SLUG!").status_code == 204
        bad_body = requests.post(
            f"{base_url}/api/site-visit",
            data="not json",
            headers={"User-Agent": BROWSER_UA, "Content-Type": "application/json", **guest_headers()},
        )
        assert bad_body.status_code == 204

        # Лимит с одного IP на адрес — 5 в час.
        for _ in range(6):
            _visit(base_url, slug, headers=ip)

        data = _site_visits(session, base_url, est_id)
        visits = data["siteVisits"]
        assert visits is not None
        assert visits["total"] == 6, visits  # 5 с одного IP + 1 с другого
        assert f"{slug}.qrstars.ru" in visits["addresses"][0]
        assert sum(d.get("direct", 0) for d in data["dailyScans"]) == 6
    finally:
        reset_user_to_free(admin_session, base_url, email=email)


def test_stats_not_visible_to_stranger(base_url):
    _, _, est_id, _ = _card_project(base_url, "metrika-owner")
    stranger, _ = new_user_session(base_url, "metrika-stranger")
    r = stranger.put(_page_url(base_url, est_id), json={"metrikaCounterId": None})
    assert r.status_code == 404
