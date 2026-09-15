from beanie import PydanticObjectId
from fastapi import HTTPException, status

from app.deps import CurrentUser
from app.models.mission import Mission
from app.models.user import Role


async def get_owned_mission(mission_id: str, current_user: CurrentUser) -> Mission:
    try:
        oid = PydanticObjectId(mission_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    mission = await Mission.get(oid)
    if mission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if current_user.role == Role.PILOT and current_user.user_id not in mission.assigned_pilot_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    return mission
