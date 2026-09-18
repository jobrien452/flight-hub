from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.models.mission import Mission, MissionStatus, Payload, PlanParams, Waypoint

# a mission is referred to by name everywhere it appears, in a pilot's queue and
# in the mail they get, so an unnamed one is not a thing worth having
MissionName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class MissionCreate(BaseModel):
    # no status here, everything starts as a draft and moves on through the
    # publish route and pilot reports, never by the client naming a state
    name: MissionName
    assigned_pilot_ids: list[str] = Field(default_factory=list)
    drone_id: str | None = None
    payload: Payload | None = None
    waypoints: list[Waypoint] = Field(default_factory=list)
    plan_params: PlanParams | None = Field(default=None, discriminator="type")


class MissionUpdate(BaseModel):
    # all optional, only sent fields get applied
    # sending it is optional, sending an empty one is not
    name: MissionName | None = None
    assigned_pilot_ids: list[str] | None = None
    drone_id: str | None = None
    payload: Payload | None = None
    waypoints: list[Waypoint] | None = None
    plan_params: PlanParams | None = Field(default=None, discriminator="type")


class MissionAssign(BaseModel):
    pilot_id: str
    # optional note from the admin, passed straight through to the pilot's email
    message: str | None = None


class MissionUnassign(BaseModel):
    message: str | None = None


class MissionSummaryOut(BaseModel):
    # what the mission table needs. the route itself can run to thousands of
    # points, so it is fetched per mission rather than shipped with every row
    id: str
    name: str
    status: MissionStatus
    owner_id: str
    assigned_pilot_ids: list[str]
    drone_id: str | None = None
    waypoint_count: int
    created_at: datetime
    updated_at: datetime


class MissionOut(MissionSummaryOut):
    payload: Payload | None = None
    waypoints: list[Waypoint]
    plan_params: PlanParams | None = Field(default=None, discriminator="type")


def mission_summary(mission: Mission) -> MissionSummaryOut:
    return MissionSummaryOut(
        **mission.model_dump(exclude={"id", "waypoints", "plan_params", "payload"}),
        id=str(mission.id),
        waypoint_count=len(mission.waypoints),
    )


def mission_out(mission: Mission) -> MissionOut:
    return MissionOut(
        **mission.model_dump(exclude={"id"}),
        id=str(mission.id),
        waypoint_count=len(mission.waypoints),
    )
