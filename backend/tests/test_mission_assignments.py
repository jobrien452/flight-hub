import pytest

from app.models.mission import Mission
from app.models.user import User


@pytest.fixture
def sent_mail(monkeypatch) -> list[dict]:
    sent: list[dict] = []

    def assigned(to_email, mission_name, mission_id, message):
        sent.append(
            {
                "kind": "assigned",
                "to": to_email,
                "mission_id": mission_id,
                "message": message,
            }
        )

    def unassigned(to_email, mission_name, mission_id, message):
        sent.append(
            {
                "kind": "unassigned",
                "to": to_email,
                "mission_id": mission_id,
                "message": message,
            }
        )

    monkeypatch.setattr("app.routers.missions.send_mission_assigned_email", assigned)
    monkeypatch.setattr("app.routers.missions.send_mission_unassigned_email", unassigned)
    return sent


async def test_assigning_a_pilot_adds_them_and_emails_them(
    client, admin_headers, unassigned_mission: Mission, pilot_user: User, sent_mail
):
    resp = await client.post(
        f"/missions/{unassigned_mission.id}/assignments",
        json={"pilot_id": str(pilot_user.id), "message": "Wheels up at 7"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["assigned_pilot_ids"] == [str(pilot_user.id)]

    assert sent_mail == [
        {
            "kind": "assigned",
            "to": pilot_user.email,
            "mission_id": str(unassigned_mission.id),
            "message": "Wheels up at 7",
        }
    ]


async def test_assigning_without_a_message_still_emails(
    client, admin_headers, unassigned_mission: Mission, pilot_user: User, sent_mail
):
    resp = await client.post(
        f"/missions/{unassigned_mission.id}/assignments",
        json={"pilot_id": str(pilot_user.id)},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert sent_mail[0]["message"] is None


async def test_assigning_the_same_pilot_twice_is_a_no_op(
    client, admin_headers, assigned_mission: Mission, pilot_user: User, sent_mail
):
    resp = await client.post(
        f"/missions/{assigned_mission.id}/assignments",
        json={"pilot_id": str(pilot_user.id)},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["assigned_pilot_ids"] == [str(pilot_user.id)]
    assert sent_mail == []


async def test_cannot_assign_an_admin(
    client, admin_headers, unassigned_mission: Mission, admin_user: User, sent_mail
):
    resp = await client.post(
        f"/missions/{unassigned_mission.id}/assignments",
        json={"pilot_id": str(admin_user.id)},
        headers=admin_headers,
    )
    assert resp.status_code == 400
    assert sent_mail == []


async def test_cannot_assign_a_pilot_who_does_not_exist(
    client, admin_headers, unassigned_mission: Mission, sent_mail
):
    resp = await client.post(
        f"/missions/{unassigned_mission.id}/assignments",
        json={"pilot_id": "000000000000000000000000"},
        headers=admin_headers,
    )
    assert resp.status_code == 404


async def test_pilot_cannot_assign(
    client, pilot_headers, assigned_mission: Mission, pilot_user: User, sent_mail
):
    resp = await client.post(
        f"/missions/{assigned_mission.id}/assignments",
        json={"pilot_id": str(pilot_user.id)},
        headers=pilot_headers,
    )
    assert resp.status_code == 403


async def test_unassigning_removes_the_pilot_and_emails_them(
    client, admin_headers, assigned_mission: Mission, pilot_user: User, sent_mail
):
    resp = await client.request(
        "DELETE",
        f"/missions/{assigned_mission.id}/assignments/{pilot_user.id}",
        json={"message": "Weather scrubbed it"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["assigned_pilot_ids"] == []

    assert sent_mail == [
        {
            "kind": "unassigned",
            "to": pilot_user.email,
            "mission_id": str(assigned_mission.id),
            "message": "Weather scrubbed it",
        }
    ]


async def test_unassigning_somebody_not_assigned_is_a_no_op(
    client, admin_headers, unassigned_mission: Mission, pilot_user: User, sent_mail
):
    resp = await client.request(
        "DELETE",
        f"/missions/{unassigned_mission.id}/assignments/{pilot_user.id}",
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert sent_mail == []


async def test_pilot_cannot_unassign(
    client, pilot_headers, assigned_mission: Mission, pilot_user: User, sent_mail
):
    resp = await client.request(
        "DELETE",
        f"/missions/{assigned_mission.id}/assignments/{pilot_user.id}",
        headers=pilot_headers,
    )
    assert resp.status_code == 403


async def test_a_failed_assignment_email_does_not_fail_the_request(
    client, admin_headers, unassigned_mission: Mission, pilot_user: User, monkeypatch
):
    def blow_up(to_email, mission_name, mission_id, message):
        raise ConnectionRefusedError("smtp not configured")

    monkeypatch.setattr("app.routers.missions.send_mission_assigned_email", blow_up)

    resp = await client.post(
        f"/missions/{unassigned_mission.id}/assignments",
        json={"pilot_id": str(pilot_user.id)},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["assigned_pilot_ids"] == [str(pilot_user.id)]
