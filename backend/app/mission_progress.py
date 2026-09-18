from datetime import datetime, timezone

from app.fleet import log_mission_flown, set_drone_status
from app.ids import to_object_id
from app.models.drone import DroneStatus
from app.models.mission import OPEN_STATUSES, Mission, MissionStatus
from app.models.mission_report import MissionReport, MissionReportStatus


async def complete_if_everyone_reported(mission_id: str) -> None:
    # a mission is done once every assigned pilot has filed, one pilot finishing
    # early doesn't finish the job for the rest
    oid = to_object_id(mission_id)
    mission = await Mission.get(oid) if oid else None
    if mission is None or mission.status not in OPEN_STATUSES:
        return

    submitted = await MissionReport.find(
        MissionReport.mission_id == mission_id,
        MissionReport.status == MissionReportStatus.SUBMITTED,
    ).to_list()
    # losing the last assigned pilot leaves nobody to wait on, which is not the
    # same as the job being flown
    if not submitted:
        return
    reported = {r.pilot_id for r in submitted}
    if not set(mission.assigned_pilot_ids).issubset(reported):
        return

    mission.status = MissionStatus.COMPLETED
    mission.updated_at = datetime.now(timezone.utc)
    await mission.save()

    # the job is over, so the aircraft comes back into the pool with one more flight on it
    await set_drone_status(mission.drone_id, DroneStatus.AVAILABLE)
    await log_mission_flown(mission.drone_id)
