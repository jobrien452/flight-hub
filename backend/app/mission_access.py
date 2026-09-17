from beanie import PydanticObjectId
from fastapi import HTTPException, status

from app.deps import CurrentUser
from app.models.mission import Mission, MissionStatus
from app.models.user import Role


async def get_owned_mission(mission_id: str, current_user: CurrentUser) -> Mission:
    try:
        oid = PydanticObjectId(mission_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    mission = await Mission.get(oid)
    if mission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    # a mission that is not yours reads as missing rather than forbidden, since a
    # 403 would confirm it exists to anyone walking ids
    owns = (
        mission.owner_id == current_user.user_id
        if current_user.role == Role.ADMIN
        else current_user.user_id in mission.assigned_pilot_ids
    )
    if not owns:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    # a draft is the admin's working copy, it does not exist as far as a pilot is concerned
    if current_user.role == Role.PILOT and mission.status == MissionStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return mission
