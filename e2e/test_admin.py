import pytest
import requests as req_lib


class TestAdminStats:
    def test_get_stats(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/stats")
        assert r.status_code == 200
        data = r.json()
        assert "totalUsers" in data
        assert "totalEstablishments" in data
        assert "totalReviews" in data
        assert "totalQRCodes" in data
        assert "activeSubscriptions" in data
        assert "negativeReviews" in data
        assert isinstance(data["totalUsers"], int)
        assert data["totalUsers"] >= 2

    def test_stats_forbidden_for_owner(self, owner_session, base_url):
        r = owner_session.get(f"{base_url}/api/admin/stats")
        assert r.status_code == 403

    def test_stats_unauthenticated(self, base_url):
        r = req_lib.Session().get(f"{base_url}/api/admin/stats")
        assert r.status_code == 401


class TestAdminUsers:
    def test_list_users(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/users")
        assert r.status_code == 200
        data = r.json()
        assert "users" in data
        assert "total" in data
        assert data["total"] >= 2

    def test_search_users(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/users", params={"search": "demo"})
        assert r.status_code == 200
        data = r.json()
        assert len(data["users"]) >= 1
        assert "demo" in data["users"][0]["email"].lower()

    def test_users_pagination(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/users", params={"page": "1", "limit": "1"})
        assert r.status_code == 200
        data = r.json()
        assert len(data["users"]) <= 1
        assert data["pages"] >= 1

    def test_users_forbidden_for_owner(self, owner_session, base_url):
        r = owner_session.get(f"{base_url}/api/admin/users")
        assert r.status_code == 403


class TestAdminUserById:
    def test_update_user_role(self, admin_session, base_url):
        r_list = admin_session.get(f"{base_url}/api/admin/users", params={"search": "demo"})
        user_id = r_list.json()["users"][0]["id"]

        r = admin_session.patch(
            f"{base_url}/api/admin/users/{user_id}",
            json={"role": "OWNER"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "OWNER"

    def test_update_user_subscription(self, admin_session, base_url):
        r_list = admin_session.get(f"{base_url}/api/admin/users", params={"search": "demo"})
        user_id = r_list.json()["users"][0]["id"]

        r = admin_session.patch(
            f"{base_url}/api/admin/users/{user_id}",
            json={"subscriptionPlan": "PRO", "subscriptionStatus": "ACTIVE"},
        )
        assert r.status_code == 200
        sub = r.json()["user"]["subscriptions"][0]
        assert sub["plan"] == "PRO"

        admin_session.patch(
            f"{base_url}/api/admin/users/{user_id}",
            json={"subscriptionPlan": "FREE", "subscriptionStatus": "ACTIVE"},
        )

    def test_update_nonexistent_user(self, admin_session, base_url):
        r = admin_session.patch(
            f"{base_url}/api/admin/users/nonexistent",
            json={"role": "OWNER"},
        )
        assert r.status_code == 404


class TestAdminReviews:
    def test_list_reviews(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/reviews")
        assert r.status_code == 200
        data = r.json()
        assert "reviews" in data
        assert "total" in data
        assert data["total"] >= 0

    def test_filter_negative_reviews(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/reviews", params={"negative": "true"})
        assert r.status_code == 200
        for rev in r.json()["reviews"]:
            assert rev["isNegative"] is True

    def test_filter_positive_reviews(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/reviews", params={"negative": "false"})
        assert r.status_code == 200
        for rev in r.json()["reviews"]:
            assert rev["isNegative"] is False

    def test_filter_by_rating(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/reviews", params={"rating": "5"})
        assert r.status_code == 200
        for rev in r.json()["reviews"]:
            assert rev["rating"] == 5

    def test_reviews_pagination(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/reviews", params={"page": "1", "limit": "5"})
        assert r.status_code == 200
        data = r.json()
        assert len(data["reviews"]) <= 5

    def test_reviews_forbidden_for_owner(self, owner_session, base_url):
        r = owner_session.get(f"{base_url}/api/admin/reviews")
        assert r.status_code == 403


class TestAdminEstablishments:
    def test_list_establishments(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/establishments")
        assert r.status_code == 200
        data = r.json()
        assert "establishments" in data
        assert len(data["establishments"]) >= 1

        est = data["establishments"][0]
        assert "user" in est
        assert "totalScans" in est
        assert "_count" in est

    def test_establishments_forbidden_for_owner(self, owner_session, base_url):
        r = owner_session.get(f"{base_url}/api/admin/establishments")
        assert r.status_code == 403


class TestAdminPayments:
    def test_list_payments(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/payments")
        assert r.status_code == 200
        data = r.json()
        assert "subscriptions" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data

    def test_payments_pagination(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/payments", params={"page": "1", "limit": "10"})
        assert r.status_code == 200
        data = r.json()
        assert len(data["subscriptions"]) <= 10

    def test_payments_forbidden_for_owner(self, owner_session, base_url):
        r = owner_session.get(f"{base_url}/api/admin/payments")
        assert r.status_code == 403


class TestAdminGenerateCodes:
    def test_generate_codes(self, admin_session, base_url):
        r = admin_session.post(
            f"{base_url}/api/admin/generate-codes",
            json={"count": 3},
        )
        assert r.status_code == 200
        data = r.json()
        assert "codes" in data
        assert len(data["codes"]) == 3

    def test_generate_codes_with_prefix(self, admin_session, base_url):
        r = admin_session.post(
            f"{base_url}/api/admin/generate-codes",
            json={"count": 2, "prefix": "test-"},
        )
        assert r.status_code == 200
        data = r.json()
        for code_obj in data["codes"]:
            assert code_obj["code"].startswith("test-")

    def test_generate_too_many_codes(self, admin_session, base_url):
        r = admin_session.post(
            f"{base_url}/api/admin/generate-codes",
            json={"count": 200},
        )
        assert r.status_code == 400

    def test_generate_codes_requires_auth(self, base_url):
        r = req_lib.Session().post(
            f"{base_url}/api/admin/generate-codes",
            json={"count": 1},
        )
        assert r.status_code == 401


class TestAdminLoginAs:
    def test_login_as_user(self, admin_session, base_url):
        r_list = admin_session.get(f"{base_url}/api/admin/users", params={"search": "demo"})
        user_id = r_list.json()["users"][0]["id"]

        r = admin_session.post(
            f"{base_url}/api/admin/login-as",
            json={"userId": user_id},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["id"] == user_id
        assert data["user"]["email"] == "demo@smartreview.ru"

    def test_login_as_nonexistent(self, admin_session, base_url):
        r = admin_session.post(
            f"{base_url}/api/admin/login-as",
            json={"userId": "nonexistent"},
        )
        assert r.status_code == 404

    def test_login_as_missing_user_id(self, admin_session, base_url):
        r = admin_session.post(f"{base_url}/api/admin/login-as", json={})
        assert r.status_code == 400

    def test_login_as_forbidden_for_owner(self, owner_session, base_url):
        r = owner_session.post(
            f"{base_url}/api/admin/login-as",
            json={"userId": "someid"},
        )
        assert r.status_code == 403
