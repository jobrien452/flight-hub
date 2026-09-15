from app.invites import sync_invites
from app.models.user import User


async def test_sync_invites_emails_users_with_no_password(monkeypatch):
    pending = User(name="Ivy Invited", email="ivy@flyby-robotics.dev", role="pilot")
    await pending.insert()
    claimed = User(
        name="Ada Admin",
        email="ada@flyby-robotics.dev",
        role="admin",
        password_hash="already-set",
    )
    await claimed.insert()

    sent = []
    monkeypatch.setattr(
        "app.invites.send_invite_email", lambda to_email, token: sent.append(to_email)
    )

    count = await sync_invites()

    assert count == 1
    assert sent == [pending.email]

    refreshed = await User.get(pending.id)
    assert refreshed.invite_token
    assert refreshed.invite_token_expires_at is not None


async def test_sync_invites_does_not_raise_when_email_sending_fails(monkeypatch):
    # startup must not crash the whole app just because SMTP isn't configured yet
    first = User(name="Ivy Invited", email="ivy@flyby-robotics.dev", role="pilot")
    await first.insert()
    second = User(name="Owen Onboarding", email="owen@flyby-robotics.dev", role="pilot")
    await second.insert()

    def blow_up(to_email: str, token: str) -> None:
        raise ConnectionRefusedError("smtp not configured")

    monkeypatch.setattr("app.invites.send_invite_email", blow_up)

    count = await sync_invites()

    assert count == 2
    refreshed_first = await User.get(first.id)
    refreshed_second = await User.get(second.id)
    assert refreshed_first.invite_token
    assert refreshed_second.invite_token


async def test_sync_invites_reissues_token_for_still_pending_user(monkeypatch):
    pending = User(
        name="Ivy Invited",
        email="ivy@flyby-robotics.dev",
        role="pilot",
        invite_token="old-token",
    )
    await pending.insert()

    monkeypatch.setattr("app.invites.send_invite_email", lambda to_email, token: None)
    await sync_invites()

    refreshed = await User.get(pending.id)
    assert refreshed.invite_token != "old-token"
