from app.config import settings


async def test_a_signed_in_admin_gets_the_map_token(client, admin_headers, monkeypatch):
    monkeypatch.setattr(settings, "mapbox_token", "pk.test-token")

    resp = await client.get("/config/map-token", headers=admin_headers)

    assert resp.status_code == 200
    assert resp.json()["token"] == "pk.test-token"


async def test_a_pilot_gets_it_too(client, pilot_headers, monkeypatch):
    # pilots look at the same maps, this is not an admin only route
    monkeypatch.setattr(settings, "mapbox_token", "pk.test-token")

    resp = await client.get("/config/map-token", headers=pilot_headers)

    assert resp.status_code == 200
    assert resp.json()["token"] == "pk.test-token"


async def test_nobody_gets_it_without_signing_in(client, monkeypatch):
    monkeypatch.setattr(settings, "mapbox_token", "pk.test-token")

    resp = await client.get("/config/map-token")

    assert resp.status_code == 403


async def test_an_unconfigured_server_says_so_rather_than_handing_back_nothing(
    client, admin_headers, monkeypatch
):
    monkeypatch.setattr(settings, "mapbox_token", "")

    resp = await client.get("/config/map-token", headers=admin_headers)

    assert resp.status_code == 503
