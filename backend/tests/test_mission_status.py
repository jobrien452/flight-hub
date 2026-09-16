from app.models.mission import Mission, MissionStatus
from app.models.user import User


async def test_new_mission_is_always_a_draft(client, admin_headers):
    # status is driven by the state machine, a client asking for something else is ignored
    resp = await client.post(
        "/missions",
        json={"name": "New Survey", "status": "published", "waypoints": [{"lat": 1.0, "lng": 2.0}]},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "draft"


async def test_status_cannot_be_set_through_a_plain_update(
    client, admin_headers, assigned_mission: Mission
):
    resp = await client.patch(
        f"/missions/{assigned_mission.id}",
        json={"status": "completed"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"


async def test_publish_moves_a_draft_to_published(client, admin_headers, admin_user: User):
    mission = Mission(
        name="Ready", owner_id=str(admin_user.id), waypoints=[{"lat": 1.0, "lng": 2.0}]
    )
    await mission.insert()

    resp = await client.post(f"/missions/{mission.id}/publish", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "published"


async def test_publish_needs_waypoints(client, admin_headers, unassigned_mission: Mission):
    resp = await client.post(f"/missions/{unassigned_mission.id}/publish", headers=admin_headers)
    assert resp.status_code == 409


async def test_publishing_twice_is_rejected(client, admin_headers, admin_user: User):
    mission = Mission(
        name="Ready",
        owner_id=str(admin_user.id),
        waypoints=[{"lat": 1.0, "lng": 2.0}],
        status=MissionStatus.PUBLISHED,
    )
    await mission.insert()

    resp = await client.post(f"/missions/{mission.id}/publish", headers=admin_headers)
    assert resp.status_code == 409


async def test_pilot_cannot_publish(client, pilot_headers, assigned_mission: Mission):
    resp = await client.post(f"/missions/{assigned_mission.id}/publish", headers=pilot_headers)
    assert resp.status_code == 403


async def test_mission_completes_when_its_only_pilot_submits(
    client, pilot_headers, admin_headers, assigned_mission: Mission
):
    assigned_mission.status = MissionStatus.PUBLISHED
    await assigned_mission.save()

    created = await client.post(
        f"/missions/{assigned_mission.id}/reports",
        json={"notes": "flew it"},
        headers=pilot_headers,
    )
    assert created.status_code == 201

    submitted = await client.patch(
        f"/missions/{assigned_mission.id}/reports/{created.json()['id']}",
        json={"status": "submitted"},
        headers=pilot_headers,
    )
    assert submitted.status_code == 200

    mission = await client.get(f"/missions/{assigned_mission.id}", headers=admin_headers)
    assert mission.json()["status"] == "completed"


async def test_mission_waits_for_every_assigned_pilot(
    client,
    admin_headers,
    pilot_headers,
    pilot_user: User,
    other_pilot_user: User,
    admin_user: User,
):
    mission = Mission(
        name="Two pilot survey",
        owner_id=str(admin_user.id),
        assigned_pilot_ids=[str(pilot_user.id), str(other_pilot_user.id)],
        waypoints=[{"lat": 1.0, "lng": 2.0}],
        status=MissionStatus.PUBLISHED,
    )
    await mission.insert()

    created = await client.post(
        f"/missions/{mission.id}/reports", json={}, headers=pilot_headers
    )
    await client.patch(
        f"/missions/{mission.id}/reports/{created.json()['id']}",
        json={"status": "submitted"},
        headers=pilot_headers,
    )

    still_open = await client.get(f"/missions/{mission.id}", headers=admin_headers)
    assert still_open.json()["status"] == "published"


async def test_mission_completes_once_the_last_pilot_submits(
    client,
    admin_headers,
    pilot_headers,
    other_pilot_headers,
    pilot_user: User,
    other_pilot_user: User,
    admin_user: User,
):
    mission = Mission(
        name="Two pilot survey",
        owner_id=str(admin_user.id),
        assigned_pilot_ids=[str(pilot_user.id), str(other_pilot_user.id)],
        waypoints=[{"lat": 1.0, "lng": 2.0}],
        status=MissionStatus.PUBLISHED,
    )
    await mission.insert()

    for headers in (pilot_headers, other_pilot_headers):
        created = await client.post(f"/missions/{mission.id}/reports", json={}, headers=headers)
        await client.patch(
            f"/missions/{mission.id}/reports/{created.json()['id']}",
            json={"status": "submitted"},
            headers=headers,
        )

    done = await client.get(f"/missions/{mission.id}", headers=admin_headers)
    assert done.json()["status"] == "completed"


async def test_submitting_stamps_the_report(client, pilot_headers, assigned_mission: Mission):
    created = await client.post(
        f"/missions/{assigned_mission.id}/reports", json={}, headers=pilot_headers
    )
    resp = await client.patch(
        f"/missions/{assigned_mission.id}/reports/{created.json()['id']}",
        json={"status": "submitted"},
        headers=pilot_headers,
    )
    assert resp.json()["submitted_at"] is not None


async def test_delete_is_blocked_while_a_pilot_is_assigned(
    client, admin_headers, assigned_mission: Mission
):
    resp = await client.delete(f"/missions/{assigned_mission.id}", headers=admin_headers)
    assert resp.status_code == 409

    still_there = await client.get(f"/missions/{assigned_mission.id}", headers=admin_headers)
    assert still_there.status_code == 200


async def test_delete_works_once_nobody_is_assigned(
    client, admin_headers, unassigned_mission: Mission
):
    resp = await client.delete(f"/missions/{unassigned_mission.id}", headers=admin_headers)
    assert resp.status_code == 204
