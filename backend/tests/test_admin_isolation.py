from app.models.mission import Mission, MissionStatus
from app.models.user import User

# admins do not share missions, each only sees the ones they created. the pilot
# pool is shared though, anyone can be assigned by any admin. this is the shape
# to revisit if organizations ever land


async def test_an_admin_only_lists_their_own_missions(
    client, other_admin_headers, other_admin_user: User, assigned_mission: Mission
):
    mine = Mission(name="Alec's survey", owner_id=str(other_admin_user.id))
    await mine.insert()

    resp = await client.get("/missions", headers=other_admin_headers)

    assert resp.status_code == 200
    assert [m["id"] for m in resp.json()] == [str(mine.id)]


async def test_an_admin_with_no_missions_sees_an_empty_list(
    client, other_admin_headers, assigned_mission: Mission, unassigned_mission: Mission
):
    resp = await client.get("/missions", headers=other_admin_headers)

    assert resp.status_code == 200
    assert resp.json() == []


async def test_another_admins_mission_is_not_readable(
    client, other_admin_headers, assigned_mission: Mission
):
    # 404 rather than 403, another admin's work should not even register as existing
    resp = await client.get(f"/missions/{assigned_mission.id}", headers=other_admin_headers)
    assert resp.status_code == 404


async def test_another_admins_mission_is_not_editable(
    client, other_admin_headers, assigned_mission: Mission
):
    resp = await client.patch(
        f"/missions/{assigned_mission.id}",
        json={"name": "hijacked"},
        headers=other_admin_headers,
    )
    assert resp.status_code == 404

    unchanged = await Mission.get(assigned_mission.id)
    assert unchanged.name == "Survey Site A"


async def test_another_admins_mission_is_not_deletable(
    client, other_admin_headers, unassigned_mission: Mission
):
    resp = await client.delete(f"/missions/{unassigned_mission.id}", headers=other_admin_headers)
    assert resp.status_code == 404

    assert await Mission.get(unassigned_mission.id) is not None


async def test_another_admins_mission_is_not_publishable(
    client, other_admin_headers, admin_user: User
):
    mission = Mission(
        name="Ready", owner_id=str(admin_user.id), waypoints=[{"lat": 1.0, "lng": 2.0}]
    )
    await mission.insert()

    resp = await client.post(f"/missions/{mission.id}/publish", headers=other_admin_headers)
    assert resp.status_code == 404


async def test_another_admin_cannot_assign_pilots(
    client, other_admin_headers, unassigned_mission: Mission, pilot_user: User
):
    resp = await client.post(
        f"/missions/{unassigned_mission.id}/assignments",
        json={"pilot_id": str(pilot_user.id)},
        headers=other_admin_headers,
    )
    assert resp.status_code == 404


async def test_another_admin_cannot_read_the_reports(
    client, other_admin_headers, assigned_mission: Mission
):
    resp = await client.get(f"/missions/{assigned_mission.id}/reports", headers=other_admin_headers)
    assert resp.status_code == 404


async def test_the_owning_admin_still_has_full_access(
    client, admin_headers, assigned_mission: Mission
):
    assert (
        await client.get(f"/missions/{assigned_mission.id}", headers=admin_headers)
    ).status_code == 200
    assert (
        await client.patch(
            f"/missions/{assigned_mission.id}", json={"name": "Renamed"}, headers=admin_headers
        )
    ).status_code == 200


async def test_the_pilot_pool_is_shared_between_admins(
    client, admin_headers, other_admin_headers, pilot_user: User
):
    for headers in (admin_headers, other_admin_headers):
        resp = await client.get("/users?role=pilot", headers=headers)
        assert resp.status_code == 200
        assert str(pilot_user.id) in {u["id"] for u in resp.json()}


async def test_a_pilot_still_sees_a_mission_whoever_created_it(
    client, pilot_headers, other_admin_user: User, pilot_user: User
):
    mission = Mission(
        name="Alec's survey",
        owner_id=str(other_admin_user.id),
        assigned_pilot_ids=[str(pilot_user.id)],
        status=MissionStatus.PUBLISHED,
    )
    await mission.insert()

    listed = await client.get("/missions", headers=pilot_headers)
    assert [m["id"] for m in listed.json()] == [str(mission.id)]

    fetched = await client.get(f"/missions/{mission.id}", headers=pilot_headers)
    assert fetched.status_code == 200
