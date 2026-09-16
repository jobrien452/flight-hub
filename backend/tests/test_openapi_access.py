async def test_the_spec_is_not_public(client):
    resp = await client.get("/openapi.json")
    assert resp.status_code == 403


async def test_a_pilot_cannot_read_the_spec(client, pilot_headers):
    resp = await client.get("/openapi.json", headers=pilot_headers)
    assert resp.status_code == 403


async def test_an_admin_can_read_the_spec(client, admin_headers):
    resp = await client.get("/openapi.json", headers=admin_headers)

    assert resp.status_code == 200
    spec = resp.json()
    assert spec["info"]["title"] == "Flyby Mission Planner"


async def test_the_spec_covers_the_documented_routes(client, admin_headers):
    spec = (await client.get("/openapi.json", headers=admin_headers)).json()

    for path in [
        "/missions",
        "/missions/{mission_id}/publish",
        "/missions/{mission_id}/assignments",
        "/missions/{mission_id}/reports",
        "/missions/{mission_id}/acknowledge",
        "/missions/{mission_id}/start",
        "/me/missions",
        "/me/reports",
        "/users",
        "/users/me",
    ]:
        assert path in spec["paths"], f"{path} missing from the spec"


async def test_credential_routes_stay_out_of_the_spec(client, admin_headers):
    # nothing here works with an api token, so documenting it only misleads
    spec = (await client.get("/openapi.json", headers=admin_headers)).json()

    for path in spec["paths"]:
        assert not path.startswith("/auth"), f"{path} should not be documented"
        assert not path.startswith("/api-tokens"), f"{path} should not be documented"


async def test_the_builtin_docs_pages_are_gone(client, admin_headers):
    # swagger is served by the frontend, which can send the admin's bearer token
    assert (await client.get("/docs", headers=admin_headers)).status_code == 404
    assert (await client.get("/redoc", headers=admin_headers)).status_code == 404
