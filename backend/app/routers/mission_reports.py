from datetime import datetime, timezone

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.ids import to_object_id
from app.deps import CurrentUser, get_current_user
from app.fleet import log_flight_time, log_mission_flown, set_drone_status
from app.mission_access import get_owned_mission
from app.models.drone import DroneStatus
from app.models.mission import OPEN_STATUSES, Mission, MissionStatus
from app.models.mission_report import MissionReport, MissionReportStatus
from app.models.user import Role
from app.schemas.mission_report import MissionReportCreate, MissionReportOut, MissionReportUpdate

router = APIRouter(prefix="/missions", tags=["mission-reports"])


def _out(report: MissionReport) -> MissionReportOut:
    return MissionReportOut(**report.model_dump(exclude={"id"}), id=str(report.id))


async def _complete_if_everyone_reported(mission_id: str) -> None:
    # a mission is done once every assigned pilot has filed, one pilot finishing
    # early doesn't finish the job for the rest
    mission = await Mission.get(PydanticObjectId(mission_id))
    if mission is None or mission.status not in OPEN_STATUSES:
        return

    submitted = await MissionReport.find(
        MissionReport.mission_id == mission_id,
        MissionReport.status == MissionReportStatus.SUBMITTED,
    ).to_list()
    reported = {r.pilot_id for r in submitted}
    if not set(mission.assigned_pilot_ids).issubset(reported):
        return

    mission.status = MissionStatus.COMPLETED
    mission.updated_at = datetime.now(timezone.utc)
    await mission.save()

    # the job is over, so the aircraft comes back into the pool with one more flight on it
    await set_drone_status(mission.drone_id, DroneStatus.AVAILABLE)
    await log_mission_flown(mission.drone_id)


async def _on_submitted(mission_id: str, report: MissionReport) -> None:
    mission = await Mission.get(PydanticObjectId(mission_id))
    if mission is not None:
        minutes = report.data.get("duration_minutes")
        if isinstance(minutes, (int, float)):
            await log_flight_time(mission.drone_id, float(minutes))
    await _complete_if_everyone_reported(mission_id)


async def _get_own_report(mission_id: str, report_id: str, current_user: CurrentUser) -> MissionReport:
    oid = to_object_id(report_id)
    if oid is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    report = await MissionReport.get(oid)
    if report is None or report.mission_id != mission_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    # another pilot's report reads as missing, same as a mission that is not yours
    if report.pilot_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
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
    await get_owned_mission(mission_id, current_user)  # 404 unless this pilot is on it

    # one report per pilot per mission. the index enforces it, this says so in
    # a way the caller can act on rather than as a write that blows up
    existing = await MissionReport.find_one(
        MissionReport.mission_id == mission_id,
        MissionReport.pilot_id == current_user.user_id,
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="you have already filed a report for this mission, edit that one",
        )

    report = MissionReport(
        mission_id=mission_id, pilot_id=current_user.user_id, **payload.model_dump()
    )
    if report.status == MissionReportStatus.SUBMITTED:
        report.submitted_at = report.updated_at
    try:
        await report.insert()
    except DuplicateKeyError:
        # two requests raced past the check above, the index caught the loser
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="you have already filed a report for this mission, edit that one",
        )

    # a pilot can file and submit in one go, that still finishes the mission
    if report.status == MissionReportStatus.SUBMITTED:
        await _on_submitted(mission_id, report)
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
    # the flight is only banked as it is handed in, editing it afterwards must
    # not add its hours to the aircraft a second time
    already_submitted = report.status == MissionReportStatus.SUBMITTED
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(report, field, value)
    report.updated_at = datetime.now(timezone.utc)
    if report.status == MissionReportStatus.SUBMITTED and report.submitted_at is None:
        report.submitted_at = report.updated_at
    await report.save()

    if report.status == MissionReportStatus.SUBMITTED and not already_submitted:
        await _on_submitted(mission_id, report)
    return _out(report)
