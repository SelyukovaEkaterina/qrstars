"""Открытый API v1 (`/api/v1/*`): ключи из кабинета (`/api/account/api-keys`),
авторизация `Bearer qrs_…`, проекты, QR-коды, картинка QR, отзывы, статистика.
"""

import uuid

import pytest
import requests as req_lib

from conftest import login

API = "/api/v1"


def new_user_session(base_url, prefix="public-api"):
    email = f"{prefix}-{uuid.uuid4().hex[:8]}@test.example.com"
    password = "secure123"
    reg = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "consentPd": True},
    )
    assert reg.status_code == 200, reg.text
    session = req_lib.Session()
    login(session, base_url, email, password)
    return session


def create_key(session, base_url, name="E2E ключ"):
    r = session.post(f"{base_url}/api/account/api-keys", json={"name": name})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["secret"].startswith("qrs_")
    return data


def api(base_url, key):
    s = req_lib.Session()
    s.headers["Authorization"] = f"Bearer {key}"
    s.base = f"{base_url}{API}"
    return s


@pytest.fixture(scope="module")
def account(base_url):
    session = new_user_session(base_url)
    key = create_key(session, base_url)
    client = api(base_url, key["secret"])
    r = client.post(f"{client.base}/projects", json={"name": "Кофейня API", "industry": "HORECA"})
    assert r.status_code == 201, r.text
    return {"session": session, "key": key, "client": client, "project": r.json()["project"]}


def create_qr(client, project_id, **fields):
    r = client.post(f"{client.base}/qrcodes", json={"projectId": project_id, **fields})
    assert r.status_code == 201, r.text
    return r.json()["qrcode"]


# --- спецификация и авторизация -------------------------------------------


def test_openapi_is_public(base_url):
    r = req_lib.get(f"{base_url}{API}/openapi.json")
    assert r.status_code == 200
    spec = r.json()
    assert spec["openapi"].startswith("3.1")
    for path in ("/me", "/projects", "/qrcodes", "/qrcodes/{id}/image", "/reviews", "/stats"):
        assert path in spec["paths"]


def test_no_key_is_401(base_url):
    r = req_lib.get(f"{base_url}{API}/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


def test_wrong_key_is_401(base_url):
    r = req_lib.get(
        f"{base_url}{API}/me",
        headers={"Authorization": "Bearer qrs_" + "A" * 40},
    )
    assert r.status_code == 401


def test_cookie_session_is_not_enough(base_url, account):
    r = account["session"].get(f"{base_url}{API}/me")
    assert r.status_code == 401


def test_key_list_hides_secret(base_url, account):
    r = account["session"].get(f"{base_url}/api/account/api-keys")
    assert r.status_code == 200
    keys = r.json()["keys"]
    assert any(k["id"] == account["key"]["key"]["id"] for k in keys)
    assert account["key"]["secret"] not in r.text
    assert all(account["key"]["secret"].startswith(k["prefix"]) for k in keys if k["id"] == account["key"]["key"]["id"])


def test_key_management_requires_session(base_url, account):
    r = req_lib.get(
        f"{base_url}/api/account/api-keys",
        headers={"Authorization": f"Bearer {account['key']['secret']}"},
    )
    assert r.status_code == 401


def test_key_name_required(base_url, account):
    r = account["session"].post(f"{base_url}/api/account/api-keys", json={"name": "   "})
    assert r.status_code == 400


# --- аккаунт и проекты -----------------------------------------------------


def test_me(account):
    c = account["client"]
    r = c.get(f"{c.base}/me")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["plan"]["id"] == "FREE"
    assert data["limits"]["projects"] == 1
    assert data["limits"]["projectsUsed"] == 1


def test_projects_list_and_get(account):
    c = account["client"]
    r = c.get(f"{c.base}/projects")
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()["projects"]]
    assert account["project"]["id"] in ids

    r = c.get(f"{c.base}/projects/{account['project']['id']}")
    assert r.status_code == 200
    assert r.json()["project"]["role"] == "owner"


