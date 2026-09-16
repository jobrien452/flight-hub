from app.models.user import User


async def create_token(client, headers, name="CI pipeline"):
    resp = await client.post("/api-tokens", json={"name": name}, headers=headers)
    assert resp.status_code == 201
    return resp.json()


async def test_creating_a_token_returns_the_secret_once(client, admin_headers):
    body = await create_token(client, admin_headers)

    assert body["name"] == "CI pipeline"
    assert body["token"].startswith("flyby_")
    assert body["prefix"] in body["token"]


async def test_listing_tokens_never_returns_the_secret(client, admin_headers):
    created = await create_token(client, admin_headers)

    resp = await client.get("/api-tokens", headers=admin_headers)
    assert resp.status_code == 200
    listed = resp.json()
    assert len(listed) == 1
    assert listed[0]["id"] == created["id"]
    assert listed[0]["prefix"] == created["prefix"]
    assert "token" not in listed[0]


async def test_the_secret_is_not_stored_in_the_clear(client, admin_headers):
    from app.models.api_token import ApiToken

    created = await create_token(client, admin_headers)

    stored = await ApiToken.find_one(ApiToken.prefix == created["prefix"])
    assert stored is not None
    assert created["token"] not in stored.token_hash


async def test_an_api_token_can_call_the_api(client, admin_headers, assigned_mission):
    created = await create_token(client, admin_headers)

    resp = await client.get(
        "/missions", headers={"Authorization": f"Bearer {created['token']}"}
    )
    assert resp.status_code == 200


async def test_an_api_token_carries_its_owners_role(client, pilot_headers, unassigned_mission):
    created = await create_token(client, pilot_headers)

    # a pilot's token must not be able to do admin things
    resp = await client.post(
        "/missions",
        json={"name": "Nope"},
        headers={"Authorization": f"Bearer {created['token']}"},
    )
    assert resp.status_code == 403


async def test_a_revoked_token_stops_working(client, admin_headers):
    created = await create_token(client, admin_headers)
    auth = {"Authorization": f"Bearer {created['token']}"}
    assert (await client.get("/missions", headers=auth)).status_code == 200

    revoked = await client.delete(f"/api-tokens/{created['id']}", headers=admin_headers)
    assert revoked.status_code == 204

    assert (await client.get("/missions", headers=auth)).status_code == 401


async def test_a_made_up_token_is_rejected(client):
    resp = await client.get("/missions", headers={"Authorization": "Bearer flyby_nonsense"})
    assert resp.status_code == 401


async def test_tokens_are_private_to_their_owner(client, admin_headers, pilot_headers):
    await create_token(client, admin_headers, name="admin token")

    resp = await client.get("/api-tokens", headers=pilot_headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_cannot_revoke_somebody_elses_token(client, admin_headers, pilot_headers):
    created = await create_token(client, admin_headers)

    resp = await client.delete(f"/api-tokens/{created['id']}", headers=pilot_headers)
    assert resp.status_code == 404


async def test_an_api_token_cannot_mint_more_tokens(client, admin_headers):
    created = await create_token(client, admin_headers)

    resp = await client.post(
        "/api-tokens",
        json={"name": "escalation"},
        headers={"Authorization": f"Bearer {created['token']}"},
    )
    assert resp.status_code == 403


async def test_an_api_token_cannot_revoke_tokens(client, admin_headers):
    created = await create_token(client, admin_headers)

    resp = await client.delete(
        f"/api-tokens/{created['id']}",
        headers={"Authorization": f"Bearer {created['token']}"},
    )
    assert resp.status_code == 403


async def test_using_a_token_records_when_it_was_last_used(client, admin_headers):
    created = await create_token(client, admin_headers)
    assert created["last_used_at"] is None

    await client.get("/missions", headers={"Authorization": f"Bearer {created['token']}"})

    listed = await client.get("/api-tokens", headers=admin_headers)
    assert listed.json()[0]["last_used_at"] is not None


async def test_tokens_need_authentication(client):
    assert (await client.get("/api-tokens")).status_code == 403


async def test_me_returns_the_signed_in_user(client, admin_headers, admin_user: User):
    resp = await client.get("/users/me", headers=admin_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == admin_user.email
    assert body["role"] == "admin"
    assert body["id"] == str(admin_user.id)


async def test_a_pilot_can_see_their_own_profile(client, pilot_headers):
    resp = await client.get("/users/me", headers=pilot_headers)

    assert resp.status_code == 200
    assert resp.json()["role"] == "pilot"
