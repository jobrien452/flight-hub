from datetime import datetime, timedelta, timezone

from app.models.user import Role, User
from app.security import create_access_token


def headers_for(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(str(user.id), user.role.value)}"}


async def test_a_deleted_users_token_stops_working(client, pilot_user: User):
    headers = headers_for(pilot_user)
    assert (await client.get("/users/me", headers=headers)).status_code == 200

    await pilot_user.delete()

    assert (await client.get("/users/me", headers=headers)).status_code == 401


async def test_a_role_change_lands_without_waiting_for_a_new_token(
    client, pilot_user: User
):
    headers = headers_for(pilot_user)
    # the fleet page is admin only, a pilot's token cannot add a drone
    assert (
        await client.post("/drones", json={"name": "Falcon 1"}, headers=headers)
    ).status_code == 403

    pilot_user.role = Role.ADMIN
    await pilot_user.save()

    assert (
        await client.post("/drones", json={"name": "Falcon 1"}, headers=headers)
    ).status_code == 201


async def test_an_admin_demoted_mid_session_loses_admin_straight_away(
    client, admin_user: User
):
    headers = headers_for(admin_user)
    assert (await client.get("/stats", headers=headers)).status_code == 200

    admin_user.role = Role.PILOT
    await admin_user.save()

    assert (await client.get("/stats", headers=headers)).status_code == 403


async def test_a_password_reset_ends_the_sessions_that_came_before_it(
    client, pilot_user: User
):
    pilot_user.password_hash = "irrelevant"
    pilot_user.password_changed_at = datetime.now(timezone.utc) - timedelta(hours=1)
    pilot_user.reset_token = "reset-tok"
    pilot_user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    await pilot_user.save()
    # a session opened before the reset, which is the one a thief would be holding
    headers = {
        "Authorization": f"Bearer {create_access_token(str(pilot_user.id), pilot_user.role.value, pilot_user.password_changed_at)}"
    }
    assert (await client.get("/users/me", headers=headers)).status_code == 200

    await client.post(
        "/auth/reset-password", json={"token": "reset-tok", "password": "a-new-password"}
    )

    assert (await client.get("/users/me", headers=headers)).status_code == 401


async def test_the_session_the_reset_hands_back_is_fine(client, pilot_user: User):
    pilot_user.invite_token = "invite-tok"
    pilot_user.invite_token_expires_at = datetime.now(timezone.utc) + timedelta(days=1)
    await pilot_user.save()

    claimed = await client.post(
        "/auth/accept-invite", json={"token": "invite-tok", "password": "a-new-password"}
    )

    token = claimed.json()["token"]
    resp = await client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


async def test_signing_in_after_the_reset_works_as_normal(client, pilot_user: User):
    pilot_user.reset_token = "reset-tok"
    pilot_user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    await pilot_user.save()
    await client.post(
        "/auth/reset-password", json={"token": "reset-tok", "password": "a-new-password"}
    )

    signed_in = await client.post(
        "/auth/login", json={"email": pilot_user.email, "password": "a-new-password"}
    )

    assert signed_in.status_code == 200
    resp = await client.get(
        "/users/me", headers={"Authorization": f"Bearer {signed_in.json()['token']}"}
    )
    assert resp.status_code == 200
