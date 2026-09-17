from app.models.mission import Mission, MissionStatus
from app.models.user import User


async def published(mission: Mission) -> Mission:
    mission.status = MissionStatus.PUBLISHED
    await mission.save()
    return mission


async def test_a_pilot_acknowledges_an_assigned_mission(
    client, pilot_headers, admin_headers, assigned_mission: Mission
):
    await published(assigned_mission)

    resp = await client.post(f"/missions/{assigned_mission.id}/acknowledge", headers=pilot_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "acknowledged"


async def test_a_pilot_cannot_acknowledge_a_draft(
    client, pilot_headers, assigned_mission: Mission
):
    # a draft is not visible to a pilot at all, so it reads as missing
    resp = await client.post(f"/missions/{assigned_mission.id}/acknowledge", headers=pilot_headers)
    assert resp.status_code == 404


async def test_a_pilot_cannot_acknowledge_someone_elses_mission(
    client, other_pilot_headers, assigned_mission: Mission
):
    await published(assigned_mission)

    resp = await client.post(
        f"/missions/{assigned_mission.id}/acknowledge", headers=other_pilot_headers
    )
    assert resp.status_code == 404


async def test_an_admin_does_not_acknowledge_missions(
    client, admin_headers, assigned_mission: Mission
):
    await published(assigned_mission)

    resp = await client.post(f"/missions/{assigned_mission.id}/acknowledge", headers=admin_headers)
    assert resp.status_code == 403


async def test_a_pilot_starts_an_acknowledged_mission(
    client, pilot_headers, assigned_mission: Mission
):
    await published(assigned_mission)
    await client.post(f"/missions/{assigned_mission.id}/acknowledge", headers=pilot_headers)

    resp = await client.post(f"/missions/{assigned_mission.id}/start", headers=pilot_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_flight"


async def test_a_pilot_can_start_without_acknowledging_first(
    client, pilot_headers, assigned_mission: Mission
):
    await published(assigned_mission)

    resp = await client.post(f"/missions/{assigned_mission.id}/start", headers=pilot_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_flight"


async def test_a_flown_mission_cannot_be_started_again(
    client, pilot_headers, assigned_mission: Mission
):
    assigned_mission.status = MissionStatus.COMPLETED
    await assigned_mission.save()

    resp = await client.post(f"/missions/{assigned_mission.id}/start", headers=pilot_headers)
    assert resp.status_code == 409


async def test_acknowledging_twice_is_rejected(client, pilot_headers, assigned_mission: Mission):
    await published(assigned_mission)
    await client.post(f"/missions/{assigned_mission.id}/acknowledge", headers=pilot_headers)

    resp = await client.post(f"/missions/{assigned_mission.id}/acknowledge", headers=pilot_headers)
    assert resp.status_code == 409


async def test_a_mission_in_flight_still_completes_on_reports(
    client, pilot_headers, admin_headers, assigned_mission: Mission
):
    await published(assigned_mission)
    await client.post(f"/missions/{assigned_mission.id}/start", headers=pilot_headers)

    created = await client.post(
        f"/missions/{assigned_mission.id}/reports", json={}, headers=pilot_headers
    )
    await client.patch(
        f"/missions/{assigned_mission.id}/reports/{created.json()['id']}",
        json={"status": "submitted"},
        headers=pilot_headers,
    )

    done = await client.get(f"/missions/{assigned_mission.id}", headers=admin_headers)
    assert done.json()["status"] == "completed"


async def test_my_missions_lists_what_a_pilot_is_assigned(
    client, pilot_headers, assigned_mission: Mission, unassigned_mission: Mission
):
    await published(assigned_mission)

    resp = await client.get("/me/missions", headers=pilot_headers)

    assert resp.status_code == 200
    assert [m["id"] for m in resp.json()] == [str(assigned_mission.id)]


async def test_my_missions_lists_what_an_admin_owns(
    client, admin_headers, assigned_mission: Mission, unassigned_mission: Mission
):
    resp = await client.get("/me/missions", headers=admin_headers)

    assert resp.status_code == 200
    assert {m["id"] for m in resp.json()} == {
        str(assigned_mission.id),
        str(unassigned_mission.id),
    }


async def test_my_reports_spans_every_mission(
    client, pilot_headers, pilot_user: User, admin_user: User, flyable_mission: Mission
):
    second = Mission(
        name="Survey Site C",
        owner_id=str(admin_user.id),
        assigned_pilot_ids=[str(pilot_user.id)],
        status=MissionStatus.PUBLISHED,
    )
    await second.insert()

    for mission in (flyable_mission, second):
        await client.post(f"/missions/{mission.id}/reports", json={}, headers=pilot_headers)

    resp = await client.get("/me/reports", headers=pilot_headers)

    assert resp.status_code == 200
    assert {r["mission_id"] for r in resp.json()} == {str(flyable_mission.id), str(second.id)}


async def test_my_reports_does_not_leak_another_pilots_work(
    client, pilot_headers, other_pilot_headers, other_pilot_user: User, flyable_mission: Mission
):
    await client.post(f"/missions/{flyable_mission.id}/reports", json={}, headers=pilot_headers)

    resp = await client.get("/me/reports", headers=other_pilot_headers)

    assert resp.status_code == 200
    assert resp.json() == []


async def test_the_me_routes_need_authentication(client):
    assert (await client.get("/me/missions")).status_code == 403
    assert (await client.get("/me/reports")).status_code == 403


async def test_an_api_token_can_use_the_pilot_routes(client, pilot_headers, assigned_mission):
    created = await client.post(
        "/api-tokens", json={"name": "ground station"}, headers=pilot_headers
    )
    auth = {"Authorization": f"Bearer {created.json()['token']}"}

    resp = await client.get("/me/missions", headers=auth)
    assert resp.status_code == 200


async def test_a_pilot_does_not_see_drafts_in_their_queue(
    client, pilot_headers, assigned_mission: Mission
):
    for path in ("/missions", "/me/missions"):
        resp = await client.get(path, headers=pilot_headers)
        assert resp.json() == []


async def test_a_pilot_cannot_open_a_draft_directly(
    client, pilot_headers, assigned_mission: Mission
):
    resp = await client.get(f"/missions/{assigned_mission.id}", headers=pilot_headers)
    assert resp.status_code == 404


async def test_a_pilot_sees_the_mission_once_it_is_published(
    client, pilot_headers, assigned_mission: Mission
):
    await published(assigned_mission)

    resp = await client.get(f"/missions/{assigned_mission.id}", headers=pilot_headers)
    assert resp.status_code == 200


async def test_an_admin_still_sees_their_own_drafts(
    client, admin_headers, assigned_mission: Mission
):
    resp = await client.get(f"/missions/{assigned_mission.id}", headers=admin_headers)
    assert resp.status_code == 200
