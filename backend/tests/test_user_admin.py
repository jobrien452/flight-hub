from app.models.drone import Drone
from app.models.mission import Mission, MissionStatus
from app.models.mission_report import MissionReport, MissionReportStatus
from app.models.user import Role, User


async def test_admin_renames_a_user(client, admin_headers, pilot_user: User):
    resp = await client.patch(
        f"/users/{pilot_user.id}", json={"name": "Pete Pilot Jr"}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["name"] == "Pete Pilot Jr"


async def test_admin_fixes_a_typo_in_an_email(client, admin_headers, pilot_user: User, monkeypatch):
    monkeypatch.setattr("app.invites.send_invite_email", lambda to_email, token: None)

    resp = await client.patch(
        f"/users/{pilot_user.id}",
        json={"email": "Pete.Fixed@Flyby-Robotics.dev"},
        headers=admin_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["email"] == "pete.fixed@flyby-robotics.dev"


async def test_a_corrected_email_gets_the_invite_again(client, admin_headers, monkeypatch):
    pending = User(name="Ivy Invited", email="typo@flyby-robotics.dev", role=Role.PILOT)
    await pending.insert()

    sent = []
    monkeypatch.setattr(
        "app.invites.send_invite_email", lambda to_email, token: sent.append(to_email)
    )

    await client.patch(
        f"/users/{pending.id}", json={"email": "ivy@flyby-robotics.dev"}, headers=admin_headers
    )

    assert sent == ["ivy@flyby-robotics.dev"]


async def test_a_claimed_account_is_not_re_invited_on_a_rename(
    client, admin_headers, monkeypatch
):
    claimed = User(
        name="Pete Pilot",
        email="pete@flyby-robotics.dev",
        role=Role.PILOT,
        password_hash="already-set",
    )
    await claimed.insert()

    sent = []
    monkeypatch.setattr(
        "app.invites.send_invite_email", lambda to_email, token: sent.append(to_email)
    )

    await client.patch(
        f"/users/{claimed.id}", json={"email": "pete.new@flyby-robotics.dev"}, headers=admin_headers
    )

    assert sent == []


async def test_a_role_cannot_be_edited_after_creation(client, admin_headers, pilot_user: User):
    resp = await client.patch(
        f"/users/{pilot_user.id}", json={"role": "admin"}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["role"] == "pilot"


async def test_an_email_cannot_be_taken_from_another_account(
    client, admin_headers, pilot_user: User, other_pilot_user: User
):
    resp = await client.patch(
        f"/users/{pilot_user.id}", json={"email": other_pilot_user.email}, headers=admin_headers
    )

    assert resp.status_code == 409


async def test_editing_a_user_who_is_not_there(client, admin_headers):
    resp = await client.patch("/users/not-an-id", json={"name": "Ghost"}, headers=admin_headers)
    assert resp.status_code == 404


async def test_a_pilot_cannot_edit_users(client, pilot_headers, other_pilot_user: User):
    resp = await client.patch(
        f"/users/{other_pilot_user.id}", json={"name": "Nope"}, headers=pilot_headers
    )
    assert resp.status_code == 403


async def test_deleting_a_pilot_takes_them_off_their_missions(
    client, admin_headers, pilot_user: User, assigned_mission: Mission
):
    resp = await client.delete(f"/users/{pilot_user.id}", headers=admin_headers)

    assert resp.status_code == 204
    assert await User.get(pilot_user.id) is None
    refreshed = await Mission.get(assigned_mission.id)
    assert refreshed.assigned_pilot_ids == []


async def test_a_deleted_pilot_keeps_the_reports_they_filed(
    client, admin_headers, pilot_user: User, assigned_mission: Mission
):
    report = MissionReport(
        mission_id=str(assigned_mission.id),
        pilot_id=str(pilot_user.id),
        status=MissionReportStatus.SUBMITTED,
    )
    await report.insert()

    await client.delete(f"/users/{pilot_user.id}", headers=admin_headers)

    assert await MissionReport.get(report.id) is not None


async def test_deleting_the_last_pilot_a_mission_waited_on_finishes_it(
    client, admin_headers, admin_user: User, pilot_user: User, other_pilot_user: User
):
    mission = Mission(
        name="Survey Site A",
        owner_id=str(admin_user.id),
        assigned_pilot_ids=[str(pilot_user.id), str(other_pilot_user.id)],
        status=MissionStatus.IN_FLIGHT,
    )
    await mission.insert()
    await MissionReport(
        mission_id=str(mission.id),
        pilot_id=str(other_pilot_user.id),
        status=MissionReportStatus.SUBMITTED,
    ).insert()

    await client.delete(f"/users/{pilot_user.id}", headers=admin_headers)

    refreshed = await Mission.get(mission.id)
    assert refreshed.status == MissionStatus.COMPLETED


async def test_a_mission_nobody_flew_does_not_complete_itself(
    client, admin_headers, admin_user: User, pilot_user: User
):
    mission = Mission(
        name="Survey Site A",
        owner_id=str(admin_user.id),
        assigned_pilot_ids=[str(pilot_user.id)],
        status=MissionStatus.PUBLISHED,
    )
    await mission.insert()

    await client.delete(f"/users/{pilot_user.id}", headers=admin_headers)

    refreshed = await Mission.get(mission.id)
    assert refreshed.status == MissionStatus.PUBLISHED


async def test_deleting_an_admin_hands_their_work_over(
    client, admin_headers, admin_user: User, other_admin_user: User
):
    mission = Mission(name="Alec's survey", owner_id=str(other_admin_user.id))
    await mission.insert()
    drone = Drone(name="Alec's falcon", owner_id=str(other_admin_user.id))
    await drone.insert()

    resp = await client.delete(f"/users/{other_admin_user.id}", headers=admin_headers)

    assert resp.status_code == 204
    assert (await Mission.get(mission.id)).owner_id == str(admin_user.id)
    assert (await Drone.get(drone.id)).owner_id == str(admin_user.id)


async def test_you_cannot_delete_yourself(client, admin_headers, admin_user: User):
    resp = await client.delete(f"/users/{admin_user.id}", headers=admin_headers)

    assert resp.status_code == 409
    assert await User.get(admin_user.id) is not None


async def test_deleting_a_user_who_is_not_there(client, admin_headers):
    resp = await client.delete("/users/not-an-id", headers=admin_headers)
    assert resp.status_code == 404


async def test_a_pilot_cannot_delete_users(client, pilot_headers, other_pilot_user: User):
    resp = await client.delete(f"/users/{other_pilot_user.id}", headers=pilot_headers)
    assert resp.status_code == 403


async def test_a_deleted_users_session_stops_working(client, admin_headers, pilot_headers, pilot_user: User):
    await client.delete(f"/users/{pilot_user.id}", headers=admin_headers)

    resp = await client.get("/missions", headers=pilot_headers)
    assert resp.status_code == 401


async def test_user_management_stays_off_the_api_docs(client, admin_headers):
    resp = await client.get("/openapi.json", headers=admin_headers)
    paths = resp.json()["paths"]

    # an api token is for missions and fleet, managing people is a signed in job
    assert "/users/{user_id}" not in paths
    assert set(paths["/users"]) == {"get"}
