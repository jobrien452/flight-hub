from app.models.mission import Mission, MissionStatus
from app.models.user import User


async def test_pilot_creates_report_for_flyable_mission(
    client, pilot_headers, flyable_mission: Mission
):
    resp = await client.post(
        f"/missions/{flyable_mission.id}/reports",
        json={"notes": "clean flight"},
        headers=pilot_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["notes"] == "clean flight"
    assert body["status"] == "in_progress"


async def test_pilot_cannot_create_report_for_unassigned_mission(
    client, pilot_headers, unassigned_mission: Mission
):
    resp = await client.post(
        f"/missions/{unassigned_mission.id}/reports", json={}, headers=pilot_headers
    )
    assert resp.status_code == 404


async def test_pilot_reads_own_report(client, pilot_headers, flyable_mission: Mission):
    await client.post(
        f"/missions/{flyable_mission.id}/reports", json={}, headers=pilot_headers
    )
    resp = await client.get(f"/missions/{flyable_mission.id}/reports", headers=pilot_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_pilot_cannot_read_another_pilots_report(
    client, pilot_headers, other_pilot_headers, admin_user: User, pilot_user: User,
    other_pilot_user: User,
):
    mission = Mission(
        name="Shared Mission",
        owner_id=str(admin_user.id),
        assigned_pilot_ids=[str(pilot_user.id), str(other_pilot_user.id)],
        status=MissionStatus.PUBLISHED,
    )
    await mission.insert()
    await client.post(f"/missions/{mission.id}/reports", json={}, headers=pilot_headers)

    resp = await client.get(f"/missions/{mission.id}/reports", headers=other_pilot_headers)
    assert resp.status_code == 200
    assert resp.json() == []  # sees only their own, and they have none


async def test_admin_reads_all_reports_for_a_mission(
    client, admin_headers, pilot_headers, other_pilot_headers, admin_user: User,
    pilot_user: User, other_pilot_user: User,
):
    mission = Mission(
        name="Shared Mission",
        owner_id=str(admin_user.id),
        assigned_pilot_ids=[str(pilot_user.id), str(other_pilot_user.id)],
        status=MissionStatus.PUBLISHED,
    )
    await mission.insert()
    await client.post(f"/missions/{mission.id}/reports", json={}, headers=pilot_headers)
    await client.post(f"/missions/{mission.id}/reports", json={}, headers=other_pilot_headers)

    resp = await client.get(f"/missions/{mission.id}/reports", headers=admin_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_pilot_updates_own_report(client, pilot_headers, flyable_mission: Mission):
    create = await client.post(
        f"/missions/{flyable_mission.id}/reports", json={}, headers=pilot_headers
    )
    report_id = create.json()["id"]

    resp = await client.patch(
        f"/missions/{flyable_mission.id}/reports/{report_id}",
        json={"status": "submitted", "notes": "done"},
        headers=pilot_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "submitted"
    assert body["notes"] == "done"


async def test_pilot_cannot_update_another_pilots_report(
    client, pilot_headers, other_pilot_headers, admin_user: User, pilot_user: User,
    other_pilot_user: User,
):
    mission = Mission(
        name="Shared Mission",
        owner_id=str(admin_user.id),
        assigned_pilot_ids=[str(pilot_user.id), str(other_pilot_user.id)],
        status=MissionStatus.PUBLISHED,
    )
    await mission.insert()
    create = await client.post(
        f"/missions/{mission.id}/reports", json={}, headers=pilot_headers
    )
    report_id = create.json()["id"]

    resp = await client.patch(
        f"/missions/{mission.id}/reports/{report_id}",
        json={"notes": "sneaky edit"},
        headers=other_pilot_headers,
    )
    assert resp.status_code == 404


async def test_no_delete_route_exists(client, pilot_headers, flyable_mission: Mission):
    create = await client.post(
        f"/missions/{flyable_mission.id}/reports", json={}, headers=pilot_headers
    )
    report_id = create.json()["id"]

    resp = await client.delete(
        f"/missions/{flyable_mission.id}/reports/{report_id}", headers=pilot_headers
    )
    assert resp.status_code == 405


async def test_a_pilot_cannot_file_two_reports_for_one_mission(
    client, pilot_headers, flyable_mission: Mission
):
    first = await client.post(
        f"/missions/{flyable_mission.id}/reports", json={"notes": "one"}, headers=pilot_headers
    )
    assert first.status_code == 201

    second = await client.post(
        f"/missions/{flyable_mission.id}/reports", json={"notes": "two"}, headers=pilot_headers
    )

    assert second.status_code == 409