def test_free_project_limit(account):
    c = account["client"]
    r = c.post(f"{c.base}/projects", json={"name": "Второй проект"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "upgrade_required"


def test_create_project_requires_name(account):
    c = account["client"]
    r = c.post(f"{c.base}/projects", json={"address": "Москва"})
    assert r.status_code == 400


def test_patch_project_links(account):
    c = account["client"]
    pid = account["project"]["id"]
    r = c.patch(
        f"{c.base}/projects/{pid}",
        json={"yandexMapsUrl": "https://yandex.ru/maps/org/kofeynya/1234567890/", "address": "Тверская, 1"},
    )
    assert r.status_code == 200, r.text
    project = r.json()["project"]
    assert "/maps/org/" in project["yandexMapsUrl"]
    assert project["address"] == "Тверская, 1"


def test_patch_project_rejects_yandex_search(account):
    c = account["client"]
    r = c.patch(
        f"{c.base}/projects/{account['project']['id']}",
        json={"yandexMapsUrl": "https://yandex.ru/maps/search/кофейня/"},
    )
    assert r.status_code == 400


def test_patch_project_rejects_bad_industry(account):
    c = account["client"]
    r = c.patch(f"{c.base}/projects/{account['project']['id']}", json={"industry": "SPACE"})
    assert r.status_code == 400


# --- QR-коды ----------------------------------------------------------------


def test_create_redirect_qr_and_scan(base_url, account):
    c = account["client"]
    qr = create_qr(c, account["project"]["id"], label="Баннер", redirectUrl="https://example.com/sale")
    assert qr["mode"] == "REDIRECT"
    assert qr["scanUrl"].endswith(f"/q/{qr['code']}")
    assert qr["projectId"] == account["project"]["id"]

    r = c.get(f"{c.base}/qrcodes/{qr['id']}")
    assert r.status_code == 200
    assert r.json()["qrcode"]["redirectUrl"] == "https://example.com/sale"

    scan = req_lib.get(f"{base_url}/q/{qr['code']}", allow_redirects=False)
    assert scan.status_code in (200, 302, 307, 308)
    if scan.status_code == 200:
        assert "example.com/sale" in scan.text
    else:
        assert "example.com/sale" in scan.headers["location"]


def test_create_review_qr_by_default(account):
    qr = create_qr(account["client"], account["project"]["id"])
    assert qr["mode"] == "REVIEW"


def test_create_qr_validation(account):
    c = account["client"]
    pid = account["project"]["id"]
    assert c.post(f"{c.base}/qrcodes", json={"label": "без проекта"}).status_code == 400
    assert c.post(f"{c.base}/qrcodes", json={"projectId": pid, "mode": "REDIRECT"}).status_code == 400
    assert c.post(f"{c.base}/qrcodes", json={"projectId": pid, "mode": "FILE"}).status_code == 400
    assert (
        c.post(f"{c.base}/qrcodes", json={"projectId": pid, "redirectUrl": "javascript:alert(1)"}).status_code
        == 400
    )
    r = c.post(f"{c.base}/qrcodes", json={"projectId": "nope"})
    assert r.status_code == 404


def test_landing_requires_pro(account):
    c = account["client"]
    r = c.post(f"{c.base}/qrcodes", json={"projectId": account["project"]["id"], "mode": "LANDING"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "upgrade_required"


def test_patch_qr_changes_link(base_url, account):
    c = account["client"]
    qr = create_qr(c, account["project"]["id"], redirectUrl="https://example.com/old")
    r = c.patch(f"{c.base}/qrcodes/{qr['id']}", json={"redirectUrl": "https://example.com/new", "label": "Новый"})
    assert r.status_code == 200, r.text
    updated = r.json()["qrcode"]
    assert updated["redirectUrl"] == "https://example.com/new"
    assert updated["code"] == qr["code"]

    # Нельзя оставить REDIRECT без ссылки и выставить режим, недоступный через API.
    assert c.patch(f"{c.base}/qrcodes/{qr['id']}", json={"redirectUrl": None}).status_code == 400
    assert c.patch(f"{c.base}/qrcodes/{qr['id']}", json={"mode": "TIPS"}).status_code == 400

    r = c.patch(f"{c.base}/qrcodes/{qr['id']}", json={"mode": "REVIEW"})
    assert r.status_code == 200
    assert r.json()["qrcode"]["mode"] == "REVIEW"


def test_list_qr_pagination(account):
    c = account["client"]
    pid = account["project"]["id"]
    create_qr(c, pid, label="p1")
    create_qr(c, pid, label="p2")
    r = c.get(f"{c.base}/qrcodes", params={"projectId": pid, "limit": 1})
    assert r.status_code == 200
    first = r.json()
    assert len(first["qrcodes"]) == 1
    assert first["nextCursor"]
    r = c.get(f"{c.base}/qrcodes", params={"projectId": pid, "limit": 1, "cursor": first["nextCursor"]})
    assert r.status_code == 200
    assert r.json()["qrcodes"][0]["id"] != first["qrcodes"][0]["id"]
    assert c.get(f"{c.base}/qrcodes", params={"limit": 0}).status_code == 400


def test_qr_image(account):
    c = account["client"]
    qr = create_qr(c, account["project"]["id"], redirectUrl="https://example.com/img")
    png = c.get(f"{c.base}/qrcodes/{qr['id']}/image", params={"size": 256})
    assert png.status_code == 200
    assert png.headers["content-type"] == "image/png"
    assert png.content[:8] == b"\x89PNG\r\n\x1a\n"

    svg = c.get(f"{c.base}/qrcodes/{qr['id']}/image", params={"format": "svg"})
    assert svg.status_code == 200
    assert "<svg" in svg.text

    assert c.get(f"{c.base}/qrcodes/{qr['id']}/image", params={"size": 5000}).status_code == 400
    assert c.get(f"{c.base}/qrcodes/{qr['id']}/image", params={"format": "gif"}).status_code == 400


def test_delete_qr(base_url, account):
    c = account["client"]
    qr = create_qr(c, account["project"]["id"], redirectUrl="https://example.com/del")
    r = c.delete(f"{c.base}/qrcodes/{qr['id']}")
    assert r.status_code == 200
    assert r.json()["deleted"] is True
    assert c.get(f"{c.base}/qrcodes/{qr['id']}").status_code == 404


def test_other_account_cannot_touch(base_url, account):
    qr = create_qr(account["client"], account["project"]["id"], redirectUrl="https://example.com/mine")

    stranger_session = new_user_session(base_url, prefix="public-api-stranger")
    stranger = api(base_url, create_key(stranger_session, base_url)["secret"])

    assert stranger.get(f"{stranger.base}/qrcodes/{qr['id']}").status_code == 404
    assert stranger.patch(f"{stranger.base}/qrcodes/{qr['id']}", json={"label": "x"}).status_code == 404
    assert stranger.delete(f"{stranger.base}/qrcodes/{qr['id']}").status_code == 404
    assert stranger.get(f"{stranger.base}/qrcodes/{qr['id']}/image").status_code == 404
    assert stranger.get(f"{stranger.base}/projects/{account['project']['id']}").status_code == 404
    r = stranger.post(f"{stranger.base}/qrcodes", json={"projectId": account["project"]["id"]})
    assert r.status_code == 404
    ids = [q["id"] for q in stranger.get(f"{stranger.base}/qrcodes").json()["qrcodes"]]
    assert qr["id"] not in ids


# --- отзывы и статистика ----------------------------------------------------


def test_reviews_and_stats(base_url, account):
    c = account["client"]
    pid = account["project"]["id"]
    qr = create_qr(c, pid)
    for rating, negative in ((5, False), (2, True)):
        r = req_lib.post(
            f"{base_url}/api/reviews",
            json={
                "establishmentId": pid,
                "qrCodeId": qr["id"],
                "rating": rating,
                "comment": f"API e2e {rating}",
                "isNegative": negative,
            },
        )
        assert r.status_code == 200, r.text

    r = c.get(f"{c.base}/reviews", params={"projectId": pid})
    assert r.status_code == 200
    reviews = r.json()["reviews"]
    assert {rv["rating"] for rv in reviews} >= {5, 2}

    r = c.get(f"{c.base}/reviews", params={"projectId": pid, "negative": "true"})
    assert all(rv["isNegative"] for rv in r.json()["reviews"])
    assert len(r.json()["reviews"]) >= 1

    assert c.get(f"{c.base}/reviews", params={"since": "вчера"}).status_code == 400
    assert c.get(f"{c.base}/reviews", params={"negative": "maybe"}).status_code == 400

    r = c.get(f"{c.base}/stats", params={"projectId": pid})
    assert r.status_code == 200, r.text
    stats = r.json()
    assert stats["reviews"]["total"] >= 2
    assert stats["reviews"]["negative"] >= 1
    assert stats["reviews"]["byRating"]["5"] >= 1
    assert len(stats["scans"]["daily"]) == 30
    assert stats["period"]["timezone"] == "Europe/Moscow"


def test_stats_validation(account):
    c = account["client"]
    assert c.get(f"{c.base}/stats", params={"from": "2026-02-01", "to": "2026-01-01"}).status_code == 400
    assert c.get(f"{c.base}/stats", params={"from": "2020-01-01", "to": "2026-01-01"}).status_code == 400
    assert c.get(f"{c.base}/stats", params={"projectId": "nope"}).status_code == 404


# --- отзыв ключа (в конце: ломает ключ модуля) ------------------------------


def test_revoked_key_is_401(base_url):
    session = new_user_session(base_url, prefix="public-api-revoke")
    key = create_key(session, base_url)
    client = api(base_url, key["secret"])
    assert client.get(f"{client.base}/me").status_code == 200

    r = session.delete(f"{base_url}/api/account/api-keys/{key['key']['id']}")
    assert r.status_code == 200
    assert client.get(f"{client.base}/me").status_code == 401
    assert session.delete(f"{base_url}/api/account/api-keys/{key['key']['id']}").status_code == 404
