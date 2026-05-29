import pytest
import requests as req_lib


class TestAdminBatches:
    def test_create_batch(self, admin_session, base_url):
        r = admin_session.post(
            f"{base_url}/api/admin/batches",
            json={"qty": 3, "label": "E2E Test Batch"},
        )
        assert r.status_code == 200
        data = r.json()
        assert "batch" in data
        assert "qrcodes" in data
        assert data["batch"]["qty"] == 3
        assert data["batch"]["label"] == "E2E Test Batch"
        assert len(data["qrcodes"]) == 3
        assert "masterCode" in data["batch"]

    def test_create_batch_minimal(self, admin_session, base_url):
        r = admin_session.post(
            f"{base_url}/api/admin/batches",
            json={"qty": 1},
        )
        assert r.status_code == 200
        data = r.json()
        assert len(data["qrcodes"]) == 1

    def test_create_batch_invalid_qty_zero(self, admin_session, base_url):
        r = admin_session.post(
            f"{base_url}/api/admin/batches",
            json={"qty": 0},
        )
        assert r.status_code == 400

    def test_create_batch_invalid_qty_too_large(self, admin_session, base_url):
        r = admin_session.post(
            f"{base_url}/api/admin/batches",
            json={"qty": 101},
        )
        assert r.status_code == 400

    def test_create_batch_requires_admin(self, owner_session, base_url):
        r = owner_session.post(
            f"{base_url}/api/admin/batches",
            json={"qty": 1},
        )
        assert r.status_code == 403

    def test_create_batch_requires_auth(self, base_url):
        r = req_lib.post(
            f"{base_url}/api/admin/batches",
            json={"qty": 1},
        )
        assert r.status_code == 401

    def test_list_batches(self, admin_session, base_url):
        admin_session.post(
            f"{base_url}/api/admin/batches",
            json={"qty": 2, "label": "List Test"},
        )

        r = admin_session.get(f"{base_url}/api/admin/batches")
        assert r.status_code == 200
        data = r.json()
        assert "batches" in data
        assert isinstance(data["batches"], list)
        assert len(data["batches"]) >= 1

    def test_list_batches_includes_qrcodes(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/batches")
        batches = r.json()["batches"]
        batch = batches[0]
        assert "qrcodes" in batch
        assert isinstance(batch["qrcodes"], list)

    def test_list_batches_requires_admin(self, owner_session, base_url):
        r = owner_session.get(f"{base_url}/api/admin/batches")
        assert r.status_code == 403

    def test_get_batch_by_id(self, admin_session, base_url):
        create_r = admin_session.post(
            f"{base_url}/api/admin/batches",
            json={"qty": 2, "label": "Get By ID Test"},
        )
        batch_id = create_r.json()["batch"]["id"]

        r = admin_session.get(f"{base_url}/api/admin/batches/{batch_id}")
        assert r.status_code == 200
        data = r.json()
        assert "batch" in data
        assert data["batch"]["id"] == batch_id
        assert len(data["batch"]["qrcodes"]) == 2

    def test_get_batch_not_found(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/batches/nonexistent")
        assert r.status_code == 404

    def test_batch_qrcodes_have_serial_codes(self, admin_session, base_url):
        create_r = admin_session.post(
            f"{base_url}/api/admin/batches",
            json={"qty": 3},
        )
        qrcodes = create_r.json()["qrcodes"]
        serial_codes = [qr["serialCode"] for qr in qrcodes]
        assert len(set(serial_codes)) == 3

    def test_batch_qrcodes_are_inactive(self, admin_session, base_url):
        create_r = admin_session.post(
            f"{base_url}/api/admin/batches",
            json={"qty": 2},
        )
        qrcodes = create_r.json()["qrcodes"]
        for qr in qrcodes:
            assert qr["isActive"] is False


class TestActivateBatch:
    def test_get_batch_by_master_code(self, admin_session, base_url):
        create_r = admin_session.post(
            f"{base_url}/api/admin/batches",
            json={"qty": 2, "label": "Activation Test"},
        )
        master_code = create_r.json()["batch"]["masterCode"]

        r = req_lib.get(
            f"{base_url}/api/activate-batch",
            params={"masterCode": master_code},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["masterCode"] == master_code
        assert data["qty"] == 2
        assert len(data["tablets"]) == 2

    def test_get_batch_missing_master_code(self, base_url):
        r = req_lib.get(f"{base_url}/api/activate-batch")
        assert r.status_code == 400

    def test_get_batch_invalid_master_code(self, base_url):
        r = req_lib.get(
            f"{base_url}/api/activate-batch",
            params={"masterCode": "INVALID-CODE-XYZ"},
        )
        assert r.status_code == 404

    def test_activate_batch_new_user(self, admin_session, base_url):
        import uuid

        create_r = admin_session.post(
            f"{base_url}/api/admin/batches",
            json={"qty": 2, "label": "Full Activation Test"},
        )
        master_code = create_r.json()["batch"]["masterCode"]
        email = f"batch-e2e-{uuid.uuid4().hex[:6]}@test.example.com"

        r = req_lib.post(
            f"{base_url}/api/activate-batch",
            json={
                "masterCode": master_code,
                "establishmentName": "E2E Batch Cafe",
                "email": email,
                "password": "testpass123",
                "ownerName": "Batch Owner",
                "yandexMapsUrl": "https://yandex.ru/maps/org/test",
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert "establishmentId" in data
        assert data["tabletCount"] == 2

    def test_activate_batch_already_activated(self, admin_session, base_url):
        import uuid

        create_r = admin_session.post(
            f"{base_url}/api/admin/batches",
            json={"qty": 1},
        )
        master_code = create_r.json()["batch"]["masterCode"]

        req_lib.post(
            f"{base_url}/api/activate-batch",
            json={
                "masterCode": master_code,
                "establishmentName": "First Activation",
                "email": f"first-{uuid.uuid4().hex[:6]}@test.example.com",
                "password": "testpass123",
            },
        )

        r = req_lib.post(
            f"{base_url}/api/activate-batch",
            json={
                "masterCode": master_code,
                "establishmentName": "Second Activation",
                "email": f"second-{uuid.uuid4().hex[:6]}@test.example.com",
                "password": "testpass123",
            },
        )
        assert r.status_code == 400

    def test_activate_batch_missing_master_code(self, base_url):
        r = req_lib.post(
            f"{base_url}/api/activate-batch",
            json={"establishmentName": "Test", "email": "t@t.com"},
        )
        assert r.status_code == 400

    def test_activate_batch_invalid_master_code(self, base_url):
        r = req_lib.post(
            f"{base_url}/api/activate-batch",
            json={
                "masterCode": "INVALID-XYZ",
                "establishmentName": "Test",
                "email": "t@t.com",
            },
        )
        assert r.status_code == 404


class TestAdminPartnerWithdrawals:
    def test_list_withdrawals(self, admin_session, base_url):
        r = admin_session.get(f"{base_url}/api/admin/partner-withdrawals")
        assert r.status_code == 200
        data = r.json()
        assert "withdrawals" in data
        assert "total" in data
        assert "pages" in data
        assert "pendingCount" in data

    def test_list_withdrawals_filter_by_status(self, admin_session, base_url):
        r = admin_session.get(
            f"{base_url}/api/admin/partner-withdrawals",
            params={"status": "PENDING"},
        )
        assert r.status_code == 200
        for w in r.json()["withdrawals"]:
            assert w["status"] == "PENDING"

    def test_list_withdrawals_requires_admin(self, owner_session, base_url):
        r = owner_session.get(f"{base_url}/api/admin/partner-withdrawals")
        assert r.status_code == 403

    def test_list_withdrawals_requires_auth(self, base_url):
        r = req_lib.get(f"{base_url}/api/admin/partner-withdrawals")
        assert r.status_code == 401

    def test_update_withdrawal_invalid_status(self, admin_session, base_url):
        r = admin_session.patch(
            f"{base_url}/api/admin/partner-withdrawals",
            json={"id": "some-id", "status": "INVALID_STATUS"},
        )
        assert r.status_code == 400

    def test_update_withdrawal_missing_fields(self, admin_session, base_url):
        r = admin_session.patch(
            f"{base_url}/api/admin/partner-withdrawals",
            json={"id": "some-id"},
        )
        assert r.status_code == 400
