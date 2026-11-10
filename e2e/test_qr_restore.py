"""Восстановление QR после аварии Beget: владелец вводит ID напечатанного кода
и заново привязывает его к своему проекту (`POST /api/qrcodes/restore`).
Неизвестный код при скане показывает «редирект временно недоступен» с ID кода.
"""

import uuid

import requests as req_lib

from conftest import login


def new_user_session(base_url, prefix="qr-restore"):
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


def create_project(session, base_url, name="Кафе после аварии"):
    r = session.post(f"{base_url}/api/establishments", json={"name": name})
    assert r.status_code == 200, r.text
    return r.json()["establishment"]["id"]


def lost_code():
    return f"lost{uuid.uuid4().hex[:8]}"


def test_unknown_code_scan_shows_restore_hint(base_url):
    code = lost_code()
    r = req_lib.get(f"{base_url}/q/{code}", allow_redirects=False)
    assert r.status_code == 200
    assert "временно недоступен" in r.text
    assert code in r.text
    assert f"/restore?code={code}" in r.text


def test_restore_with_redirect_url(base_url):
    session = new_user_session(base_url)
    est_id = create_project(session, base_url)
    code = lost_code()

    r = session.post(
        f"{base_url}/api/qrcodes/restore",
        json={"code": f"https://app.qrstars.ru/q/{code}", "establishmentId": est_id, "redirectUrl": "https://example.com/menu"},
    )
    assert r.status_code == 200, r.text
    qr = r.json()["qrcode"]
    assert qr["code"] == code
    assert qr["establishmentId"] == est_id
    assert qr["mode"] == "REDIRECT"

    scan = req_lib.get(f"{base_url}/q/{code}", allow_redirects=False)
    assert scan.status_code in (200, 307, 308)
    if scan.status_code != 200:
        assert scan.headers["location"].startswith("https://example.com/menu")


def test_restore_without_url_shows_unavailable_until_configured(base_url):
    session = new_user_session(base_url)
    est_id = create_project(session, base_url)
    code = lost_code()

    r = session.post(f"{base_url}/api/qrcodes/restore", json={"code": code, "establishmentId": est_id})
    assert r.status_code == 200, r.text

    scan = req_lib.get(f"{base_url}/q/{code}", allow_redirects=False)
    assert scan.status_code == 200
    assert "временно недоступен" in scan.text
    # Код уже занят — кнопки «восстановить» гостю не показываем.
    assert "/restore?code=" not in scan.text


def test_restore_conflicts(base_url):
    first = new_user_session(base_url)
    first_est = create_project(first, base_url)
    code = lost_code()
    r = first.post(f"{base_url}/api/qrcodes/restore", json={"code": code, "establishmentId": first_est})
    assert r.status_code == 200, r.text
    qr_id = r.json()["qrcode"]["id"]

    again = first.post(f"{base_url}/api/qrcodes/restore", json={"code": code, "establishmentId": first_est})
    assert again.status_code == 409
    assert again.json()["qrcodeId"] == qr_id

    second = new_user_session(base_url)
    second_est = create_project(second, base_url)
    taken = second.post(f"{base_url}/api/qrcodes/restore", json={"code": code, "establishmentId": second_est})
    assert taken.status_code == 409
    assert "qrcodeId" not in taken.json()


def test_restore_validation(base_url):
    session = new_user_session(base_url)
    est_id = create_project(session, base_url)

    for bad in ["", "a", "код кафе", "demo-review"]:
        r = session.post(f"{base_url}/api/qrcodes/restore", json={"code": bad, "establishmentId": est_id})
        assert r.status_code == 400, (bad, r.text)

    r = session.post(f"{base_url}/api/qrcodes/restore", json={"code": lost_code()})
    assert r.status_code == 400

    r = session.post(
        f"{base_url}/api/qrcodes/restore",
        json={"code": lost_code(), "establishmentId": est_id, "redirectUrl": "javascript:alert(1)"},
    )
    assert r.status_code == 400


def test_restore_requires_auth_and_own_project(base_url):
    r = req_lib.post(f"{base_url}/api/qrcodes/restore", json={"code": lost_code(), "establishmentId": "x"})
    assert r.status_code == 401

    owner = new_user_session(base_url)
    owner_est = create_project(owner, base_url)
    stranger = new_user_session(base_url)
    r = stranger.post(f"{base_url}/api/qrcodes/restore", json={"code": lost_code(), "establishmentId": owner_est})
    assert r.status_code == 404
