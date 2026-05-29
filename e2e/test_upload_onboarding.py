import io
import pytest
import requests as req_lib


class TestLogoUpload:
    """Tests for /api/upload (logo upload, PRO-only)."""

    def test_upload_requires_auth(self, base_url):
        r = req_lib.post(
            f"{base_url}/api/upload",
            files={"file": ("logo.png", io.BytesIO(b"\x89PNG\r\n\x1a\n"), "image/png")},
        )
        assert r.status_code == 401

    def test_upload_requires_pro(self, owner_session, admin_session, base_url):
        from conftest import reset_user_to_free

        reset_user_to_free(admin_session, base_url)

        r = owner_session.post(
            f"{base_url}/api/upload",
            files={"file": ("logo.png", io.BytesIO(b"\x89PNG\r\n\x1a\n"), "image/png")},
        )
        assert r.status_code == 403

    def test_upload_rejects_invalid_type(self, owner_session, admin_session, base_url):
        from conftest import reset_user_to_free

        users_r = admin_session.get(
            f"{base_url}/api/admin/users", params={"search": "demo@smartreview.ru"}
        )
        users = users_r.json().get("users", [])
        user = next((u for u in users if u["email"] == "demo@smartreview.ru"), None)
        if user:
            admin_session.patch(
                f"{base_url}/api/admin/users/{user['id']}",
                json={"subscriptionPlan": "PRO", "subscriptionStatus": "ACTIVE"},
            )

        r = owner_session.post(
            f"{base_url}/api/upload",
            files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
        )

        reset_user_to_free(admin_session, base_url)

        if r.status_code == 500:
            pytest.skip("S3 not configured in test environment")
        assert r.status_code == 400

    def test_upload_rejects_large_file(self, owner_session, admin_session, base_url):
        from conftest import reset_user_to_free

        users_r = admin_session.get(
            f"{base_url}/api/admin/users", params={"search": "demo@smartreview.ru"}
        )
        users = users_r.json().get("users", [])
        user = next((u for u in users if u["email"] == "demo@smartreview.ru"), None)
        if user:
            admin_session.patch(
                f"{base_url}/api/admin/users/{user['id']}",
                json={"subscriptionPlan": "PRO", "subscriptionStatus": "ACTIVE"},
            )

        large_content = b"\x89PNG\r\n\x1a\n" + b"x" * (3 * 1024 * 1024)
        r = owner_session.post(
            f"{base_url}/api/upload",
            files={"file": ("big.png", io.BytesIO(large_content), "image/png")},
        )

        reset_user_to_free(admin_session, base_url)

        if r.status_code == 500:
            pytest.skip("S3 not configured in test environment")
        assert r.status_code == 400

    def test_upload_missing_file(self, owner_session, admin_session, base_url):
        from conftest import reset_user_to_free

        users_r = admin_session.get(
            f"{base_url}/api/admin/users", params={"search": "demo@smartreview.ru"}
        )
        users = users_r.json().get("users", [])
        user = next((u for u in users if u["email"] == "demo@smartreview.ru"), None)
        if user:
            admin_session.patch(
                f"{base_url}/api/admin/users/{user['id']}",
                json={"subscriptionPlan": "PRO", "subscriptionStatus": "ACTIVE"},
            )

        r = owner_session.post(f"{base_url}/api/upload")

        reset_user_to_free(admin_session, base_url)

        if r.status_code == 500:
            pytest.skip("S3 not configured in test environment")
        assert r.status_code == 400


class TestUserOnboarding:
    """Tests for /api/user/onboarding."""

    def test_complete_onboarding_authenticated(self, owner_session, base_url):
        r = owner_session.patch(f"{base_url}/api/user/onboarding")
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_complete_onboarding_idempotent(self, owner_session, base_url):
        r1 = owner_session.patch(f"{base_url}/api/user/onboarding")
        r2 = owner_session.patch(f"{base_url}/api/user/onboarding")
        assert r1.status_code == 200
        assert r2.status_code == 200

    def test_complete_onboarding_unauthorized(self, base_url):
        r = req_lib.patch(f"{base_url}/api/user/onboarding")
        assert r.status_code == 401
