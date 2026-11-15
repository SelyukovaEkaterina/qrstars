"""QR-анкета: режим FORM, новые типы полей, шаблоны, лимит заявок на FREE, CSV на PRO."""
import uuid

import requests as req_lib

from conftest import login, set_user_plan

FREE_LIMIT = 50


def _new_user(base_url, prefix="forms"):
    email = f"{prefix}-{uuid.uuid4().hex[:8]}@test.example.com"
    password = "secure123"
    reg = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "name": "Forms User", "consentPd": True},
    )
    assert reg.status_code == 200, reg.text
    session = req_lib.Session()
    login(session, base_url, email, password)
    return session, email


def _quick_start_form(session, base_url, preset="guest_survey", name="Кафе Анкета"):
    r = session.post(
        f"{base_url}/api/setup/quick-start",
        json={"intent": "form", "name": name, "formPresetId": preset},
    )
    assert r.status_code == 200, r.text
    return r.json()


def _form(session, base_url, form_id, establishment_id):
    forms = session.get(f"{base_url}/api/forms", params={"establishmentId": establishment_id}).json()["forms"]
    return next(f for f in forms if f["id"] == form_id)


def _field(form, type_):
    return next(f for f in form["fields"] if f["type"] == type_)


def test_quick_start_form_creates_enabled_form_and_qr(base_url):
    session, _ = _new_user(base_url, "forms-qs")
    data = _quick_start_form(session, base_url, preset="giveaway")
    assert data["intent"] == "form"
    assert data["qrcode"]["mode"] == "FORM"
    form_id = data["qrcode"]["formId"]
    assert form_id

    form = _form(session, base_url, form_id, data["establishment"]["id"])
    assert form["enabled"] is True
    assert form["preset"] == "giveaway"
    assert data["qrcode"]["label"] == "Участие в акции"

    scan = req_lib.get(f"{base_url}/q/{data['qrcode']['code']}")
    assert scan.status_code == 200
    assert form["title"] in scan.text


def test_quick_start_form_unknown_preset_falls_back_to_blank(base_url):
    session, _ = _new_user(base_url, "forms-qs-blank")
    data = _quick_start_form(session, base_url, preset="no-such-preset")
    form = _form(session, base_url, data["qrcode"]["formId"], data["establishment"]["id"])
    assert form["preset"] == "blank"


def test_new_field_types_validation(base_url):
    session, _ = _new_user(base_url, "forms-types")
    data = _quick_start_form(session, base_url, preset="guest_survey")
    form = _form(session, base_url, data["qrcode"]["formId"], data["establishment"]["id"])
    fid = form["id"]
    rating = _field(form, "rating")
    multi = _field(form, "multi")
    nps = _field(form, "nps")

    submit = lambda values, **extra: req_lib.post(  # noqa: E731
        f"{base_url}/api/forms/{fid}/submit", json={"values": values, **extra}
    )

    assert submit({rating["id"]: 6}).status_code == 400
    assert submit({rating["id"]: 4, multi["id"]: ["Чего-то нет"]}).status_code == 400
    assert submit({rating["id"]: 4, nps["id"]: 11}).status_code == 400
    # Обязательная оценка не заполнена.
    assert submit({multi["id"]: ["Атмосфера"]}).status_code == 400

    ok = submit({rating["id"]: 5, multi["id"]: ["Цены", "Атмосфера"], nps["id"]: 9})
    assert ok.status_code == 200, ok.text

    subs = session.get(f"{base_url}/api/forms/{fid}/submissions").json()["submissions"]
    assert subs[0]["values"][rating["id"]] == 5
    # Порядок как в списке вариантов поля.
    assert subs[0]["values"][multi["id"]] == ["Атмосфера", "Цены"]
    assert subs[0]["locked"] is False


