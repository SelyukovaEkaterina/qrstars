"""Перенос дизайна из бесплатного генератора на лендинге в «Шаблоны оформления».

Лендинг передаёт `?qr_style=<base64url JSON>` в ссылку регистрации, кабинет вызывает
`POST /api/templates/from-generator`, а `/api/setup/quick-start` применяет стиль к первому QR.
"""

import base64
import json
import uuid

import requests as req_lib

from conftest import login


STYLE = {
    "v": 1,
    "dotStyle": "rounded",
    "eyeStyle": "leaf",
    "fg": "#0f172a",
    "bg": "#ffffff",
    "bgTransparent": False,
    "gradient": False,
    "grad1": "#4f46e5",
    "grad2": "#a855f7",
    "gradType": "linear-tb",
    "eyeCustom": True,
    "eyeColor": "#dc2626",
    "logoPreset": "☕",
    "logoSrc": None,
    "logoFill": False,
    "logoSize": 20,
    "frame": True,
    "frameText": "НАВЕДИ КАМЕРУ",
    "frameStyle": "bottom",
    "ecc": "H",
    "margin": 2,
    "scatter": False,
    "scatterDensity": 3,
    "scatterShape": "star",
}


def encode(style):
    raw = json.dumps(style, ensure_ascii=False).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def new_user_session(base_url, prefix="gen-style"):
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


def generator_templates(session, base_url):
    templates = session.get(f"{base_url}/api/templates").json()["templates"]
    return [t for t in templates if (t.get("layout") or {}).get("source") == "free-generator"]


def test_import_creates_template_once(base_url):
    session = new_user_session(base_url)
    r = session.post(f"{base_url}/api/templates/from-generator", json={"style": encode(STYLE)})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["created"] is True
    assert data["appliesToFirstQr"] is True

    again = session.post(f"{base_url}/api/templates/from-generator", json={"style": encode(STYLE)})
    assert again.status_code == 200
    assert again.json()["created"] is False
    assert again.json()["template"]["id"] == data["template"]["id"]

    rows = generator_templates(session, base_url)
    assert len(rows) == 1
    config = rows[0]["layout"]["config"]
    assert config["eyeStyle"] == "leaf"
    assert config["eyeColor"] == "#dc2626"
    assert config["frameText"] == "НАВЕДИ КАМЕРУ"
    assert config["logoPreset"] == "☕"


def test_import_rejects_invalid_style(base_url):
    session = new_user_session(base_url, "gen-style-bad")
    for style in (
        "not-base64!",
        encode({**STYLE, "logoSrc": "https://evil.example/logo.png"}),
        encode({**STYLE, "fg": "red"}),
        encode({"v": 1}),
    ):
        r = session.post(f"{base_url}/api/templates/from-generator", json={"style": style})
        assert r.status_code == 400, (style, r.text)
    assert generator_templates(session, base_url) == []


ART_KEYS = ("silhouette", "silhouetteFit", "rotate45", "inkShift", "photoStyle", "silhouetteDataUrl")


def test_import_old_style_keeps_config_without_art_fields(base_url):
    """Старые ссылки генератора (без арт-полей) дают тот же конфиг, что и раньше."""
    session = new_user_session(base_url, "gen-style-old")
    r = session.post(f"{base_url}/api/templates/from-generator", json={"style": encode(STYLE)})
    assert r.status_code == 200, r.text
    config = generator_templates(session, base_url)[0]["layout"]["config"]
    for key in ART_KEYS:
        assert key not in config, key


def test_import_art_style(base_url):
    session = new_user_session(base_url, "gen-style-art")
    style = {
        **STYLE,
        "dotStyle": "liquid",
        "silhouette": "heart",
        "silhouetteFit": 90,
        "rotate45": True,
        "inkShift": True,
    }
    r = session.post(f"{base_url}/api/templates/from-generator", json={"style": encode(style)})
    assert r.status_code == 200, r.text
    config = generator_templates(session, base_url)[0]["layout"]["config"]
    assert config["dotStyle"] == "liquid"
    assert config["silhouette"] == "heart"
    assert config["silhouetteFit"] == 90
    assert config["rotate45"] is True
    assert config["inkShift"] is True

    # Другой дизайн — новый шаблон, а не тот же.
    other = session.post(
        f"{base_url}/api/templates/from-generator",
        json={"style": encode({**style, "silhouette": "tooth"})},
    )
    assert other.status_code == 200
    assert other.json()["created"] is True


def test_import_rejects_invalid_art_style(base_url):
    session = new_user_session(base_url, "gen-style-art-bad")
    for style in (
        {**STYLE, "dotStyle": "sparkles"},
        # Своя фигура — картинка, по ссылке не переносится.
        {**STYLE, "silhouette": "custom"},
        {**STYLE, "silhouette": "heart", "silhouetteFit": 20},
        {**STYLE, "rotate45": "yes"},
    ):
        r = session.post(f"{base_url}/api/templates/from-generator", json={"style": encode(style)})
        assert r.status_code == 400, (style, r.text)
    assert generator_templates(session, base_url) == []


def test_import_requires_auth(base_url):
    r = req_lib.post(f"{base_url}/api/templates/from-generator", json={"style": encode(STYLE)})
    assert r.status_code == 401


def test_quick_start_applies_generator_style_to_first_qr_only(base_url):
    session = new_user_session(base_url, "gen-style-qs")
    imported = session.post(
        f"{base_url}/api/templates/from-generator", json={"style": encode(STYLE)}
    ).json()
    template_id = imported["template"]["id"]

    first = session.post(
        f"{base_url}/api/setup/quick-start",
        json={
            "intent": "redirect",
            "name": "Генератор Тест",
            "redirectUrl": "https://example.com/promo",
        },
    )
    assert first.status_code == 200, first.text
    first_qr = session.get(
        f"{base_url}/api/qrcodes", params={"id": first.json()["qrcode"]["id"]}
    ).json()["qrcode"]
    assert first_qr["qrStyleTemplateId"] == template_id

    # Повторный импорт после первого QR: стиль сохранён, но к новым кодам сам не применяется.
    later = session.post(
        f"{base_url}/api/templates/from-generator",
        json={"style": encode({**STYLE, "fg": "#111111"})},
    )
    assert later.status_code == 200
    assert later.json()["appliesToFirstQr"] is False


def test_register_redirects_logged_in_user_with_style(base_url):
    session = new_user_session(base_url, "gen-style-redirect")
    style = encode(STYLE)
    r = session.get(f"{base_url}/register", params={"qr_style": style}, allow_redirects=False)
    assert r.status_code in (302, 303, 307, 308)
    location = r.headers["location"]
    assert "/dashboard/settings/templates" in location
    assert f"qr_style={style}" in location
