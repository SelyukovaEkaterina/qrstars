import uuid

import pytest
import requests as req_lib

from conftest import login, set_user_plan


def unique_email(prefix="member"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@test.example.com"


def register_user(base_url, email, password="secure123"):
    r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "name": "E2E Member", "consentPd": True},
    )
    assert r.status_code == 200, r.text
    return email, password


def get_owner_establishment_id(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/establishments")
    assert r.status_code == 200
    establishments = r.json().get("establishments", [])
    owned = [e for e in establishments if e.get("isOwner", True) is not False]
    assert owned, "Owner must have at least one establishment"
    return owned[0]["id"]


def test_invite_existing_user_grants_access(owner_session, base_url):
    member_email, member_password = register_user(base_url, unique_email("existing"))

    est_id = get_owner_establishment_id(owner_session, base_url)

    invite_r = owner_session.post(
        f"{base_url}/api/establishments/{est_id}/members",
        json={"email": member_email},
    )
    assert invite_r.status_code == 201, invite_r.text
    assert invite_r.json()["member"]["status"] == "ACTIVE"

    member_session = req_lib.Session()
    login(member_session, base_url, member_email, member_password)

    list_r = member_session.get(f"{base_url}/api/establishments")
    assert list_r.status_code == 200
    ids = [e["id"] for e in list_r.json()["establishments"]]
    assert est_id in ids
    shared = next(e for e in list_r.json()["establishments"] if e["id"] == est_id)
    assert shared.get("isOwner") is False


def test_member_can_edit_settings(owner_session, base_url):
    member_email, member_password = register_user(base_url, unique_email("editor"))
    est_id = get_owner_establishment_id(owner_session, base_url)

    owner_session.post(
        f"{base_url}/api/establishments/{est_id}/members",
        json={"email": member_email},
    )

    member_session = req_lib.Session()
    login(member_session, base_url, member_email, member_password)

    settings_r = member_session.get(f"{base_url}/api/settings?id={est_id}")
    assert settings_r.status_code == 200

    put_r = member_session.put(
        f"{base_url}/api/settings",
        json={"id": est_id, "name": "E2E Shared Rename"},
    )
    assert put_r.status_code == 200
    assert put_r.json()["establishment"]["name"] == "E2E Shared Rename"


def test_member_cannot_delete_establishment(owner_session, base_url):
    member_email, member_password = register_user(base_url, unique_email("nodelete"))
    est_id = get_owner_establishment_id(owner_session, base_url)

    owner_session.post(
        f"{base_url}/api/establishments/{est_id}/members",
        json={"email": member_email},
    )

    member_session = req_lib.Session()
    login(member_session, base_url, member_email, member_password)

    del_r = member_session.delete(f"{base_url}/api/establishments", params={"id": est_id})
    assert del_r.status_code == 403


def test_member_cannot_invite_others(owner_session, base_url):
    member_email, member_password = register_user(base_url, unique_email("noinvite"))
    est_id = get_owner_establishment_id(owner_session, base_url)

    owner_session.post(
        f"{base_url}/api/establishments/{est_id}/members",
        json={"email": member_email},
    )

    member_session = req_lib.Session()
    login(member_session, base_url, member_email, member_password)

    invite_r = member_session.post(
        f"{base_url}/api/establishments/{est_id}/members",
        json={"email": unique_email("blocked")},
    )
    assert invite_r.status_code == 403


def test_invite_pending_user_and_register_with_token(owner_session, base_url):
    pending_email = unique_email("pending")
    est_id = get_owner_establishment_id(owner_session, base_url)

    invite_r = owner_session.post(
        f"{base_url}/api/establishments/{est_id}/members",
        json={"email": pending_email},
    )
    assert invite_r.status_code == 201
    assert invite_r.json()["member"]["status"] == "PENDING"

    members_r = owner_session.get(f"{base_url}/api/establishments/{est_id}/members")
    assert members_r.status_code == 200
    pending = next(m for m in members_r.json()["members"] if m["email"] == pending_email)

    preview_r = req_lib.get(
        f"{base_url}/api/establishments/invite-preview",
        params={"token": "invalid-token"},
    )
    assert preview_r.status_code == 404

    reg_r = req_lib.post(
        f"{base_url}/api/auth/register",
        json={
            "email": pending_email,
            "password": "secure123",
            "consentPd": True,
        },
    )
    assert reg_r.status_code == 200

    member_session = req_lib.Session()
    login(member_session, base_url, pending_email, "secure123")

    list_r = member_session.get(f"{base_url}/api/establishments")
    assert est_id in [e["id"] for e in list_r.json()["establishments"]]

    members_after = owner_session.get(f"{base_url}/api/establishments/{est_id}/members")
    active = next(m for m in members_after.json()["members"] if m["email"] == pending_email)
    assert active["status"] == "ACTIVE"


def test_shared_establishment_not_in_owned_limit(owner_session, admin_session, base_url):
    set_user_plan(admin_session, base_url, "NETWORK", email="demo@smartreview.ru")

    member_email, member_password = register_user(base_url, unique_email("freemember"))
    create_est = owner_session.post(
        f"{base_url}/api/establishments",
        json={"name": "E2E Shared Access Host"},
    )
    assert create_est.status_code == 200, create_est.text
    est_id = create_est.json()["establishment"]["id"]

    invite_r = owner_session.post(
        f"{base_url}/api/establishments/{est_id}/members",
        json={"email": member_email},
    )
    assert invite_r.status_code == 201, invite_r.text

    member_session = req_lib.Session()
    login(member_session, base_url, member_email, member_password)

    create_r = member_session.post(
        f"{base_url}/api/establishments",
        json={"name": "Member Own Est"},
    )
    assert create_r.status_code == 200

    create2_r = member_session.post(
        f"{base_url}/api/establishments",
        json={"name": "Member Second Own"},
    )
    assert create2_r.status_code == 403

    list_r = member_session.get(f"{base_url}/api/establishments")
    assert list_r.status_code == 200
    assert len(list_r.json()["establishments"]) >= 2


def test_invite_rate_limit(owner_session, base_url):
    """Run last: exhausts owner invite quota for the hour."""
    est_id = get_owner_establishment_id(owner_session, base_url)

    last_status = None
    for i in range(12):
        r = owner_session.post(
            f"{base_url}/api/establishments/{est_id}/members",
            json={"email": unique_email(f"rl{i}")},
        )
        last_status = r.status_code
        if r.status_code == 429:
            break

    assert last_status == 429
