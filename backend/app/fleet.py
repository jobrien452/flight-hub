from datetime import datetime, timezone

from app.ids import to_object_id
from app.models.drone import Drone, DroneStatus

# everything here is best effort, a mission that has no drone booked against it
# still flies and still completes, it just has nothing to keep a twin of


async def _load(drone_id: str | None) -> Drone | None:
    oid = to_object_id(drone_id)
    return await Drone.get(oid) if oid else None


async def _save(drone: Drone) -> None:
    drone.updated_at = datetime.now(timezone.utc)
    await drone.save()


async def set_drone_status(drone_id: str | None, status: DroneStatus) -> None:
    drone = await _load(drone_id)
    if drone is None:
        return
    # an aircraft the admin pulled for maintenance is not dragged back by a mission
    if drone.status == DroneStatus.RETIRED:
        return
    drone.status = status
    await _save(drone)


async def log_flight_time(drone_id: str | None, minutes: float) -> None:
    drone = await _load(drone_id)
    if drone is None or minutes <= 0:
        return
    # rounded so the fleet table shows hours rather than float noise
    drone.flight_hours = round(drone.flight_hours + minutes / 60, 2)
    await _save(drone)


async def log_mission_flown(drone_id: str | None) -> None:
    drone = await _load(drone_id)
    if drone is None:
        return
    drone.missions_flown += 1
    await _save(drone)
