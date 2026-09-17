from beanie import PydanticObjectId
from fastapi import HTTPException, status

from app.deps import CurrentUser
from app.models.drone import Drone
from app.models.mission import Mission, MissionStatus
from app.models.user import Role


async def _load(drone_id: str) -> Drone:
    try:
        oid = PydanticObjectId(drone_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    drone = await Drone.get(oid)
    if drone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return drone


async def get_owned_drone(drone_id: str, current_user: CurrentUser) -> Drone:
    # a fleet belongs to the admin who added it, same as their missions
    drone = await _load(drone_id)
    if drone.owner_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return drone


async def get_visible_drone(drone_id: str, current_user: CurrentUser) -> Drone:
    drone = await _load(drone_id)
    if current_user.role == Role.ADMIN:
        if drone.owner_id != current_user.user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        return drone

    # a pilot only knows about the aircraft on missions they are actually flying
    flying = await Mission.find(
        Mission.assigned_pilot_ids == current_user.user_id,
        Mission.drone_id == str(drone.id),
        Mission.status != MissionStatus.DRAFT,
    ).first_or_none()
    if flying is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return drone
