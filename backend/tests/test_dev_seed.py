import pytest

from app.config import settings
from app.dev_seed import seed_dev_admin
from app.models.user import Role, User
from app.security import verify_password


@pytest.fixture
def dev_env(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "dev")
    monkeypatch.setattr(settings, "dev_admin_email", "dev@flyby-robotics.dev")
    monkeypatch.setattr(settings, "dev_admin_password", "local-password")
    monkeypatch.setattr(settings, "dev_admin_name", "Dev Admin")


async def test_it_creates_an_admin_that_can_sign_in_right_away(client, dev_env):
    await seed_dev_admin()

    resp = await client.post(
        "/auth/login", json={"email": "dev@flyby-robotics.dev", "password": "local-password"}
    )

    assert resp.status_code == 200
    assert resp.json()["role"] == "admin"


async def test_the_seeded_account_skips_the_invite_entirely(dev_env):
    await seed_dev_admin()

    user = await User.find_one(User.email == "dev@flyby-robotics.dev")
    assert user is not None
    assert user.role == Role.ADMIN
    # no invite token means sync_invites will not try to email this one
    assert user.invite_token is None
    assert user.password_hash is not None


async def test_it_does_nothing_outside_dev(dev_env, monkeypatch):
    monkeypatch.setattr(settings, "app_env", "prod")

    assert await seed_dev_admin() is None
    assert await User.find_one(User.email == "dev@flyby-robotics.dev") is None


async def test_it_does_nothing_without_credentials(dev_env, monkeypatch):
    monkeypatch.setattr(settings, "dev_admin_password", "")

    assert await seed_dev_admin() is None
    assert await User.find_one(User.email == "dev@flyby-robotics.dev") is None


async def test_it_leaves_an_account_that_is_already_there_alone(dev_env):
    await seed_dev_admin()
    first = await User.find_one(User.email == "dev@flyby-robotics.dev")
    original_hash = first.password_hash

    second = await seed_dev_admin()

    assert second is not None
    again = await User.find_one(User.email == "dev@flyby-robotics.dev")
    # restarting the server must not quietly change a password somebody set
    assert again.password_hash == original_hash


async def test_it_does_not_take_over_an_existing_pilot(dev_env):
    await User(name="Pete Pilot", email="dev@flyby-robotics.dev", role=Role.PILOT).insert()

    await seed_dev_admin()

    user = await User.find_one(User.email == "dev@flyby-robotics.dev")
    assert user.role == Role.PILOT


async def test_the_password_is_hashed_not_stored_as_given(dev_env):
    await seed_dev_admin()

    user = await User.find_one(User.email == "dev@flyby-robotics.dev")
    assert user.password_hash != "local-password"
    assert verify_password("local-password", user.password_hash)
