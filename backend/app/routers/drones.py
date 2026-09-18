from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.bookings import bookings_by_drone, holder_of
from app.deps import CurrentUser, get_current_user, require_admin
from app.drone_access import get_owned_drone, get_visible_drone
from app.models.drone import Drone, DroneStatus
from app.models.mission import Mission, MissionStatus
from app.models.user import Role
from app.schemas.drone import DroneCreate, DroneOut, DroneUpdate

router = APIRouter(prefix="/drones", tags=["drones"])


def _out(drone: Drone, booked_on: str | None = None) -> DroneOut:
    return DroneOut(**drone.model_dump(exclude={"id"}), id=str(drone.id), booked_on=booked_on)


@router.get("", response_model=list[DroneOut])
async def list_drones(current_user: CurrentUser = Depends(get_current_user)) -> list[DroneOut]:
    if current_user.role == Role.ADMIN:
        drones = await Drone.find(Drone.owner_id == current_user.user_id).to_list()
        booked = await bookings_by_drone(current_user.user_id)
        return [_out(d, booked.get(str(d.id))) for d in drones]

    # a pilot's fleet view is whatever they are booked to fly
    missions = await Mission.find(
        Mission.assigned_pilot_ids == current_user.user_id,
        Mission.status != MissionStatus.DRAFT,
    ).to_list()
    drone_ids = {m.drone_id for m in missions if m.drone_id}
    drones = [await Drone.get(drone_id) for drone_id in drone_ids]
    return [_out(d) for d in drones if d is not None]


@router.post("", response_model=DroneOut, status_code=status.HTTP_201_CREATED)
async def create_drone(
    payload: DroneCreate, current_user: CurrentUser = Depends(require_admin)
) -> DroneOut:
    drone = Drone(**payload.model_dump(), owner_id=current_user.user_id)
    await drone.insert()
    return _out(drone)


@router.get("/{drone_id}", response_model=DroneOut)
async def get_drone(
    drone_id: str, current_user: CurrentUser = Depends(get_current_user)
) -> DroneOut:
    drone = await get_visible_drone(drone_id, current_user)
    holder = await holder_of(str(drone.id), drone.owner_id)
    return _out(drone, str(holder.id) if holder else None)


@router.patch("/{drone_id}", response_model=DroneOut)
async def update_drone(
    drone_id: str, payload: DroneUpdate, current_user: CurrentUser = Depends(require_admin)
) -> DroneOut:
    drone = await get_owned_drone(drone_id, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(drone, field, value)
    drone.updated_at = datetime.now(timezone.utc)
    await drone.save()
    return _out(drone)


@router.delete("/{drone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_drone(
    drone_id: str, current_user: CurrentUser = Depends(require_admin)
) -> None:
    drone = await get_owned_drone(drone_id, current_user)
    # an aircraft that is out on a job should not vanish from under the pilot
    if drone.status == DroneStatus.IN_FLIGHT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="this drone is out on a mission"
        )
    await drone.delete()
