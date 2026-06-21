import uuid

import requests as req_lib

from conftest import login


def unique_email(prefix="afn"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@e2e.qrstars.ru"


class TestAdminFunnel:
    def test_get_funnel(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/funnel")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "range" in data
        assert "summary" in data
        assert "funnel" in data
        assert "users" in data
        assert isinstance(data["funnel"], list)
        assert len(data["funnel"]) >= 5

    def test_funnel_with_date_params(self, admin_session, base_url):
        r = admin_session.get(
            f"{base_url}/api/admin/funnel",
            params={"from": "2026-06-01", "to": "2026-06-05"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["range"]["from"] == "2026-06-01"
        assert data["range"]["to"] == "2026-06-05"

    def test_funnel_invalid_range(self, admin_session, base_url):
        r = admin_session.get(
            f"{base_url}/api/admin/funnel",
            params={"from": "2026-06-10", "to": "2026-06-01"},
        )
        assert r.status_code == 400

    def test_funnel_forbidden_for_owner(self, owner_session, base_url):
        r = owner_session.get(f"{base_url}/api/admin/funnel")
        assert r.status_code == 403

    def test_funnel_unauthenticated(self, base_url):
        r = req_lib.Session().get(f"{base_url}/api/admin/funnel")
        assert r.status_code == 401

    def test_funnel_reflects_setup_events(self, admin_session, base_url):
        email = unique_email()
        password = "secure123"
        req_lib.post(
            f"{base_url}/api/auth/register",
            json={"email": email, "password": password, "name": "Funnel User", "consentPd": True},
        )
        session = req_lib.Session()
        login(session, base_url, email, password)

        session.post(f"{base_url}/api/events", json={"event": "setup.intent_viewed"})
        session.post(
            f"{base_url}/api/events",
            json={"event": "setup.intent_selected", "props": {"intent": "redirect"}},
        )
        session.post(
            f"{base_url}/api/events",
            json={"event": "setup.form_submitted", "props": {"intent": "redirect"}},
        )
        qs = session.post(
            f"{base_url}/api/setup/quick-start",
            json={"intent": "redirect", "redirectUrl": "https://example.com/funnel"},
        )
        assert qs.status_code == 200, qs.text
        qr_id = qs.json()["qrcode"]["id"]
        session.post(
            f"{base_url}/api/events",
            json={
                "event": "setup.completed",
                "props": {"intent": "redirect", "qrCodeId": qr_id},
            },
        )

        r = admin_session.get(f"{base_url}/api/admin/funnel")
        assert r.status_code == 200, r.text
        data = r.json()
        user_row = next((u for u in data["users"] if u["email"] == email), None)
        assert user_row is not None
        assert user_row["intent"] == "redirect"
        assert user_row["steps"]["completed"] is True
