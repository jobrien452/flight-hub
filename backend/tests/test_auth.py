from datetime import datetime, timedelta, timezone

from app.models.user import User
from app.security import hash_password


async def _claimed_user(**overrides) -> User:
    defaults = dict(name="Wanda Willing", email="wanda@flyby-robotics.dev", role="pilot")
    defaults.update(overrides)
    user = User(password_hash=hash_password("correct-horse"), **defaults)
    await user.insert()
    return user


async def test_login_returns_token_for_correct_password(client):
    user = await _claimed_user()
    resp = await client.post(
        "/auth/login", json={"email": user.email, "password": "correct-horse"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["role"] == "pilot"
    assert body["user_id"] == str(user.id)
    assert body["token"]


async def test_login_rejects_wrong_password(client):
    user = await _claimed_user()
    resp = await client.post(
        "/auth/login", json={"email": user.email, "password": "nope"}
    )
    assert resp.status_code == 401


async def test_login_rejects_unknown_email(client):
    resp = await client.post(
        "/auth/login", json={"email": "nobody@flyby-robotics.dev", "password": "whatever"}
    )
    assert resp.status_code == 401


async def test_login_rejects_unclaimed_invite(client):
    # preloaded but hasn't accepted the invite yet, so no password set
    user = User(name="Ivy Invited", email="ivy@flyby-robotics.dev", role="pilot")
    await user.insert()
    resp = await client.post(
        "/auth/login", json={"email": user.email, "password": "anything"}
    )
    assert resp.status_code == 401


async def test_accept_invite_sets_password_and_logs_in(client):
    user = User(
        name="Ivy Invited",
        email="ivy@flyby-robotics.dev",
        role="pilot",
        invite_token="good-token",
        invite_token_expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    await user.insert()

    resp = await client.post(
        "/auth/accept-invite", json={"token": "good-token", "password": "new-pass"}
    )
    assert resp.status_code == 200
    assert resp.json()["token"]

    login = await client.post(
        "/auth/login", json={"email": user.email, "password": "new-pass"}
    )
    assert login.status_code == 200


async def test_accept_invite_rejects_expired_token(client):
    user = User(
        name="Ivy Invited",
        email="ivy@flyby-robotics.dev",
        role="pilot",
        invite_token="stale-token",
        invite_token_expires_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    await user.insert()

    resp = await client.post(
        "/auth/accept-invite", json={"token": "stale-token", "password": "new-pass"}
    )
    assert resp.status_code == 400


async def test_accept_invite_rejects_unknown_token(client):
    resp = await client.post(
        "/auth/accept-invite", json={"token": "made-up", "password": "new-pass"}
    )
    assert resp.status_code == 404


async def test_request_password_reset_emails_known_user(client, monkeypatch):
    user = await _claimed_user()
    sent = {}
    monkeypatch.setattr(
        "app.routers.auth.send_password_reset_email",
        lambda to_email, token: sent.update(to_email=to_email, token=token),
    )

    resp = await client.post("/auth/request-password-reset", json={"email": user.email})
    assert resp.status_code == 200
    assert sent["to_email"] == user.email
    assert sent["token"]


async def test_request_password_reset_is_quiet_about_unknown_email(client, monkeypatch):
    called = []
    monkeypatch.setattr(
        "app.routers.auth.send_password_reset_email",
        lambda to_email, token: called.append(to_email),
    )

    resp = await client.post(
        "/auth/request-password-reset", json={"email": "nobody@flyby-robotics.dev"}
    )
    assert resp.status_code == 200
    assert called == []


async def test_reset_password_sets_new_password(client):
    user = await _claimed_user(
        reset_token="reset-me",
        reset_token_expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )

    resp = await client.post(
        "/auth/reset-password", json={"token": "reset-me", "password": "fresher-pass"}
    )
    assert resp.status_code == 200

    login = await client.post(
        "/auth/login", json={"email": user.email, "password": "fresher-pass"}
    )
    assert login.status_code == 200


async def test_reset_password_rejects_expired_token(client):
    user = await _claimed_user(
        reset_token="stale-reset",
        reset_token_expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )

    resp = await client.post(
        "/auth/reset-password", json={"token": "stale-reset", "password": "fresher-pass"}
    )
    assert resp.status_code == 400
