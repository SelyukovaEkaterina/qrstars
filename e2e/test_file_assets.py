import io
import os

import pytest
import requests

from conftest import upload_test_file_asset


def test_file_upload_requires_auth(base_url):
    r = requests.post(f"{base_url}/api/file-assets/upload")
    assert r.status_code == 401


def test_file_upload_rejects_large_file(owner_session, base_url):
    big = b"x" * (26 * 1024 * 1024)
    files = {"file": ("big.pdf", io.BytesIO(big), "application/pdf")}
    r = owner_session.post(f"{base_url}/api/file-assets/upload", files=files)
    assert r.status_code == 400
    assert "25" in r.json().get("error", "")


def test_file_upload_accepts_arbitrary_type(owner_session, base_url):
    files = {"file": ("archive.zip", io.BytesIO(b"PK\x03\x04test"), "application/zip")}
    r = owner_session.post(f"{base_url}/api/file-assets/upload", files=files)
    if r.status_code == 500:
        pytest.skip("S3 not configured in test environment")
    assert r.status_code == 200
    assert r.json()["fileAsset"]["fileName"] == "archive.zip"


def test_file_upload_rejects_empty_file(owner_session, base_url):
    files = {"file": ("empty.txt", io.BytesIO(b""), "text/plain")}
    r = owner_session.post(f"{base_url}/api/file-assets/upload", files=files)
    assert r.status_code == 400


def test_file_upload_replace_keeps_same_id(owner_session, base_url):
    first = upload_test_file_asset(
        owner_session, base_url, file_name="v1.pdf", title="Версия 1"
    )

    files = {"file": ("v2.pdf", io.BytesIO(b"%PDF-1.4 v2"), "application/pdf")}
    data = {"replaceId": first["id"], "title": "Версия 2"}
    r = owner_session.post(
        f"{base_url}/api/file-assets/upload", files=files, data=data
    )
    if r.status_code == 500:
        pytest.skip("S3 not configured in test environment")
    assert r.status_code == 200
    updated = r.json()["fileAsset"]
    assert updated["id"] == first["id"]
    assert updated["fileName"] == "v2.pdf"
    assert updated["title"] == "Версия 2"


def _fetch_stored_file(session, base_url, file_asset):
    # В проде /storage проксирует nginx; в тестах ходим в S3 напрямую (S3_PUBLIC_BASE).
    storage_base = os.environ.get("S3_PUBLIC_BASE")
    if storage_base and file_asset.get("fileKey"):
        url = f"{storage_base.rstrip('/')}/{file_asset['fileKey']}"
    else:
        url = file_asset["fileUrl"]
        if url.startswith("/"):
            url = f"{base_url}{url}"
    r = requests.get(url)
    if r.status_code != 200:
        pytest.skip(f"S3 storage is not reachable in test environment ({r.status_code})")
    return r


def test_upload_detects_mime_by_extension(owner_session, base_url):
    file_asset = upload_test_file_asset(
        owner_session,
        base_url,
        file_name="photo.png",
        content=b"\x89PNG\r\n\x1a\n fake",
        mime_type="application/octet-stream",
    )
    assert file_asset["mimeType"] == "image/png"


def test_image_is_served_inline(owner_session, base_url):
    file_asset = upload_test_file_asset(
        owner_session,
        base_url,
        file_name="inline.png",
        content=b"\x89PNG\r\n\x1a\n fake",
        mime_type="image/png",
    )
    r = _fetch_stored_file(owner_session, base_url, file_asset)
    assert r.headers.get("Content-Type", "").startswith("image/png")
    assert r.headers.get("Content-Disposition", "").startswith("inline")


def test_text_is_served_inline(owner_session, base_url):
    file_asset = upload_test_file_asset(
        owner_session,
        base_url,
        file_name="notes.txt",
        content=b"hello e2e",
        mime_type="text/plain",
    )
    r = _fetch_stored_file(owner_session, base_url, file_asset)
    assert r.headers.get("Content-Disposition", "").startswith("inline")


def test_html_is_served_as_attachment(owner_session, base_url):
    file_asset = upload_test_file_asset(
        owner_session,
        base_url,
        file_name="page.html",
        content=b"<script>alert(1)</script>",
        mime_type="text/html",
    )
    r = _fetch_stored_file(owner_session, base_url, file_asset)
    assert r.headers.get("Content-Disposition", "").startswith("attachment")


def test_archive_is_served_as_attachment(owner_session, base_url):
    file_asset = upload_test_file_asset(
        owner_session,
        base_url,
        file_name="archive.zip",
        content=b"PK\x03\x04test",
        mime_type="application/zip",
    )
    r = _fetch_stored_file(owner_session, base_url, file_asset)
    assert r.headers.get("Content-Disposition", "").startswith("attachment")


def test_cyrillic_file_name_in_disposition(owner_session, base_url):
    file_asset = upload_test_file_asset(
        owner_session,
        base_url,
        file_name="Меню.pdf",
        content=b"%PDF-1.4 cyrillic",
        mime_type="application/pdf",
    )
    r = _fetch_stored_file(owner_session, base_url, file_asset)
    disposition = r.headers.get("Content-Disposition", "")
    assert disposition.startswith("inline")
    assert "filename*=UTF-8''" in disposition


def test_file_delete(owner_session, base_url):
    file_asset = upload_test_file_asset(owner_session, base_url, file_name="temp.pdf")
    file_id = file_asset["id"]

    del_r = owner_session.delete(f"{base_url}/api/file-assets?id={file_id}")
    assert del_r.status_code == 200

    del_r2 = owner_session.delete(f"{base_url}/api/file-assets?id={file_id}")
    assert del_r2.status_code == 404


def test_file_delete_requires_owner(owner_session, base_url, admin_session):
    file_asset = upload_test_file_asset(owner_session, base_url, file_name="owner-only.pdf")

    del_r = admin_session.delete(f"{base_url}/api/file-assets?id={file_asset['id']}")
    assert del_r.status_code in (403, 404)
