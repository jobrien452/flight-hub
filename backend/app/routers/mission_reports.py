from datetime import datetime, timezone

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import CurrentUser, get_current_user
from app.mission_access import get_owned_mission
from app.models.mission_report import MissionReport
from app.models.user import Role
from app.schemas.mission_report import MissionReportCreate, MissionReportOut, MissionReportUpdate

router = APIRouter(prefix="/missions", tags=["mission-reports"])


def _out(report: MissionReport) -> MissionReportOut:
    return MissionReportOut(**report.model_dump(exclude={"id"}), id=str(report.id))


async def _get_own_report(mission_id: str, report_id: str, current_user: CurrentUser) -> MissionReport:
    try:
        oid = PydanticObjectId(report_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    report = await MissionReport.get(oid)
    if report is None or report.mission_id != mission_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if report.pilot_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    return report


@router.get("/{mission_id}/reports", response_model=list[MissionReportOut])
async def list_reports(
    mission_id: str, current_user: CurrentUser = Depends(get_current_user)
) -> list[MissionReportOut]:
    await get_owned_mission(mission_id, current_user)
    if current_user.role == Role.ADMIN:
        reports = await MissionReport.find(MissionReport.mission_id == mission_id).to_list()
    else:
        reports = await MissionReport.find(
            MissionReport.mission_id == mission_id,
            MissionReport.pilot_id == current_user.user_id,
        ).to_list()
    return [_out(r) for r in reports]


@router.post(
    "/{mission_id}/reports", response_model=MissionReportOut, status_code=status.HTTP_201_CREATED
)
async def create_report(
    mission_id: str,
    payload: MissionReportCreate,
    current_user: CurrentUser = Depends(get_current_user),
) -> MissionReportOut:
    if current_user.role != Role.PILOT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    await get_owned_mission(mission_id, current_user)  # 403 if not assigned, 404 if missing
    report = MissionReport(
        mission_id=mission_id, pilot_id=current_user.user_id, **payload.model_dump()
    )
    await report.insert()
    return _out(report)


@router.patch("/{mission_id}/reports/{report_id}", response_model=MissionReportOut)
async def update_report(
    mission_id: str,
    report_id: str,
    payload: MissionReportUpdate,
    current_user: CurrentUser = Depends(get_current_user),
) -> MissionReportOut:
    if current_user.role != Role.PILOT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    report = await _get_own_report(mission_id, report_id, current_user)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(report, field, value)
    report.updated_at = datetime.now(timezone.utc)
    await report.save()
    return _out(report)
