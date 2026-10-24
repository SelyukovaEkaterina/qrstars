"""E2E: умная ротация площадок сохраняется через PUT /api/settings и закрыта на FREE."""

import pytest

from conftest import reset_user_to_free, set_user_plan


def _rotation(owner_session, base_url, establishment_id):
    r = owner_session.get(f"{base_url}/api/settings", params={"id": establishment_id})
    assert r.status_code == 200, r.text
    return r.json()["establishment"]["platformRotation"]


@pytest.fixture
def pro_owner(admin_session, base_url):
    set_user_plan(admin_session, base_url, "PRO")
    yield
    reset_user_to_free(admin_session, base_url)


def test_settings_get_returns_access_flags(owner_session, base_url, owner_establishment_id):
    r = owner_session.get(f"{base_url}/api/settings", params={"id": owner_establishment_id})
    assert r.status_code == 200, r.text
    access = r.json().get("access")
    assert access is not None
    assert access["isOwner"] is True
    assert isinstance(access["hasPaidFeatures"], bool)
    # userId владельца наружу не отдаём
    assert "userId" not in r.json()["establishment"]


def test_platform_rotation_persists_on_pro(
    pro_owner, owner_session, base_url, owner_establishment_id
):
    r = owner_session.put(
        f"{base_url}/api/settings",
        json={"id": owner_establishment_id, "platformRotation": True},
    )
    assert r.status_code == 200, r.text
    assert r.json()["establishment"]["platformRotation"] is True
    assert _rotation(owner_session, base_url, owner_establishment_id) is True

    r = owner_session.put(
        f"{base_url}/api/settings",
        json={"id": owner_establishment_id, "platformRotation": False},
    )
    assert r.status_code == 200, r.text
    assert _rotation(owner_session, base_url, owner_establishment_id) is False


def test_platform_rotation_saved_together_with_other_fields(
    pro_owner, owner_session, base_url, owner_establishment_id
):
    """Форма настроек проекта шлёт platformRotation вместе с остальными полями."""
    current = owner_session.get(
        f"{base_url}/api/settings", params={"id": owner_establishment_id}
    ).json()["establishment"]
    r = owner_session.put(
        f"{base_url}/api/settings",
        json={
            "id": owner_establishment_id,
            "name": current["name"],
            "address": current["address"],
            "platformRotation": True,
        },
    )
    assert r.status_code == 200, r.text
    assert _rotation(owner_session, base_url, owner_establishment_id) is True

    owner_session.put(
        f"{base_url}/api/settings",
        json={"id": owner_establishment_id, "platformRotation": False},
    )


def test_platform_rotation_cannot_be_enabled_on_free(
    admin_session, owner_session, base_url, owner_establishment_id
):
    reset_user_to_free(admin_session, base_url)
    assert _rotation(owner_session, base_url, owner_establishment_id) is False

    r = owner_session.put(
        f"{base_url}/api/settings",
        json={"id": owner_establishment_id, "platformRotation": True},
    )
    assert r.status_code == 403, r.text
    assert _rotation(owner_session, base_url, owner_establishment_id) is False

    # Выключение (и «эхо» текущего значения) на FREE не ломает сохранение
    r = owner_session.put(
        f"{base_url}/api/settings",
        json={"id": owner_establishment_id, "platformRotation": False},
    )
    assert r.status_code == 200, r.text
