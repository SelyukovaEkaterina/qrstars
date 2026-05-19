import io

import pytest
import requests
import os
import time

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")


@pytest.fixture(scope="session")
def base_url():
    wait_for_app(BASE_URL)
    return BASE_URL


@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    return s


def wait_for_app(url, timeout=120):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(f"{url}/api/auth/csrf", timeout=3)
            if r.status_code == 200:
                return
        except Exception:
            pass
        time.sleep(2)
    raise RuntimeError(f"App not ready at {url} after {timeout}s")


def login(session, base_url, email, password):
    csrf_resp = session.get(f"{base_url}/api/auth/csrf")
    assert csrf_resp.status_code == 200, f"CSRF failed: {csrf_resp.text}"
    csrf_token = csrf_resp.json().get("csrfToken")

    resp = session.post(
        f"{base_url}/api/auth/callback/credentials",
        data={
            "email": email,
            "password": password,
            "csrfToken": csrf_token,
            "json": "true",
        },
        allow_redirects=False,
    )
    assert resp.status_code in (200, 302), f"Login failed: {resp.status_code} {resp.text}"
    return session


@pytest.fixture(scope="session")
def owner_session(http, base_url):
    s = requests.Session()
    login(s, base_url, "demo@smartreview.ru", "demo1234")
    return s


@pytest.fixture(scope="session")
def admin_session(http, base_url):
    s = requests.Session()
    login(s, base_url, "admin@smartreview.ru", "admin1234")
    return s


def upload_test_file_asset(
    session,
    base_url,
    *,
    file_name="menu.pdf",
    content=b"%PDF-1.4 e2e test content",
    mime_type="application/pdf",
    title=None,
    replace_id=None,
):
    """Upload a file to S3 via API; skips test if S3 is unavailable."""
    files = {"file": (file_name, io.BytesIO(content), mime_type)}
    data = {}
    if title:
        data["title"] = title
    if replace_id:
        data["replaceId"] = replace_id
    r = session.post(f"{base_url}/api/file-assets/upload", files=files, data=data or None)
    if r.status_code == 500:
        pytest.skip("S3 not configured in test environment")
    assert r.status_code == 200, f"Upload failed: {r.status_code} {r.text}"
    return r.json()["fileAsset"]


def find_qrcode_by_code(session, base_url, code, establishment_id=None):
    params = {}
    if establishment_id:
        params["establishmentId"] = establishment_id
    list_r = session.get(f"{base_url}/api/qrcodes", params=params)
    assert list_r.status_code == 200
    for qr in list_r.json().get("qrcodes", []):
        if qr["code"] == code:
            return qr
    return None


@pytest.fixture(scope="session")
def owner_establishment_id(owner_session, base_url):
    r = owner_session.get(f"{base_url}/api/establishments")
    assert r.status_code == 200
    data = r.json()
    ests = data.get("establishments", [])
    assert len(ests) > 0, "No seeded establishments found"
    seeded = [e for e in ests if e["reviewsCount"] > 0]
    if seeded:
        return seeded[0]["id"]
    return ests[-1]["id"]
