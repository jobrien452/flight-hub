from app.models.mission import Mission
from app.models.user import User


async def test_list_missions_requires_auth(client):
    resp = await client.get("/missions")
    assert resp.status_code == 403  # no bearer token supplied


async def test_admin_sees_the_missions_they_own(
    client, admin_headers, assigned_mission: Mission, unassigned_mission: Mission
):
    resp = await client.get("/missions", headers=admin_headers)
    assert resp.status_code == 200
    ids = {m["id"] for m in resp.json()}
    assert ids == {str(assigned_mission.id), str(unassigned_mission.id)}


async def test_pilot_sees_only_assigned_missions(
    client, pilot_headers, assigned_mission: Mission, unassigned_mission: Mission
):
    resp = await client.get("/missions", headers=pilot_headers)
    assert resp.status_code == 200
    ids = {m["id"] for m in resp.json()}
    assert ids == {str(assigned_mission.id)}


async def test_get_mission_by_id(client, admin_headers, assigned_mission: Mission):
    resp = await client.get(f"/missions/{assigned_mission.id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Survey Site A"


async def test_get_missing_mission_returns_404(client, admin_headers):
    resp = await client.get("/missions/000000000000000000000000", headers=admin_headers)
    assert resp.status_code == 404


async def test_pilot_cannot_get_unassigned_mission(
    client, pilot_headers, unassigned_mission: Mission
):
    resp = await client.get(f"/missions/{unassigned_mission.id}", headers=pilot_headers)
    assert resp.status_code == 403


async def test_admin_can_create_mission(client, admin_headers):
    payload = {
        "name": "New Survey",
        "waypoints": [{"lat": 1.0, "lng": 2.0, "alt": 10}],
    }
    resp = await client.post("/missions", json=payload, headers=admin_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "New Survey"
    assert body["status"] == "draft"


async def test_pilot_cannot_create_mission(client, pilot_headers):
    resp = await client.post("/missions", json={"name": "Nope"}, headers=pilot_headers)
    assert resp.status_code == 403


async def test_admin_can_update_mission(client, admin_headers, assigned_mission: Mission):
    resp = await client.patch(
        f"/missions/{assigned_mission.id}",
        json={"name": "Survey Site A (revised)"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Survey Site A (revised)"


async def test_pilot_cannot_update_mission(client, pilot_headers, assigned_mission: Mission):
    resp = await client.patch(
        f"/missions/{assigned_mission.id}",
        json={"name": "Nope"},
        headers=pilot_headers,
    )
    assert resp.status_code == 403


async def test_admin_can_delete_mission(client, admin_headers, unassigned_mission: Mission):
    resp = await client.delete(f"/missions/{unassigned_mission.id}", headers=admin_headers)
    assert resp.status_code == 204

    follow_up = await client.get(f"/missions/{unassigned_mission.id}", headers=admin_headers)
    assert follow_up.status_code == 404


async def test_pilot_cannot_delete_mission(client, pilot_headers, assigned_mission: Mission):
    resp = await client.delete(f"/missions/{assigned_mission.id}", headers=pilot_headers)
    assert resp.status_code == 403
