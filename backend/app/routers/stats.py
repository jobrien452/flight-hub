from fastapi import APIRouter, Depends

from app.deps import CurrentUser, require_admin
from app.models.drone import Drone, DroneStatus
from app.models.mission import Mission, MissionStatus
from app.models.mission_report import MissionReport, MissionReportStatus
from app.models.user import Role, User
from app.schemas.stats import DashboardStats, PilotStat

router = APIRouter(prefix="/stats", tags=["stats"])


def _minutes(report: MissionReport) -> float:
    # report data is free form, a duration is only counted when one was actually given
    minutes = report.data.get("duration_minutes")
    return float(minutes) if isinstance(minutes, (int, float)) else 0.0


@router.get("", response_model=DashboardStats)
async def dashboard(current_user: CurrentUser = Depends(require_admin)) -> DashboardStats:
    missions = await Mission.find(Mission.owner_id == current_user.user_id).to_list()
    drones = await Drone.find(Drone.owner_id == current_user.user_id).to_list()
    # the pilot pool is shared, so every pilot gets a row and the numbers are this admin's
    pilots = await User.find(User.role == Role.PILOT).to_list()

    mission_ids = {str(m.id) for m in missions}
    reports = [r for r in await MissionReport.find_all().to_list() if r.mission_id in mission_ids]

    # zeroed first so a quiet state still shows up rather than dropping out of the chart
    by_status = {status.value: 0 for status in MissionStatus}
    for mission in missions:
        by_status[mission.status.value] += 1

    drones_by_status = {status.value: 0 for status in DroneStatus}
    for drone in drones:
        drones_by_status[drone.status.value] += 1

    pilot_rows = []
    for pilot in pilots:
        pilot_id = str(pilot.id)
        submitted = [
            r
            for r in reports
            if r.pilot_id == pilot_id and r.status == MissionReportStatus.SUBMITTED
        ]
        pilot_rows.append(
            PilotStat(
                pilot_id=pilot_id,
                name=pilot.name,
                email=pilot.email,
                missions_assigned=sum(1 for m in missions if pilot_id in m.assigned_pilot_ids),
                reports_submitted=len(submitted),
                flight_hours=round(sum(_minutes(r) for r in submitted) / 60, 2),
            )
        )

    return DashboardStats(
        missions_total=len(missions),
        missions_by_status=by_status,
        drones_total=len(drones),
        drones_by_status=drones_by_status,
        fleet_flight_hours=round(sum(d.flight_hours for d in drones), 2),
        fleet_missions_flown=sum(d.missions_flown for d in drones),
        pilots=sorted(pilot_rows, key=lambda p: p.name),
    )
