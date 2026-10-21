"""Стили QR в кабинете: привязка стиля к QR и ограничения API шаблонов.

- привязать можно только свой или встроенный стиль (чужой / несуществующий → 400, не 500);
- пользователь не может сделать свой шаблон публичным (иначе его увидят все);
- слишком большой layout (логотип/фото без сжатия) отклоняется.
"""

import uuid

import requests as req_lib

from conftest import login


def new_user(base_url, prefix="qr-style"):
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


def make_qr(session, base_url):
    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={"intent": "redirect", "name": "Стиль Тест", "redirectUrl": "https://example.com"},
    )
    assert r.status_code == 200, r.text
    return r.json()["qrcode"]["id"]


def style_layout(**overrides):
    config = {
        "dotStyle": "rounded",
        "eyeStyle": "leaf",
        "fg": "#0f172a",
        "bg": "#ffffff",
        "bgTransparent": False,
        "gradient": False,
        "grad1": "#4f46e5",
        "grad2": "#a855f7",
        "gradType": "linear-tb",
        "eyeCustom": False,
        "eyeColor": "#4f46e5",
        "logoPreset": "☕",
        "logoSrc": None,
        "logoDataUrl": None,
        "logoFill": False,
        "logoSize": 20,
        "frame": False,
        "frameText": "СКАНИРУЙ МЕНЯ",
        "frameStyle": "bottom",
        "ecc": "H",
        "margin": 2,
        "scatter": False,
        "scatterDensity": 3,
        "scatterShape": "square",
        "photoSrc": "/photo-presets/forest.jpg",
        "photoDataUrl": None,
    }
    config.update(overrides)
    return {"__type": "qr-style", "config": config}


def create_template(session, base_url, **body):
    payload = {"name": "Мой стиль", "layout": style_layout()}
    payload.update(body)
    return session.post(f"{base_url}/api/templates", json=payload)


def test_bind_own_and_builtin_style(base_url):
    session = new_user(base_url)
    qr_id = make_qr(session, base_url)

    own = create_template(session, base_url)
    assert own.status_code == 200, own.text
    own_id = own.json()["template"]["id"]

    r = session.put(f"{base_url}/api/qrcodes", json={"id": qr_id, "qrStyleTemplateId": own_id})
    assert r.status_code == 200, r.text

    r = session.put(f"{base_url}/api/qrcodes", json={"id": qr_id, "qrStyleTemplateId": "qr-preset-cafe"})
    assert r.status_code == 200, r.text

    qr = session.get(f"{base_url}/api/qrcodes", params={"id": qr_id}).json()["qrcode"]
    assert qr["qrStyleTemplateId"] == "qr-preset-cafe"


def test_photo_is_saved_in_template(base_url):
    session = new_user(base_url, "qr-style-photo")
    tpl = create_template(session, base_url).json()["template"]
    templates = session.get(f"{base_url}/api/templates").json()["templates"]
    saved = next(t for t in templates if t["id"] == tpl["id"])
    assert saved["layout"]["config"]["photoSrc"] == "/photo-presets/forest.jpg"


def test_bind_missing_or_foreign_style_is_400(base_url):
    owner = new_user(base_url, "qr-style-owner")
    stranger = new_user(base_url, "qr-style-stranger")
    qr_id = make_qr(owner, base_url)
    foreign_id = create_template(stranger, base_url).json()["template"]["id"]

    for style_id in ("qr-preset-does-not-exist", "nonexistent-template", foreign_id, 123):
        r = owner.put(f"{base_url}/api/qrcodes", json={"id": qr_id, "qrStyleTemplateId": style_id})
        assert r.status_code == 400, (style_id, r.status_code, r.text)

    qr = owner.get(f"{base_url}/api/qrcodes", params={"id": qr_id}).json()["qrcode"]
    assert qr["qrStyleTemplateId"] != foreign_id


def test_user_cannot_publish_template(base_url):
    author = new_user(base_url, "qr-style-public")
    other = new_user(base_url, "qr-style-viewer")
    created = create_template(author, base_url, isPublic=True, name="Публичный?")
    assert created.status_code == 200, created.text
    template_id = created.json()["template"]["id"]
    assert created.json()["template"]["isPublic"] is False

    updated = author.put(f"{base_url}/api/templates/{template_id}", json={"isPublic": True})
    assert updated.status_code == 200
    assert updated.json()["template"]["isPublic"] is False

    visible = [t["id"] for t in other.get(f"{base_url}/api/templates").json()["templates"]]
    assert template_id not in visible


def test_oversized_or_invalid_layout_is_rejected(base_url):
    session = new_user(base_url, "qr-style-big")
    huge = "data:image/png;base64," + "A" * 1_600_000
    r = create_template(session, base_url, layout=style_layout(logoDataUrl=huge))
    assert r.status_code == 400, r.text

    r = create_template(session, base_url, layout="not-an-object")
    assert r.status_code == 400

    ok = create_template(session, base_url)
    template_id = ok.json()["template"]["id"]
    r = session.put(f"{base_url}/api/templates/{template_id}", json={"layout": style_layout(photoDataUrl=huge)})
    assert r.status_code == 400
