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
