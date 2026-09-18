from app.models.user import User


async def test_admin_lists_users(client, admin_headers, admin_user: User, pilot_user: User):
    resp = await client.get("/users", headers=admin_headers)
    assert resp.status_code == 200
    emails = {u["email"] for u in resp.json()}
    assert emails == {admin_user.email, pilot_user.email}


async def test_admin_filters_users_by_role(client, admin_headers, admin_user: User, pilot_user: User):
    resp = await client.get("/users?role=pilot", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["email"] == pilot_user.email


async def test_pilot_cannot_list_users(client, pilot_headers):
    resp = await client.get("/users", headers=pilot_headers)
    assert resp.status_code == 403


async def test_list_users_requires_auth(client):
    resp = await client.get("/users")
    assert resp.status_code == 403


async def test_admin_invites_a_user(client, admin_headers, monkeypatch):
    sent = []
    monkeypatch.setattr("app.invites.send_invite_email", lambda to_email, token: sent.append(token))

    resp = await client.post(
        "/users",
        json={"name": "Ivy Invited", "email": "ivy@flyby-robotics.dev", "role": "pilot"},
        headers=admin_headers,
    )

    assert resp.status_code == 201
    body = resp.json()
    assert body["role"] == "pilot"
    assert body["has_password"] is False

    created = await User.find_one(User.email == "ivy@flyby-robotics.dev")
    assert created.invite_token
    assert created.invite_token_expires_at is not None
    assert sent == [created.invite_token]


async def test_admin_adds_a_user_with_a_password(client, admin_headers, monkeypatch):
    sent = []
    monkeypatch.setattr("app.invites.send_invite_email", lambda to_email, token: sent.append(token))

    resp = await client.post(
        "/users",
        json={
            "name": "Pat Pilot",
            "email": "pat@flyby-robotics.dev",
            "role": "pilot",
            "password": "flies-well",
        },
        headers=admin_headers,
    )

    assert resp.status_code == 201
    assert resp.json()["has_password"] is True
    # nothing to claim, so no invite goes out
    assert sent == []

    login = await client.post(
        "/auth/login", json={"email": "pat@flyby-robotics.dev", "password": "flies-well"}
    )
    assert login.status_code == 200


async def test_the_role_comes_from_the_request(client, admin_headers, monkeypatch):
    monkeypatch.setattr("app.invites.send_invite_email", lambda to_email, token: None)

    resp = await client.post(
        "/users",
        json={"name": "Alex Admin", "email": "alex@flyby-robotics.dev", "role": "admin"},
        headers=admin_headers,
    )

    assert resp.status_code == 201
    assert resp.json()["role"] == "admin"


async def test_a_made_up_role_is_refused(client, admin_headers):
    resp = await client.post(
        "/users",
        json={"name": "Nobody", "email": "nobody@flyby-robotics.dev", "role": "owner"},
        headers=admin_headers,
    )

    assert resp.status_code == 422


async def test_an_email_can_only_have_one_account(client, admin_headers, pilot_user: User):
    resp = await client.post(
        "/users",
        json={"name": "Second Go", "email": pilot_user.email, "role": "pilot"},
        headers=admin_headers,
    )

    assert resp.status_code == 409


async def test_the_email_is_stored_lowercase(client, admin_headers, monkeypatch):
    monkeypatch.setattr("app.invites.send_invite_email", lambda to_email, token: None)

    await client.post(
        "/users",
        json={"name": "Shouty", "email": "Shouty@Flyby-Robotics.dev", "role": "pilot"},
        headers=admin_headers,
    )

    assert await User.find_one(User.email == "shouty@flyby-robotics.dev") is not None


async def test_a_new_account_will_not_take_a_throwaway_password(client, admin_headers):
    resp = await client.post(
        "/users",
        json={
            "name": "Pat Pilot",
            "email": "pat@flyby-robotics.dev",
            "role": "pilot",
            "password": "short",
        },
        headers=admin_headers,
    )

    assert resp.status_code == 422


async def test_a_new_account_needs_a_name(client, admin_headers):
    resp = await client.post(
        "/users",
        json={"name": "  ", "email": "blank@flyby-robotics.dev", "role": "pilot"},
        headers=admin_headers,
    )

    assert resp.status_code == 422


async def test_a_pilot_cannot_create_users(client, pilot_headers):
    resp = await client.post(
        "/users",
        json={"name": "Ivy Invited", "email": "ivy@flyby-robotics.dev", "role": "pilot"},
        headers=pilot_headers,
    )

    assert resp.status_code == 403


async def test_a_broken_mailbox_does_not_lose_the_account(client, admin_headers, monkeypatch):
    def blow_up(to_email: str, token: str) -> None:
        raise ConnectionRefusedError("smtp not configured")

    monkeypatch.setattr("app.invites.send_invite_email", blow_up)

    resp = await client.post(
        "/users",
        json={"name": "Ivy Invited", "email": "ivy@flyby-robotics.dev", "role": "pilot"},
        headers=admin_headers,
    )

    assert resp.status_code == 201
    assert await User.find_one(User.email == "ivy@flyby-robotics.dev") is not None


async def test_admins_see_each_other_now_that_they_can_add_each_other(
    client, admin_headers, other_admin_user: User, pilot_user: User
):
    resp = await client.get("/users", headers=admin_headers)

    emails = {u["email"] for u in resp.json()}
    assert other_admin_user.email in emails
    assert pilot_user.email in emails
