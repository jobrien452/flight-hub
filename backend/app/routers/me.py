from fastapi import APIRouter, Depends

from app.deps import CurrentUser, get_current_user
from app.models.mission import Mission, MissionStatus
from app.models.mission_report import MissionReport
from app.models.user import Role
from app.schemas.mission import MissionOut
from app.schemas.mission_report import MissionReportOut

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/missions", response_model=list[MissionOut])
async def my_missions(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[MissionOut]:
    # a pilot's own work queue, or everything an admin owns
    if current_user.role == Role.PILOT:
        missions = await Mission.find(
            Mission.assigned_pilot_ids == current_user.user_id,
            Mission.status != MissionStatus.DRAFT,
        ).to_list()
    else:
        missions = await Mission.find(Mission.owner_id == current_user.user_id).to_list()
    return [MissionOut(**m.model_dump(exclude={"id"}), id=str(m.id)) for m in missions]


@router.get("/reports", response_model=list[MissionReportOut])
async def my_reports(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[MissionReportOut]:
    # every report this pilot has filed, without walking mission by mission
    reports = await MissionReport.find(
        MissionReport.pilot_id == current_user.user_id
    ).to_list()
    return [MissionReportOut(**r.model_dump(exclude={"id"}), id=str(r.id)) for r in reports]
