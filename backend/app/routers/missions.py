import logging
from datetime import datetime, timezone

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import CurrentUser, get_current_user, require_admin
from app.email_client import send_mission_assigned_email, send_mission_unassigned_email
from app.mission_access import get_owned_mission
from app.models.mission import (
    ACKNOWLEDGEABLE,
    STARTABLE,
    Mission,
    MissionStatus,
)
from app.models.user import Role, User
from app.schemas.mission import (
    MissionAssign,
    MissionCreate,
    MissionOut,
    MissionUnassign,
    MissionUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/missions", tags=["missions"])


def _out(mission: Mission) -> MissionOut:
    return MissionOut(**mission.model_dump(exclude={"id"}), id=str(mission.id))


async def _get_pilot(pilot_id: str) -> User:
    try:
        oid = PydanticObjectId(pilot_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    pilot = await User.get(oid)
    if pilot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if pilot.role != Role.PILOT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="not a pilot")
    return pilot


def _notify(send, to_email: str, mission: Mission, message: str | None) -> None:
    # the assignment itself is already saved, a dead SMTP box shouldn't undo it
    try:
        send(to_email, mission.name, str(mission.id), message)
    except Exception:
        logger.exception("failed to email %s about mission %s", to_email, mission.id)


@router.get("", response_model=list[MissionOut])
async def list_missions(current_user: CurrentUser = Depends(get_current_user)) -> list[MissionOut]:
    # an admin's missions are their own, a pilot's are whatever they are flying
    if current_user.role == Role.ADMIN:
        missions = await Mission.find(Mission.owner_id == current_user.user_id).to_list()
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


@router.post("/{mission_id}/publish", response_model=MissionOut)
async def publish_mission(
    mission_id: str, current_user: CurrentUser = Depends(require_admin)
) -> MissionOut:
    mission = await get_owned_mission(mission_id, current_user)
    if mission.status != MissionStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="only a draft can be published"
        )
    if not mission.waypoints:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="a mission needs waypoints to publish"
        )
    mission.status = MissionStatus.PUBLISHED
    mission.updated_at = datetime.now(timezone.utc)
    await mission.save()
    return _out(mission)


async def _pilot_advance(
    mission_id: str,
    current_user: CurrentUser,
    allowed_from: set[MissionStatus],
    to: MissionStatus,
) -> MissionOut:
    if current_user.role != Role.PILOT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="pilots only")

    mission = await get_owned_mission(mission_id, current_user)  # 403 unless assigned
    if mission.status not in allowed_from:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"a {mission.status.value} mission cannot move to {to.value}",
        )

    mission.status = to
    mission.updated_at = datetime.now(timezone.utc)
    await mission.save()
    return _out(mission)


@router.post("/{mission_id}/acknowledge", response_model=MissionOut)
async def acknowledge_mission(
    mission_id: str, current_user: CurrentUser = Depends(get_current_user)
) -> MissionOut:
    return await _pilot_advance(
        mission_id, current_user, ACKNOWLEDGEABLE, MissionStatus.ACKNOWLEDGED
    )


@router.post("/{mission_id}/start", response_model=MissionOut)
async def start_mission(
    mission_id: str, current_user: CurrentUser = Depends(get_current_user)
) -> MissionOut:
    return await _pilot_advance(mission_id, current_user, STARTABLE, MissionStatus.IN_FLIGHT)


@router.post("/{mission_id}/assignments", response_model=MissionOut)
async def assign_pilot(
    mission_id: str,
    payload: MissionAssign,
    current_user: CurrentUser = Depends(require_admin),
) -> MissionOut:
    mission = await get_owned_mission(mission_id, current_user)
    pilot = await _get_pilot(payload.pilot_id)
    if payload.pilot_id in mission.assigned_pilot_ids:
        return _out(mission)

    mission.assigned_pilot_ids.append(payload.pilot_id)
    mission.updated_at = datetime.now(timezone.utc)
    await mission.save()
    _notify(
        send_mission_assigned_email, pilot.email, mission, payload.message
    )
    return _out(mission)


@router.delete("/{mission_id}/assignments/{pilot_id}", response_model=MissionOut)
async def unassign_pilot(
    mission_id: str,
    pilot_id: str,
    payload: MissionUnassign | None = None,
    current_user: CurrentUser = Depends(require_admin),
) -> MissionOut:
    mission = await get_owned_mission(mission_id, current_user)
    pilot = await _get_pilot(pilot_id)
    if pilot_id not in mission.assigned_pilot_ids:
        return _out(mission)

    mission.assigned_pilot_ids.remove(pilot_id)
    mission.updated_at = datetime.now(timezone.utc)
    await mission.save()
    _notify(
        send_mission_unassigned_email,
        pilot.email,
        mission,
        payload.message if payload else None,
    )
    return _out(mission)


@router.delete("/{mission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mission(
    mission_id: str, current_user: CurrentUser = Depends(require_admin)
) -> None:
    mission = await get_owned_mission(mission_id, current_user)
    if mission.assigned_pilot_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="unassign every pilot before deleting this mission",
        )
    await mission.delete()
