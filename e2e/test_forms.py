import pytest


def test_create_form_with_preset(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/forms",
        json={"establishmentId": owner_establishment_id, "presetId": "table_booking"},
    )
    assert r.status_code == 200, r.text
    form = r.json()["form"]
    assert form["title"] == "Забронировать столик"
    assert form["preset"] == "table_booking"
    assert len(form["fields"]) >= 5
    labels = {f["label"] for f in form["fields"]}
    assert "Имя" in labels
    assert "Телефон" in labels
    assert "Дата" in labels
    owner_session.delete(f"{base_url}/api/forms", params={"id": form["id"]})


def test_create_form_blank_preset_default(owner_session, base_url, owner_establishment_id):
    r = owner_session.post(
        f"{base_url}/api/forms",
        json={"establishmentId": owner_establishment_id},
    )
    assert r.status_code == 200
    form = r.json()["form"]
    assert form["preset"] == "blank"
    owner_session.delete(f"{base_url}/api/forms", params={"id": form["id"]})


def test_create_form_requires_establishment(owner_session, base_url):
    r = owner_session.post(f"{base_url}/api/forms", json={"presetId": "blank"})
    assert r.status_code == 400


def test_list_forms_for_establishment(owner_session, base_url, owner_establishment_id):
    create = owner_session.post(
        f"{base_url}/api/forms",
        json={"establishmentId": owner_establishment_id, "presetId": "blank"},
    )
    fid = create.json()["form"]["id"]
    try:
        r = owner_session.get(
            f"{base_url}/api/forms", params={"establishmentId": owner_establishment_id}
        )
        assert r.status_code == 200
        ids = [f["id"] for f in r.json()["forms"]]
        assert fid in ids
    finally:
        owner_session.delete(f"{base_url}/api/forms", params={"id": fid})


def test_update_form_fields_pro_required_to_add(
    owner_session, admin_session, base_url, owner_establishment_id
):
    # Ensure user is FREE
    from conftest import reset_user_to_free
    reset_user_to_free(admin_session, base_url)

    create = owner_session.post(
        f"{base_url}/api/forms",
        json={"establishmentId": owner_establishment_id, "presetId": "blank"},
    )
    form = create.json()["form"]
    fid = form["id"]
    try:
        existing = form["fields"]
        new_fields = existing + [
            {
                "label": "Лишнее поле",
                "type": "text",
                "required": False,
            }
        ]
        r = owner_session.put(
            f"{base_url}/api/forms",
            json={"id": fid, "fields": new_fields},
        )
        assert r.status_code == 403
    finally:
        owner_session.delete(f"{base_url}/api/forms", params={"id": fid})


def test_update_form_fields_edit_existing_on_free(
    owner_session, admin_session, base_url, owner_establishment_id
):
    from conftest import reset_user_to_free
    reset_user_to_free(admin_session, base_url)

    create = owner_session.post(
        f"{base_url}/api/forms",
        json={"establishmentId": owner_establishment_id, "presetId": "blank"},
    )
    form = create.json()["form"]
    fid = form["id"]
    try:
        edited = [{**f, "label": f["label"] + " (изм.)"} for f in form["fields"]]
        r = owner_session.put(
            f"{base_url}/api/forms",
            json={"id": fid, "fields": edited, "title": "Новый заголовок"},
        )
        assert r.status_code == 200, r.text
        updated = r.json()["form"]
        assert updated["title"] == "Новый заголовок"
        assert all("(изм.)" in f["label"] for f in updated["fields"])
    finally:
        owner_session.delete(f"{base_url}/api/forms", params={"id": fid})


def test_submit_form_creates_submission(owner_session, base_url, owner_establishment_id):
    create = owner_session.post(
        f"{base_url}/api/forms",
        json={"establishmentId": owner_establishment_id, "presetId": "blank"},
    )
    form = create.json()["form"]
    fid = form["id"]
    try:
        values = {}
        for f in form["fields"]:
            if f["type"] == "phone":
                values[f["id"]] = "+79991234567"
            elif f["type"] == "checkbox":
                values[f["id"]] = True
            else:
                values[f["id"]] = "Тестовое значение"

        # Public endpoint — no auth required
        import requests
        r = requests.post(f"{base_url}/api/forms/{fid}/submit", json={"values": values})
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True
        assert "successMessage" in r.json()

        # Owner can list submissions
        subs_r = owner_session.get(f"{base_url}/api/forms/{fid}/submissions")
        assert subs_r.status_code == 200
        subs = subs_r.json()["submissions"]
        assert len(subs) >= 1
    finally:
        owner_session.delete(f"{base_url}/api/forms", params={"id": fid})


def test_submit_form_rejects_missing_required(owner_session, base_url, owner_establishment_id):
    create = owner_session.post(
        f"{base_url}/api/forms",
        json={"establishmentId": owner_establishment_id, "presetId": "blank"},
    )
    fid = create.json()["form"]["id"]
    try:
        import requests
        r = requests.post(f"{base_url}/api/forms/{fid}/submit", json={"values": {}})
        assert r.status_code == 400
    finally:
        owner_session.delete(f"{base_url}/api/forms", params={"id": fid})


def test_submit_disabled_form_returns_404(owner_session, base_url, owner_establishment_id):
    create = owner_session.post(
        f"{base_url}/api/forms",
        json={"establishmentId": owner_establishment_id, "presetId": "blank"},
    )
    form = create.json()["form"]
    fid = form["id"]
    try:
        owner_session.put(
            f"{base_url}/api/forms",
            json={"id": fid, "enabled": False},
        )
        import requests
        r = requests.post(f"{base_url}/api/forms/{fid}/submit", json={"values": {}})
        assert r.status_code == 404
    finally:
        owner_session.delete(f"{base_url}/api/forms", params={"id": fid})


def test_delete_form(owner_session, base_url, owner_establishment_id):
    create = owner_session.post(
        f"{base_url}/api/forms",
        json={"establishmentId": owner_establishment_id, "presetId": "blank"},
    )
    fid = create.json()["form"]["id"]
    r = owner_session.delete(f"{base_url}/api/forms", params={"id": fid})
    assert r.status_code == 200
    # Now fetch should be 404
    subs_r = owner_session.get(f"{base_url}/api/forms/{fid}/submissions")
    assert subs_r.status_code == 404


def test_list_submissions_by_establishment(
    owner_session, base_url, owner_establishment_id
):
    create = owner_session.post(
        f"{base_url}/api/forms",
        json={"establishmentId": owner_establishment_id, "presetId": "blank"},
    )
    form = create.json()["form"]
    fid = form["id"]
    try:
        values = {f["id"]: "Тест" for f in form["fields"]}
        import requests

        requests.post(f"{base_url}/api/forms/{fid}/submit", json={"values": values})

        r = owner_session.get(
            f"{base_url}/api/establishments/{owner_establishment_id}/form-submissions"
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total"] >= 1
        assert any(s["form"]["id"] == fid for s in data["submissions"])
        assert "forms" in data

        filtered = owner_session.get(
            f"{base_url}/api/establishments/{owner_establishment_id}/form-submissions",
            params={"formId": fid},
        )
        assert filtered.status_code == 200
        assert all(s["form"]["id"] == fid for s in filtered.json()["submissions"])
    finally:
        owner_session.delete(f"{base_url}/api/forms", params={"id": fid})


def test_demo_form_renders():
    import requests
    from conftest import BASE_URL, wait_for_app
    wait_for_app(BASE_URL)
    r = requests.get(f"{BASE_URL}/scan/demo-form")
    assert r.status_code == 200
    assert "Записаться" in r.text or "Имя" in r.text
