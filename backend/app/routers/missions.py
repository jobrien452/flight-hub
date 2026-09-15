from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status

from app.deps import CurrentUser, get_current_user, require_admin
from app.mission_access import get_owned_mission
from app.models.mission import Mission
from app.models.user import Role
from app.schemas.mission import MissionCreate, MissionOut, MissionUpdate

router = APIRouter(prefix="/missions", tags=["missions"])


@router.get("", response_model=list[MissionOut])
async def list_missions(current_user: CurrentUser = Depends(get_current_user)) -> list[MissionOut]:
    if current_user.role == Role.ADMIN:
        missions = await Mission.find_all().to_list()
    else:
        missions = await Mission.find(
            Mission.assigned_pilot_ids == current_user.user_id
        ).to_list()
    return [MissionOut(**m.model_dump(exclude={"id"}), id=str(m.id)) for m in missions]


@router.get("/{mission_id}", response_model=MissionOut)
async def get_mission(
    mission_id: str, current_user: CurrentUser = Depends(get_current_user)
) -> MissionOut:
    mission = await get_owned_mission(mission_id, current_user)
    return MissionOut(**mission.model_dump(exclude={"id"}), id=str(mission.id))


@router.post("", response_model=MissionOut, status_code=status.HTTP_201_CREATED)
async def create_mission(
    payload: MissionCreate, current_user: CurrentUser = Depends(require_admin)
) -> MissionOut:
    mission = Mission(**payload.model_dump(), owner_id=current_user.user_id)
    await mission.insert()
    return MissionOut(**mission.model_dump(exclude={"id"}), id=str(mission.id))


@router.patch("/{mission_id}", response_model=MissionOut)
async def update_mission(
    mission_id: str,
    payload: MissionUpdate,
    current_user: CurrentUser = Depends(require_admin),
) -> MissionOut:
    mission = await get_owned_mission(mission_id, current_user)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(mission, field, value)
    mission.updated_at = datetime.now(timezone.utc)
    await mission.save()
    return MissionOut(**mission.model_dump(exclude={"id"}), id=str(mission.id))


@router.delete("/{mission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mission(
    mission_id: str, current_user: CurrentUser = Depends(require_admin)
) -> None:
    mission = await get_owned_mission(mission_id, current_user)
    await mission.delete()
