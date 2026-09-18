from app.models.drone import Drone, DroneStatus
from app.models.mission import Mission
from app.models.user import User

PAYLOAD = {
    "name": "Sony ILX-LR1 + FE 24mm",
    "camera": "Sony ILX-LR1",
    "lens": "Sony FE 24mm F2.8 G",
    "gimbal": "Gremsy Pixy",
    "sensor_width_mm": 35.814,
    "sensor_height_mm": 23.876,
    "image_width_px": 9504,
    "image_height_px": 6336,
    "focal_length_mm": 24,
}


async def a_drone(admin: User, status: DroneStatus = DroneStatus.AVAILABLE) -> Drone:
    drone = Drone(name="Falcon 1", model="Matrice 350 RTK", owner_id=str(admin.id), status=status)
    await drone.insert()
    return drone


async def test_a_mission_carries_its_payload(client, admin_headers):
    resp = await client.post(
        "/missions", json={"name": "Survey", "payload": PAYLOAD}, headers=admin_headers
    )

    assert resp.status_code == 201
    assert resp.json()["payload"]["camera"] == "Sony ILX-LR1"
    assert resp.json()["payload"]["focal_length_mm"] == 24


async def test_the_payload_can_be_swapped_later(client, admin_headers, assigned_mission: Mission):
    resp = await client.patch(
        f"/missions/{assigned_mission.id}", json={"payload": PAYLOAD}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["payload"]["gimbal"] == "Gremsy Pixy"


async def test_a_mission_without_a_payload_is_fine(client, admin_headers):
    resp = await client.post("/missions", json={"name": "Survey"}, headers=admin_headers)

    assert resp.status_code == 201
    assert resp.json()["payload"] is None


async def test_publishing_needs_an_aircraft(client, admin_headers, admin_user: User):
    mission = Mission(
        name="Survey",
        owner_id=str(admin_user.id),
        waypoints=[{"lat": 1, "lng": 2, "alt": 30}, {"lat": 1.1, "lng": 2.1, "alt": 30}],
    )
    await mission.insert()

    resp = await client.post(f"/missions/{mission.id}/publish", headers=admin_headers)

    assert resp.status_code == 409
    assert "aircraft" in resp.json()["detail"]


async def test_publishing_works_once_an_aircraft_is_booked(client, admin_headers, admin_user: User):
    drone = await a_drone(admin_user)
    mission = Mission(
        name="Survey",
        owner_id=str(admin_user.id),
        waypoints=[{"lat": 1, "lng": 2, "alt": 30}, {"lat": 1.1, "lng": 2.1, "alt": 30}],
        drone_id=str(drone.id),
    )
    await mission.insert()

    resp = await client.post(f"/missions/{mission.id}/publish", headers=admin_headers)

    assert resp.status_code == 200
    assert resp.json()["status"] == "published"


async def test_saving_without_an_aircraft_is_always_allowed(
    client, admin_headers, assigned_mission: Mission
):
    # only publishing is gated, a draft can be saved in any half finished state
    resp = await client.patch(
        f"/missions/{assigned_mission.id}", json={"name": "Half done"}, headers=admin_headers
    )

    assert resp.status_code == 200


async def test_only_an_available_drone_can_be_booked(
    client, admin_headers, admin_user: User, assigned_mission: Mission
):
    grounded = await a_drone(admin_user, DroneStatus.MAINTENANCE)

    resp = await client.patch(
        f"/missions/{assigned_mission.id}",
        json={"drone_id": str(grounded.id)},
        headers=admin_headers,
    )

    assert resp.status_code == 409
    assert "available" in resp.json()["detail"]


async def test_an_available_drone_books_fine(
    client, admin_headers, admin_user: User, assigned_mission: Mission
):
    drone = await a_drone(admin_user)

    resp = await client.patch(
        f"/missions/{assigned_mission.id}", json={"drone_id": str(drone.id)}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["drone_id"] == str(drone.id)


async def test_a_mission_can_still_be_saved_after_its_drone_takes_off(
    client, admin_headers, admin_user: User, assigned_mission: Mission
):
    drone = await a_drone(admin_user)
    await client.patch(
        f"/missions/{assigned_mission.id}", json={"drone_id": str(drone.id)}, headers=admin_headers
    )
    drone.status = DroneStatus.IN_FLIGHT
    await drone.save()

    # the booking has not changed, so the status check must not fire on every save
    resp = await client.patch(
        f"/missions/{assigned_mission.id}",
        json={"name": "Renamed", "drone_id": str(drone.id)},
        headers=admin_headers,
    )

    assert resp.status_code == 200


async def test_the_aircraft_can_always_be_handed_back(
    client, admin_headers, admin_user: User, assigned_mission: Mission
):
    drone = await a_drone(admin_user)
    await client.patch(
        f"/missions/{assigned_mission.id}", json={"drone_id": str(drone.id)}, headers=admin_headers
    )

    resp = await client.patch(
        f"/missions/{assigned_mission.id}", json={"drone_id": None}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["drone_id"] is None
