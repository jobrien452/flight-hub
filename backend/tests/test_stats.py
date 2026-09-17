from app.models.drone import Drone, DroneStatus
from app.models.mission import Mission, MissionStatus
from app.models.user import User


async def make_mission(owner: User, status: MissionStatus, pilots: list[User] | None = None) -> Mission:
    mission = Mission(
        name=f"Survey {status.value}",
        owner_id=str(owner.id),
        assigned_pilot_ids=[str(p.id) for p in (pilots or [])],
        status=status,
    )
    await mission.insert()
    return mission


async def test_a_pilot_does_not_get_the_dashboard(client, pilot_headers):
    resp = await client.get("/stats", headers=pilot_headers)
    assert resp.status_code == 403


async def test_missions_are_counted_by_status(client, admin_headers, admin_user: User):
    await make_mission(admin_user, MissionStatus.DRAFT)
    await make_mission(admin_user, MissionStatus.PUBLISHED)
    await make_mission(admin_user, MissionStatus.COMPLETED)
    await make_mission(admin_user, MissionStatus.COMPLETED)

    resp = await client.get("/stats", headers=admin_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["missions_total"] == 4
    assert body["missions_by_status"]["completed"] == 2
    assert body["missions_by_status"]["draft"] == 1
    # every state is present even at zero, so the dashboard keeps a stable shape
    assert body["missions_by_status"]["in_flight"] == 0


async def test_another_admins_work_stays_out_of_the_numbers(
    client, admin_headers, admin_user: User, other_admin_user: User
):
    await make_mission(admin_user, MissionStatus.DRAFT)
    await make_mission(other_admin_user, MissionStatus.DRAFT)
    await Drone(name="Theirs", owner_id=str(other_admin_user.id), flight_hours=99).insert()

    resp = await client.get("/stats", headers=admin_headers)

    body = resp.json()
    assert body["missions_total"] == 1
    assert body["drones_total"] == 0
    assert body["fleet_flight_hours"] == 0


async def test_the_fleet_totals_add_up(client, admin_headers, admin_user: User):
    await Drone(
        name="Falcon 1", owner_id=str(admin_user.id), flight_hours=10.5, missions_flown=4
    ).insert()
    await Drone(
        name="Falcon 2",
        owner_id=str(admin_user.id),
        flight_hours=2.25,
        missions_flown=1,
        status=DroneStatus.MAINTENANCE,
    ).insert()

    resp = await client.get("/stats", headers=admin_headers)

    body = resp.json()
    assert body["drones_total"] == 2
    assert body["fleet_flight_hours"] == 12.75
    assert body["fleet_missions_flown"] == 5
    assert body["drones_by_status"]["available"] == 1
    assert body["drones_by_status"]["maintenance"] == 1


async def test_each_pilot_gets_a_row(
    client, admin_headers, pilot_headers, admin_user: User, pilot_user: User, other_pilot_user: User
):
    mission = await make_mission(admin_user, MissionStatus.PUBLISHED, [pilot_user])
    await make_mission(admin_user, MissionStatus.PUBLISHED, [pilot_user, other_pilot_user])
    created = await client.post(f"/missions/{mission.id}/reports", json={}, headers=pilot_headers)
    await client.patch(
        f"/missions/{mission.id}/reports/{created.json()['id']}",
        json={"status": "submitted", "data": {"duration_minutes": 20}},
        headers=pilot_headers,
    )

    resp = await client.get("/stats", headers=admin_headers)

    rows = {row["name"]: row for row in resp.json()["pilots"]}
    assert rows["Pete Pilot"]["missions_assigned"] == 2
    assert rows["Pete Pilot"]["reports_submitted"] == 1
    assert rows["Pete Pilot"]["flight_hours"] == 0.33
    assert rows["Priya Pilot"]["missions_assigned"] == 1
    assert rows["Priya Pilot"]["reports_submitted"] == 0


async def test_a_pilot_with_no_work_still_shows_up(client, admin_headers, pilot_user: User):
    resp = await client.get("/stats", headers=admin_headers)

    rows = {row["name"]: row for row in resp.json()["pilots"]}
    assert rows["Pete Pilot"]["missions_assigned"] == 0
