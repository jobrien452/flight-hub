from app.models.user import User


async def test_login_returns_token_for_existing_user(client, admin_user: User):
    resp = await client.post("/auth/login", json={"name": admin_user.name})
    assert resp.status_code == 200
    body = resp.json()
    assert body["role"] == "admin"
    assert body["user_id"] == str(admin_user.id)
    assert body["token"]


async def test_login_unknown_user_returns_404(client):
    resp = await client.post("/auth/login", json={"name": "nobody"})
    assert resp.status_code == 404
