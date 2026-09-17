"""E2E: project-first dashboard redirects keep old bookmarks working."""


def test_legacy_my_page_redirects_to_project_microsite(
    owner_session, base_url, owner_establishment_id
):
    r = owner_session.get(
        f"{base_url}/dashboard/my-page",
        params={"estId": owner_establishment_id, "tab": "review"},
        allow_redirects=False,
    )
    assert r.status_code in (301, 302, 303, 307, 308), r.text
    location = r.headers.get("Location", "")
    assert f"/dashboard/projects/{owner_establishment_id}/page" in location
    assert "tab=review" in location


def test_legacy_qrcodes_redirect_to_project(
    owner_session, base_url, owner_establishment_id
):
    r = owner_session.get(
        f"{base_url}/dashboard/qrcodes",
        params={"estId": owner_establishment_id},
        allow_redirects=False,
    )
    assert r.status_code in (301, 302, 303, 307, 308), r.text
    assert (
        f"/dashboard/projects/{owner_establishment_id}/qrcodes"
        in r.headers.get("Location", "")
    )


def test_legacy_establishments_redirect_to_projects_list(owner_session, base_url):
    r = owner_session.get(
        f"{base_url}/dashboard/establishments",
        allow_redirects=False,
    )
    assert r.status_code in (301, 302, 303, 307, 308), r.text
    assert r.headers.get("Location", "").endswith("/dashboard/projects")


def test_legacy_reviews_redirect_to_inbox(
    owner_session, base_url, owner_establishment_id
):
    r = owner_session.get(
        f"{base_url}/dashboard/reviews",
        allow_redirects=False,
    )
    assert r.status_code in (301, 302, 303, 307, 308), r.text
    location = r.headers.get("Location", "")
    assert "/dashboard/projects/" in location
    assert "/inbox" in location


def test_project_hub_is_reachable(owner_session, base_url, owner_establishment_id):
    r = owner_session.get(
        f"{base_url}/dashboard/projects/{owner_establishment_id}",
        allow_redirects=True,
    )
    assert r.status_code == 200
    assert "QR-код" in r.text or "Микросайт" in r.text or "проект" in r.text.lower()