def test_free_can_add_fields_and_option_fields_need_two_options(base_url):
    session, _ = _new_user(base_url, "forms-edit")
    data = _quick_start_form(session, base_url, preset="blank")
    form = _form(session, base_url, data["qrcode"]["formId"], data["establishment"]["id"])
    fields = form["fields"] + [
        {"label": "Ваш выбор", "type": "radio", "required": True, "options": ["Да", "Нет"]},
        {"label": "Оценка", "type": "rating", "required": False},
    ]
    r = session.put(f"{base_url}/api/forms", json={"id": form["id"], "fields": fields})
    assert r.status_code == 200, r.text
    assert len(r.json()["form"]["fields"]) == len(form["fields"]) + 2

    bad = session.put(
        f"{base_url}/api/forms",
        json={"id": form["id"], "fields": [{"label": "Один", "type": "multi", "options": ["А"]}]},
    )
    assert bad.status_code == 400

    too_many = session.put(
        f"{base_url}/api/forms",
        json={"id": form["id"], "fields": [{"label": f"Q{i}", "type": "text"} for i in range(31)]},
    )
    assert too_many.status_code == 400


def test_qr_can_link_only_own_form(base_url):
    owner, _ = _new_user(base_url, "forms-own")
    other, _ = _new_user(base_url, "forms-other")
    mine = _quick_start_form(owner, base_url)
    theirs = _quick_start_form(other, base_url)

    # Создать QR на чужую форму нельзя.
    r = owner.post(
        f"{base_url}/api/qrcodes",
        json={"establishmentId": mine["establishment"]["id"], "mode": "FORM", "formId": theirs["qrcode"]["formId"]},
    )
    assert r.status_code == 404

    # Перепривязать свой QR на чужую форму тоже нельзя.
    r = owner.put(
        f"{base_url}/api/qrcodes",
        json={"id": mine["qrcode"]["id"], "mode": "FORM", "formId": theirs["qrcode"]["formId"]},
    )
    assert r.status_code == 404

    # Второй QR на свою форму — можно.
    r = owner.post(
        f"{base_url}/api/qrcodes",
        json={"establishmentId": mine["establishment"]["id"], "mode": "FORM", "formId": mine["qrcode"]["formId"]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["qrcode"]["formId"] == mine["qrcode"]["formId"]


def test_phone_requires_pd_consent(base_url):
    session, _ = _new_user(base_url, "forms-pd")
    data = _quick_start_form(session, base_url, preset="event_registration")
    form = _form(session, base_url, data["qrcode"]["formId"], data["establishment"]["id"])
    values = {}
    for f in form["fields"]:
        if f["type"] == "phone":
            values[f["id"]] = "+79990001122"
        elif f["type"] == "number":
            values[f["id"]] = 2
        elif f["type"] == "text":
            values[f["id"]] = "Гость"
    url = f"{base_url}/api/forms/{form['id']}/submit"
    assert req_lib.post(url, json={"values": values}).status_code == 400
    assert req_lib.post(url, json={"values": values, "pdConsentGiven": True}).status_code == 200


def test_free_limit_hides_submissions_and_pro_unlocks(base_url, admin_session):
    session, email = _new_user(base_url, "forms-limit")
    first = _quick_start_form(session, base_url, preset="vote")
    est_id = first["establishment"]["id"]
    # Вторая форма в том же проекте: лимит частоты — 30 отправок в минуту на форму с IP.
    r = session.post(f"{base_url}/api/forms", json={"establishmentId": est_id, "presetId": "vote", "enabled": True})
    assert r.status_code == 200, r.text
    form_ids = [first["qrcode"]["formId"], r.json()["form"]["id"]]

    def send(form_id, n):
        form = _form(session, base_url, form_id, est_id)
        radio = _field(form, "radio")
        for _ in range(n):
            res = req_lib.post(
                f"{base_url}/api/forms/{form_id}/submit",
                json={"values": {radio["id"]: radio["options"][0]}},
            )
            assert res.status_code == 200, res.text

    send(form_ids[0], 25)
    send(form_ids[1], FREE_LIMIT - 25 + 1)

    data = session.get(f"{base_url}/api/establishments/{est_id}/form-submissions", params={"limit": 100}).json()
    assert data["quota"]["unlimited"] is False
    assert data["quota"]["used"] == FREE_LIMIT + 1
    assert data["quota"]["locked"] == 1
    locked = [s for s in data["submissions"] if s["locked"]]
    assert len(locked) == 1
    assert locked[0]["values"] == {}
    # Скрыта самая поздняя заявка, а не случайная.
    newest = max(data["submissions"], key=lambda s: s["createdAt"])
    assert newest["locked"] is True

    # CSV — только PRO.
    assert session.get(f"{base_url}/api/forms/{form_ids[0]}/export").status_code == 403

    set_user_plan(admin_session, base_url, "PRO", email=email)
    data = session.get(f"{base_url}/api/establishments/{est_id}/form-submissions", params={"limit": 100}).json()
    assert data["quota"]["unlimited"] is True
    assert not any(s["locked"] for s in data["submissions"])

    csv = session.get(f"{base_url}/api/forms/{form_ids[1]}/export")
    assert csv.status_code == 200, csv.text
    assert csv.headers["content-type"].startswith("text/csv")
    body = csv.content.decode("utf-8")
    assert body.startswith("﻿Дата;Ваш выбор;Почему?;QR-код")
    assert body.count("\r\n") == FREE_LIMIT - 25 + 1


def test_export_requires_access(base_url):
    owner, _ = _new_user(base_url, "forms-exp-own")
    other, _ = _new_user(base_url, "forms-exp-other")
    data = _quick_start_form(owner, base_url)
    assert other.get(f"{base_url}/api/forms/{data['qrcode']['formId']}/export").status_code == 404
    assert req_lib.get(f"{base_url}/api/forms/{data['qrcode']['formId']}/export").status_code == 401


def test_demo_form_templates():
    from conftest import BASE_URL, wait_for_app

    wait_for_app(BASE_URL)
    r = req_lib.get(f"{BASE_URL}/q/demo-form", params={"t": "giveaway"})
    assert r.status_code == 200
    assert "Участвуйте в розыгрыше" in r.text
    assert "Шаблоны форм" in r.text

    bare = req_lib.get(f"{BASE_URL}/q/demo-form", params={"t": "guest_survey", "bar": "0"})
    assert bare.status_code == 200
    assert "Как вам у нас?" in bare.text
    assert "Шаблоны форм" not in bare.text


def test_form_stats_free_and_pro(base_url, admin_session):
    session, email = _new_user(base_url, "forms-stats")
    data = _quick_start_form(session, base_url, preset="guest_survey")
    est_id = data["establishment"]["id"]
    form = _form(session, base_url, data["qrcode"]["formId"], est_id)
    rating, multi, nps = _field(form, "rating"), _field(form, "multi"), _field(form, "nps")

    for values in (
        {rating["id"]: 5, multi["id"]: ["Еда и напитки", "Атмосфера"], nps["id"]: 10},
        {rating["id"]: 4, multi["id"]: ["Еда и напитки"], nps["id"]: 6},
    ):
        r = req_lib.post(f"{base_url}/api/forms/{form['id']}/submit", json={"values": values})
        assert r.status_code == 200, r.text
    # Скан QR формы — для конверсии.
    assert req_lib.get(f"{base_url}/q/{data['qrcode']['code']}").status_code == 200

    free = session.get(f"{base_url}/api/forms/{form['id']}/stats", params={"days": 7}).json()
    assert free["days"] == 7
    assert free["total"] == 2 and free["current"] == 2 and free["previous"] == 0
    assert free["qrCount"] == 1
    assert free["unlimited"] is False
    assert free["fields"] is None and free["byDay"] is None

    set_user_plan(admin_session, base_url, "PRO", email=email)
    pro = session.get(f"{base_url}/api/forms/{form['id']}/stats", params={"days": 30}).json()
    assert pro["unlimited"] is True
    assert len(pro["byDay"]) == 30 and sum(d["count"] for d in pro["byDay"]) == 2
    by_id = {f["fieldId"]: f for f in pro["fields"]}
    assert by_id[rating["id"]]["average"] == 4.5
    # 1 промоутер (10), 1 критик (6) → 0.
    assert by_id[nps["id"]]["nps"] == 0
    food = next(d for d in by_id[multi["id"]]["distribution"] if d["label"] == "Еда и напитки")
    assert food["count"] == 2


def test_form_stats_requires_access(base_url):
    owner, _ = _new_user(base_url, "forms-stats-own")
    other, _ = _new_user(base_url, "forms-stats-other")
    data = _quick_start_form(owner, base_url)
    fid = data["qrcode"]["formId"]
    assert other.get(f"{base_url}/api/forms/{fid}/stats").status_code == 404
    assert req_lib.get(f"{base_url}/api/forms/{fid}/stats").status_code == 401
