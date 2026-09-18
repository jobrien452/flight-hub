from app.models.drone import Drone, DroneStatus
from app.models.mission import Mission, MissionStatus
from app.models.user import User


async def a_drone(admin: User, **kwargs) -> Drone:
    drone = Drone(name="Falcon 1", owner_id=str(admin.id), **kwargs)
    await drone.insert()
    return drone


async def a_mission(admin: User, drone: Drone, status: MissionStatus) -> Mission:
    mission = Mission(
        name="Survey Site A",
        owner_id=str(admin.id),
        drone_id=str(drone.id),
        status=status,
        waypoints=[],
    )
    await mission.insert()
    return mission


async def test_a_drone_that_never_flew_is_deleted_outright(
    client, admin_headers, admin_user: User
):
    drone = await a_drone(admin_user)

    resp = await client.delete(f"/drones/{drone.id}", headers=admin_headers)

    assert resp.status_code == 204
    assert await Drone.get(drone.id) is None


async def test_a_drone_with_hours_on_it_is_kept_and_hidden(
    client, admin_headers, admin_user: User
):
    drone = await a_drone(admin_user, missions_flown=3, flight_hours=12.5)

    resp = await client.delete(f"/drones/{drone.id}", headers=admin_headers)

    assert resp.status_code == 204
    kept = await Drone.get(drone.id)
    assert kept is not None
    # retired is the whole of it, there is no second flag saying the same thing
    assert kept.status == DroneStatus.RETIRED
    # the record a mission's stats lean on is untouched
    assert kept.flight_hours == 12.5
    assert kept.missions_flown == 3


async def test_a_drone_that_flew_a_mission_is_kept_even_with_no_hours_logged(
    client, admin_headers, admin_user: User
):
    drone = await a_drone(admin_user)
    await a_mission(admin_user, drone, MissionStatus.COMPLETED)

    await client.delete(f"/drones/{drone.id}", headers=admin_headers)

    assert await Drone.get(drone.id) is not None


async def test_a_completed_mission_keeps_pointing_at_the_aircraft_that_flew_it(
    client, admin_headers, admin_user: User
):
    drone = await a_drone(admin_user, missions_flown=1)
    mission = await a_mission(admin_user, drone, MissionStatus.COMPLETED)

    await client.delete(f"/drones/{drone.id}", headers=admin_headers)

    flown = await Mission.get(mission.id)
    assert flown.drone_id == str(drone.id)
    assert flown.status == MissionStatus.COMPLETED


async def test_a_draft_loses_the_aircraft_and_stays_a_draft(
    client, admin_headers, admin_user: User
):
    drone = await a_drone(admin_user)
    mission = await a_mission(admin_user, drone, MissionStatus.DRAFT)

    await client.delete(f"/drones/{drone.id}", headers=admin_headers)

    unbooked = await Mission.get(mission.id)
    assert unbooked.drone_id is None
    assert unbooked.status == MissionStatus.DRAFT


async def test_a_planned_mission_goes_back_to_draft(client, admin_headers, admin_user: User):
    drone = await a_drone(admin_user)
    mission = await a_mission(admin_user, drone, MissionStatus.PUBLISHED)

    await client.delete(f"/drones/{drone.id}", headers=admin_headers)

    pulled = await Mission.get(mission.id)
    assert pulled.drone_id is None
    # nothing can be flown without an aircraft, so it cannot stay published
    assert pulled.status == MissionStatus.DRAFT


async def test_the_fleet_list_leaves_a_retired_drone_out(
    client, admin_headers, admin_user: User
):
    kept = await a_drone(admin_user)
    gone = await a_drone(admin_user, missions_flown=2)
    await client.delete(f"/drones/{gone.id}", headers=admin_headers)

    resp = await client.get("/drones", headers=admin_headers)

    assert [d["id"] for d in resp.json()] == [str(kept.id)]


async def test_the_retired_ones_can_be_asked_for(client, admin_headers, admin_user: User):
    kept = await a_drone(admin_user)
    gone = await a_drone(admin_user, missions_flown=2)
    await client.delete(f"/drones/{gone.id}", headers=admin_headers)

    resp = await client.get("/drones?include_retired=true", headers=admin_headers)

    assert {d["id"] for d in resp.json()} == {str(kept.id), str(gone.id)}


