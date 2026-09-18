from app.models.drone import Drone
from app.models.mission import Mission, MissionStatus
from app.models.user import User


async def a_drone(admin: User, name: str = "Falcon 1") -> Drone:
    drone = Drone(name=name, model="Matrice 350 RTK", owner_id=str(admin.id))
    await drone.insert()
    return drone


async def a_mission(admin: User, name: str, status=MissionStatus.DRAFT, drone_id=None) -> Mission:
    mission = Mission(name=name, owner_id=str(admin.id), status=status, drone_id=drone_id)
    await mission.insert()
    return mission


async def test_a_drone_booked_elsewhere_cannot_be_booked_again(
    client, admin_headers, admin_user: User
):
    drone = await a_drone(admin_user)
    await a_mission(admin_user, "First", drone_id=str(drone.id))
    second = await a_mission(admin_user, "Second")

    resp = await client.patch(
        f"/missions/{second.id}", json={"drone_id": str(drone.id)}, headers=admin_headers
    )

    assert resp.status_code == 409
    assert "First" in resp.json()["detail"]


async def test_a_draft_holds_its_booking_too(client, admin_headers, admin_user: User):
    # a draft is still a claim on the aircraft, otherwise two plans fight over it
    drone = await a_drone(admin_user)
    await a_mission(admin_user, "Planned", status=MissionStatus.DRAFT, drone_id=str(drone.id))
    second = await a_mission(admin_user, "Second")

    resp = await client.patch(
        f"/missions/{second.id}", json={"drone_id": str(drone.id)}, headers=admin_headers
    )

    assert resp.status_code == 409


async def test_a_finished_mission_gives_the_drone_back(client, admin_headers, admin_user: User):
    drone = await a_drone(admin_user)
    await a_mission(admin_user, "Flown", status=MissionStatus.COMPLETED, drone_id=str(drone.id))
    second = await a_mission(admin_user, "Second")

    resp = await client.patch(
        f"/missions/{second.id}", json={"drone_id": str(drone.id)}, headers=admin_headers
    )

    assert resp.status_code == 200


async def test_rebooking_the_same_drone_on_the_same_mission_is_fine(
    client, admin_headers, admin_user: User
):
    drone = await a_drone(admin_user)
    mission = await a_mission(admin_user, "Mine", drone_id=str(drone.id))

    resp = await client.patch(
        f"/missions/{mission.id}",
        json={"name": "Renamed", "drone_id": str(drone.id)},
        headers=admin_headers,
    )

    assert resp.status_code == 200


async def test_handing_it_back_frees_it_for_another_mission(
    client, admin_headers, admin_user: User
):
    drone = await a_drone(admin_user)
    first = await a_mission(admin_user, "First", drone_id=str(drone.id))
    second = await a_mission(admin_user, "Second")

    await client.patch(f"/missions/{first.id}", json={"drone_id": None}, headers=admin_headers)
    resp = await client.patch(
        f"/missions/{second.id}", json={"drone_id": str(drone.id)}, headers=admin_headers
    )

    assert resp.status_code == 200


async def test_the_fleet_says_which_mission_has_each_drone(
    client, admin_headers, admin_user: User
):
    booked = await a_drone(admin_user, "Booked")
    free = await a_drone(admin_user, "Free")
    mission = await a_mission(admin_user, "Survey", drone_id=str(booked.id))

    rows = {d["name"]: d for d in (await client.get("/drones", headers=admin_headers)).json()}

    assert rows["Booked"]["booked_on"] == str(mission.id)
    assert rows["Free"]["booked_on"] is None


async def test_a_single_drone_read_says_so_as_well(client, admin_headers, admin_user: User):
    drone = await a_drone(admin_user)
    mission = await a_mission(admin_user, "Survey", drone_id=str(drone.id))

    resp = await client.get(f"/drones/{drone.id}", headers=admin_headers)

    assert resp.json()["booked_on"] == str(mission.id)


async def test_a_completed_mission_does_not_keep_showing_as_the_holder(
    client, admin_headers, admin_user: User
):
    drone = await a_drone(admin_user)
    await a_mission(admin_user, "Flown", status=MissionStatus.COMPLETED, drone_id=str(drone.id))

    resp = await client.get(f"/drones/{drone.id}", headers=admin_headers)

    assert resp.json()["booked_on"] is None
