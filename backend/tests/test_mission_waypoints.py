from app.models.mission import Mission, MissionStatus, Waypoint
from app.models.user import User

ROUTE = [
    {"lat": 0.0, "lng": 0.0, "alt": 30},
    {"lat": 0.0, "lng": 1.0, "alt": 30},
    {"lat": 1.0, "lng": 1.0, "alt": 30},
]


async def with_route(mission: Mission) -> Mission:
    mission.waypoints = [Waypoint(**w) for w in ROUTE]
    await mission.save()
    return mission


async def test_the_list_leaves_the_route_out(client, admin_headers, assigned_mission: Mission):
    await with_route(assigned_mission)

    resp = await client.get("/missions", headers=admin_headers)

    assert resp.status_code == 200
    row = resp.json()[0]
    assert "waypoints" not in row
    assert "plan_params" not in row
    # the count still comes back, the table needs it without the points themselves
    assert row["waypoint_count"] == 3


async def test_the_list_still_carries_what_the_table_shows(
    client, admin_headers, assigned_mission: Mission
):
    resp = await client.get("/missions", headers=admin_headers)

    row = resp.json()[0]
    for field in ("id", "name", "status", "owner_id", "assigned_pilot_ids", "updated_at"):
        assert field in row


async def test_a_pilots_queue_leaves_the_route_out_too(
    client, pilot_headers, flyable_mission: Mission
):
    await with_route(flyable_mission)

    resp = await client.get("/me/missions", headers=pilot_headers)

    row = resp.json()[0]
    assert "waypoints" not in row
    assert row["waypoint_count"] == 3


async def test_one_mission_still_comes_back_whole(client, admin_headers, assigned_mission: Mission):
    await with_route(assigned_mission)

    resp = await client.get(f"/missions/{assigned_mission.id}", headers=admin_headers)

    body = resp.json()
    assert len(body["waypoints"]) == 3
    assert body["waypoint_count"] == 3


async def test_the_route_has_its_own_endpoint(client, admin_headers, assigned_mission: Mission):
    await with_route(assigned_mission)

    resp = await client.get(f"/missions/{assigned_mission.id}/waypoints", headers=admin_headers)

    assert resp.status_code == 200
    assert len(resp.json()) == 3
    assert resp.json()[0]["alt"] == 30


async def test_an_empty_plan_has_an_empty_route(client, admin_headers, assigned_mission: Mission):
    resp = await client.get(f"/missions/{assigned_mission.id}/waypoints", headers=admin_headers)

    assert resp.status_code == 200
    assert resp.json() == []


async def test_a_pilot_reads_the_route_of_a_mission_they_fly(
    client, pilot_headers, flyable_mission: Mission
):
    await with_route(flyable_mission)

    resp = await client.get(f"/missions/{flyable_mission.id}/waypoints", headers=pilot_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 3


async def test_a_pilot_cannot_read_the_route_of_a_draft(
    client, pilot_headers, assigned_mission: Mission
):
    resp = await client.get(f"/missions/{assigned_mission.id}/waypoints", headers=pilot_headers)
    assert resp.status_code == 404


async def test_another_admins_route_reads_as_missing(
    client, admin_headers, other_admin_user: User
):
    theirs = Mission(name="Theirs", owner_id=str(other_admin_user.id), status=MissionStatus.PUBLISHED)
    await theirs.insert()

    resp = await client.get(f"/missions/{theirs.id}/waypoints", headers=admin_headers)
    assert resp.status_code == 404


async def test_the_route_needs_auth(client, assigned_mission: Mission):
    resp = await client.get(f"/missions/{assigned_mission.id}/waypoints")
    assert resp.status_code == 403
