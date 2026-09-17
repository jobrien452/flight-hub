from app.models.drone import Drone, DroneStatus
from app.models.mission import Mission, MissionStatus
from app.models.user import User


async def make_drone(admin: User, name: str = "Falcon 1") -> Drone:
    drone = Drone(name=name, model="Matrice 350 RTK", serial="SN-001", owner_id=str(admin.id))
    await drone.insert()
    return drone


async def test_an_admin_adds_a_drone(client, admin_headers):
    resp = await client.post(
        "/drones",
        json={"name": "Falcon 1", "model": "Matrice 350 RTK", "serial": "SN-001"},
        headers=admin_headers,
    )

    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Falcon 1"
    assert body["status"] == "available"
    assert body["flight_hours"] == 0
    assert body["missions_flown"] == 0


async def test_a_pilot_cannot_add_a_drone(client, pilot_headers):
    resp = await client.post("/drones", json={"name": "Falcon 1"}, headers=pilot_headers)
    assert resp.status_code == 403


async def test_an_admin_only_lists_their_own_fleet(
    client, admin_headers, admin_user: User, other_admin_user: User
):
    await make_drone(admin_user, "Mine")
    await make_drone(other_admin_user, "Theirs")

    resp = await client.get("/drones", headers=admin_headers)

    assert resp.status_code == 200
    assert [d["name"] for d in resp.json()] == ["Mine"]


async def test_another_admins_drone_reads_as_missing(
    client, admin_headers, other_admin_user: User
):
    drone = await make_drone(other_admin_user)

    resp = await client.get(f"/drones/{drone.id}", headers=admin_headers)
    assert resp.status_code == 404


async def test_an_admin_updates_a_drone(client, admin_headers, admin_user: User):
    drone = await make_drone(admin_user)

    resp = await client.patch(
        f"/drones/{drone.id}", json={"status": "maintenance"}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["status"] == "maintenance"


async def test_an_admin_deletes_a_drone(client, admin_headers, admin_user: User):
    drone = await make_drone(admin_user)

    resp = await client.delete(f"/drones/{drone.id}", headers=admin_headers)
    assert resp.status_code == 204
    assert (await client.get(f"/drones/{drone.id}", headers=admin_headers)).status_code == 404


async def test_a_drone_in_flight_cannot_be_deleted(client, admin_headers, admin_user: User):
    drone = await make_drone(admin_user)
    drone.status = DroneStatus.IN_FLIGHT
    await drone.save()

    resp = await client.delete(f"/drones/{drone.id}", headers=admin_headers)
    assert resp.status_code == 409


async def test_an_admin_attaches_a_drone_to_a_mission(
    client, admin_headers, admin_user: User, flyable_mission: Mission
):
    drone = await make_drone(admin_user)

    resp = await client.patch(
        f"/missions/{flyable_mission.id}", json={"drone_id": str(drone.id)}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["drone_id"] == str(drone.id)


async def test_a_drone_belonging_to_another_admin_cannot_be_attached(
    client, admin_headers, other_admin_user: User, flyable_mission: Mission
):
    drone = await make_drone(other_admin_user)

    resp = await client.patch(
        f"/missions/{flyable_mission.id}", json={"drone_id": str(drone.id)}, headers=admin_headers
    )

    assert resp.status_code == 404


async def test_a_pilot_sees_the_drone_on_a_mission_they_fly(
    client, admin_headers, pilot_headers, admin_user: User, flyable_mission: Mission
):
    drone = await make_drone(admin_user)
    await client.patch(
        f"/missions/{flyable_mission.id}", json={"drone_id": str(drone.id)}, headers=admin_headers
    )

    resp = await client.get(f"/drones/{drone.id}", headers=pilot_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Falcon 1"


async def test_a_pilot_cannot_see_a_drone_they_are_not_flying(
    client, pilot_headers, admin_user: User
):
    drone = await make_drone(admin_user)

    resp = await client.get(f"/drones/{drone.id}", headers=pilot_headers)
    assert resp.status_code == 404


async def test_starting_a_mission_puts_its_drone_in_the_air(
    client, admin_headers, pilot_headers, admin_user: User, flyable_mission: Mission
):
    drone = await make_drone(admin_user)
    await client.patch(
        f"/missions/{flyable_mission.id}", json={"drone_id": str(drone.id)}, headers=admin_headers
    )

    await client.post(f"/missions/{flyable_mission.id}/start", headers=pilot_headers)

    resp = await client.get(f"/drones/{drone.id}", headers=admin_headers)
    assert resp.json()["status"] == "in_flight"


async def test_a_finished_mission_hands_the_drone_back(
    client, admin_headers, pilot_headers, admin_user: User, flyable_mission: Mission
):
    drone = await make_drone(admin_user)
    await client.patch(
        f"/missions/{flyable_mission.id}", json={"drone_id": str(drone.id)}, headers=admin_headers
    )
    await client.post(f"/missions/{flyable_mission.id}/start", headers=pilot_headers)

    created = await client.post(
        f"/missions/{flyable_mission.id}/reports", json={}, headers=pilot_headers
    )
    await client.patch(
        f"/missions/{flyable_mission.id}/reports/{created.json()['id']}",
        json={"status": "submitted", "data": {"duration_minutes": 30}},
        headers=pilot_headers,
    )

    resp = await client.get(f"/drones/{drone.id}", headers=admin_headers)
    body = resp.json()
    assert body["status"] == "available"
    assert body["flight_hours"] == 0.5
    assert body["missions_flown"] == 1


async def test_flight_hours_add_up_across_missions(
    client, admin_headers, pilot_headers, admin_user: User, pilot_user: User
):
    drone = await make_drone(admin_user)
    for minutes in (30, 45):
        mission = Mission(
            name="Survey",
            owner_id=str(admin_user.id),
            assigned_pilot_ids=[str(pilot_user.id)],
            status=MissionStatus.PUBLISHED,
            drone_id=str(drone.id),
        )
        await mission.insert()
        created = await client.post(
            f"/missions/{mission.id}/reports", json={}, headers=pilot_headers
        )
        await client.patch(
            f"/missions/{mission.id}/reports/{created.json()['id']}",
            json={"status": "submitted", "data": {"duration_minutes": minutes}},
            headers=pilot_headers,
        )

    resp = await client.get(f"/drones/{drone.id}", headers=admin_headers)
    assert resp.json()["flight_hours"] == 1.25
    assert resp.json()["missions_flown"] == 2


async def test_a_report_without_a_duration_still_counts_the_mission(
    client, admin_headers, pilot_headers, admin_user: User, flyable_mission: Mission
):
    drone = await make_drone(admin_user)
    await client.patch(
        f"/missions/{flyable_mission.id}", json={"drone_id": str(drone.id)}, headers=admin_headers
    )

    created = await client.post(
        f"/missions/{flyable_mission.id}/reports", json={}, headers=pilot_headers
    )
    await client.patch(
        f"/missions/{flyable_mission.id}/reports/{created.json()['id']}",
        json={"status": "submitted"},
        headers=pilot_headers,
    )

    resp = await client.get(f"/drones/{drone.id}", headers=admin_headers)
    assert resp.json()["flight_hours"] == 0
    assert resp.json()["missions_flown"] == 1