async def test_an_aircraft_retired_by_hand_leaves_the_list_the_same_way(
    client, admin_headers, admin_user: User
):
    drone = await a_drone(admin_user)

    await client.patch(
        f"/drones/{drone.id}", json={"status": "retired"}, headers=admin_headers
    )

    assert (await client.get("/drones", headers=admin_headers)).json() == []


async def test_a_retired_aircraft_can_be_brought_back(client, admin_headers, admin_user: User):
    drone = await a_drone(admin_user, missions_flown=2)
    await client.delete(f"/drones/{drone.id}", headers=admin_headers)

    resp = await client.patch(
        f"/drones/{drone.id}", json={"status": "maintenance"}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert [d["id"] for d in (await client.get("/drones", headers=admin_headers)).json()] == [
        str(drone.id)
    ]


async def test_a_deleted_drone_can_still_be_read_by_id(client, admin_headers, admin_user: User):
    drone = await a_drone(admin_user, missions_flown=2)
    await client.delete(f"/drones/{drone.id}", headers=admin_headers)

    # the mission view looks its aircraft up this way and should still find it
    resp = await client.get(f"/drones/{drone.id}", headers=admin_headers)

    assert resp.status_code == 200
    assert resp.json()["status"] == "retired"


async def test_an_aircraft_can_be_removed_while_it_is_out_flying(
    client, admin_headers, admin_user: User
):
    drone = await a_drone(admin_user, status=DroneStatus.IN_FLIGHT)
    mission = await a_mission(admin_user, drone, MissionStatus.IN_FLIGHT)

    resp = await client.delete(f"/drones/{drone.id}", headers=admin_headers)

    assert resp.status_code == 204
    # deleting a row does not land an aircraft, the flight carries on as it was
    flying = await Mission.get(mission.id)
    assert flying.status == MissionStatus.IN_FLIGHT
    assert flying.drone_id == str(drone.id)
    kept = await Drone.get(drone.id)
    assert kept.status == DroneStatus.RETIRED


async def test_a_removed_aircraft_never_comes_back_to_available(
    client, admin_headers, admin_user: User
):
    from app.fleet import set_drone_status

    drone = await a_drone(admin_user, status=DroneStatus.IN_FLIGHT)
    await a_mission(admin_user, drone, MissionStatus.IN_FLIGHT)
    await client.delete(f"/drones/{drone.id}", headers=admin_headers)

    # the pilot lands and files, which is what would normally free the aircraft
    await set_drone_status(str(drone.id), DroneStatus.AVAILABLE)

    assert (await Drone.get(drone.id)).status == DroneStatus.RETIRED


async def test_the_hours_of_a_flight_still_land_on_a_removed_aircraft(
    client, admin_headers, admin_user: User
):
    from app.fleet import log_flight_time, log_mission_flown

    drone = await a_drone(admin_user, status=DroneStatus.IN_FLIGHT)
    await a_mission(admin_user, drone, MissionStatus.IN_FLIGHT)
    await client.delete(f"/drones/{drone.id}", headers=admin_headers)

    await log_flight_time(str(drone.id), 30)
    await log_mission_flown(str(drone.id))

    kept = await Drone.get(drone.id)
    assert kept.flight_hours == 0.5
    assert kept.missions_flown == 1


async def test_the_pilots_of_a_pulled_mission_are_told(
    client, admin_headers, admin_user: User, pilot_user: User, monkeypatch
):
    sent = []
    monkeypatch.setattr(
        "app.routers.drones.send_mission_withdrawn_email",
        lambda to, name, mission_id, message: sent.append((to, name)),
    )
    drone = await a_drone(admin_user)
    mission = await a_mission(admin_user, drone, MissionStatus.PUBLISHED)
    mission.assigned_pilot_ids = [str(pilot_user.id)]
    await mission.save()

    await client.delete(f"/drones/{drone.id}", headers=admin_headers)

    assert sent == [(pilot_user.email, mission.name)]


async def test_nobody_is_emailed_about_a_draft(
    client, admin_headers, admin_user: User, pilot_user: User, monkeypatch
):
    sent = []
    monkeypatch.setattr(
        "app.routers.drones.send_mission_withdrawn_email",
        lambda to, name, mission_id, message: sent.append(to),
    )
    drone = await a_drone(admin_user)
    mission = await a_mission(admin_user, drone, MissionStatus.DRAFT)
    mission.assigned_pilot_ids = [str(pilot_user.id)]
    await mission.save()

    await client.delete(f"/drones/{drone.id}", headers=admin_headers)

    # a draft was never in their queue, so there is nothing to withdraw
    assert sent == []
