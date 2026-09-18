"""Things the sweep turned up. Each one failed before the fix that follows it."""

from app.models.drone import Drone
from app.models.mission import Mission, MissionStatus
from app.models.user import Role, User


async def a_drone(admin: User) -> Drone:
    drone = Drone(name="Falcon 1", owner_id=str(admin.id))
    await drone.insert()
    return drone


async def test_editing_a_submitted_report_does_not_bank_the_hours_twice(
    client, pilot_headers, admin_user: User, pilot_user: User
):
    drone = await a_drone(admin_user)
    mission = Mission(
        name="Survey Site A",
        owner_id=str(admin_user.id),
        assigned_pilot_ids=[str(pilot_user.id)],
        status=MissionStatus.IN_FLIGHT,
        drone_id=str(drone.id),
    )
    await mission.insert()

    created = await client.post(
        f"/missions/{mission.id}/reports",
        json={"status": "submitted", "data": {"duration_minutes": 60}},
        headers=pilot_headers,
    )
    report_id = created.json()["id"]

    # the pilot goes back and fixes a typo in the notes, the flight is the same flight
    await client.patch(
        f"/missions/{mission.id}/reports/{report_id}",
        json={"notes": "clear skies"},
        headers=pilot_headers,
    )

    assert (await Drone.get(drone.id)).flight_hours == 1.0


async def test_a_mission_only_takes_real_pilots(client, admin_headers, admin_user: User):
    mission = Mission(name="Survey Site A", owner_id=str(admin_user.id))
    await mission.insert()

    resp = await client.patch(
        f"/missions/{mission.id}",
        json={"assigned_pilot_ids": ["not-an-id"]},
        headers=admin_headers,
    )

    assert resp.status_code == 404
    assert (await Mission.get(mission.id)).assigned_pilot_ids == []


async def test_a_mission_will_not_take_an_admin_as_a_pilot(
    client, admin_headers, admin_user: User, other_admin_user: User
):
    mission = Mission(name="Survey Site A", owner_id=str(admin_user.id))
    await mission.insert()

    resp = await client.patch(
        f"/missions/{mission.id}",
        json={"assigned_pilot_ids": [str(other_admin_user.id)]},
        headers=admin_headers,
    )

    assert resp.status_code == 400


async def test_a_real_pilot_still_goes_on_fine(
    client, admin_headers, admin_user: User, pilot_user: User
):
    mission = Mission(name="Survey Site A", owner_id=str(admin_user.id))
    await mission.insert()

    resp = await client.patch(
        f"/missions/{mission.id}",
        json={"assigned_pilot_ids": [str(pilot_user.id)]},
        headers=admin_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["assigned_pilot_ids"] == [str(pilot_user.id)]


async def test_an_invite_will_not_take_a_throwaway_password(client, admin_user: User):
    user = User(
        name="New Pilot", email="new@flyby-robotics.dev", role=Role.PILOT, invite_token="tok"
    )
    from datetime import datetime, timedelta, timezone

    user.invite_token_expires_at = datetime.now(timezone.utc) + timedelta(days=1)
    await user.insert()

    resp = await client.post("/auth/accept-invite", json={"token": "tok", "password": "x"})

    assert resp.status_code == 422


async def test_a_reset_will_not_take_a_throwaway_password(client, pilot_user: User):
    from datetime import datetime, timedelta, timezone

    pilot_user.reset_token = "reset-tok"
    pilot_user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    await pilot_user.save()

    resp = await client.post(
        "/auth/reset-password", json={"token": "reset-tok", "password": "short"}
    )

    assert resp.status_code == 422


async def test_a_default_jwt_secret_is_refused_in_prod():
    import pytest

    from app.config import Settings

    with pytest.raises(ValueError, match="JWT_SECRET"):
        Settings(app_env="prod", jwt_secret="dev-secret-change-me")


async def test_a_malformed_id_reads_as_missing_not_broken(
    client, admin_headers, pilot_headers, admin_user: User
):
    # bson raises InvalidId, which is not a ValueError, so every one of these
    # was coming back a 500 instead of a 404
    for path, headers in [
        ("/missions/not-an-id", admin_headers),
        ("/missions/not-an-id/waypoints", admin_headers),
        ("/missions/not-an-id/export", admin_headers),
        ("/drones/not-an-id", admin_headers),
        ("/missions/not-an-id/reports", pilot_headers),
    ]:
        resp = await client.get(path, headers=headers)
        assert resp.status_code == 404, f"{path} gave {resp.status_code}"


async def test_a_malformed_id_is_refused_on_the_write_routes(
    client, admin_headers, admin_user: User
):
    mission = Mission(name="Survey Site A", owner_id=str(admin_user.id))
    await mission.insert()

    assert (
        await client.patch("/drones/not-an-id", json={"name": "x"}, headers=admin_headers)
    ).status_code == 404
    assert (
        await client.delete("/drones/not-an-id", headers=admin_headers)
    ).status_code == 404
    assert (
        await client.post(
            f"/missions/{mission.id}/assignments",
            json={"pilot_id": "not-an-id"},
            headers=admin_headers,
        )
    ).status_code == 404
    assert (
        await client.delete("/api-tokens/not-an-id", headers=admin_headers)
    ).status_code == 404


async def test_an_unknown_email_costs_the_same_as_a_wrong_password(client, monkeypatch):
    # if only real accounts pay for a bcrypt check, the response time answers
    # "does this email have an account here"
    checked = []
    monkeypatch.setattr(
        "app.routers.auth.verify_password",
        lambda password, hashed: checked.append(hashed) or False,
    )

    resp = await client.post(
        "/auth/login", json={"email": "nobody@flyby-robotics.dev", "password": "whatever123"}
    )

    assert resp.status_code == 401
    assert len(checked) == 1
