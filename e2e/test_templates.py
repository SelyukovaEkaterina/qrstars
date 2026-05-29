import pytest
import requests as req_lib

SAMPLE_LAYOUT = {
    "elements": [
        {"type": "text", "content": "Привет!", "x": 10, "y": 10, "fontSize": 24}
    ]
}


def test_list_templates_authenticated(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/templates")
    assert r.status_code == 200
    data = r.json()
    assert "templates" in data
    assert isinstance(data["templates"], list)


def test_list_templates_unauthorized(base_url):
    r = req_lib.get(f"{base_url}/api/templates")
    assert r.status_code == 401


def test_list_templates_includes_default(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/templates")
    templates = r.json()["templates"]
    assert len(templates) >= 1


def test_create_template(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/templates",
        json={
            "name": "Мой шаблон",
            "description": "Тестовый шаблон",
            "width": 210,
            "height": 148,
            "layout": SAMPLE_LAYOUT,
            "isPublic": False,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert "template" in data
    tmpl = data["template"]
    assert tmpl["name"] == "Мой шаблон"
    assert tmpl["width"] == 210
    assert tmpl["height"] == 148
    assert tmpl["isPublic"] is False
    return tmpl["id"]


def test_create_template_missing_required(owner_session, base_url):
    r = owner_session.post(
        f"{base_url}/api/templates",
        json={"name": "Без layout"},
    )
    assert r.status_code == 400


def test_create_template_unauthorized(base_url):
    r = req_lib.post(
        f"{base_url}/api/templates",
        json={"name": "Неавт", "layout": SAMPLE_LAYOUT},
    )
    assert r.status_code == 401


def test_get_template_by_id(owner_session, base_url):
    create_r = owner_session.post(
        f"{base_url}/api/templates",
        json={
            "name": "Шаблон для чтения",
            "layout": SAMPLE_LAYOUT,
        },
    )
    tmpl_id = create_r.json()["template"]["id"]

    r = owner_session.get(f"{base_url}/api/templates/{tmpl_id}")
    assert r.status_code == 200
    assert r.json()["template"]["id"] == tmpl_id


def test_get_template_not_found(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/templates/nonexistent")
    assert r.status_code == 404


def test_update_template(owner_session, base_url):
    create_r = owner_session.post(
        f"{base_url}/api/templates",
        json={
            "name": "Шаблон до обновления",
            "layout": SAMPLE_LAYOUT,
        },
    )
    tmpl_id = create_r.json()["template"]["id"]

    new_layout = {"elements": [{"type": "qr", "x": 50, "y": 50, "size": 80}]}
    r = owner_session.put(
        f"{base_url}/api/templates/{tmpl_id}",
        json={
            "name": "Обновлённый шаблон",
            "description": "Новое описание",
            "layout": new_layout,
            "isPublic": True,
        },
    )
    assert r.status_code == 200
    updated = r.json()["template"]
    assert updated["name"] == "Обновлённый шаблон"
    assert updated["isPublic"] is True


def test_update_template_not_found(owner_session, base_url):
    r = owner_session.put(
        f"{base_url}/api/templates/nonexistent",
        json={"name": "Нет"},
    )
    assert r.status_code == 404


def test_delete_template(owner_session, base_url):
    create_r = owner_session.post(
        f"{base_url}/api/templates",
        json={
            "name": "Шаблон для удаления",
            "layout": SAMPLE_LAYOUT,
        },
    )
    tmpl_id = create_r.json()["template"]["id"]

    r = owner_session.delete(f"{base_url}/api/templates/{tmpl_id}")
    assert r.status_code == 200
    assert r.json().get("success") is True

    get_r = owner_session.get(f"{base_url}/api/templates/{tmpl_id}")
    assert get_r.status_code == 404


def test_delete_template_not_found(owner_session, base_url):
    r = owner_session.delete(f"{base_url}/api/templates/nonexistent")
    assert r.status_code == 404


def test_delete_template_unauthorized(base_url):
    r = req_lib.delete(f"{base_url}/api/templates/some-id")
    assert r.status_code == 401
