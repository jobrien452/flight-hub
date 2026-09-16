from datetime import datetime, timezone
from enum import Enum
from typing import Literal, Union

from beanie import Document
from pydantic import BaseModel, Field


class MissionStatus(str, Enum):
    # draft --admin publishes--> published --a pilot picks it up--> acknowledged
    # --a pilot flies it--> in_flight --every pilot reports in--> completed
    #
    # the middle two move on the first pilot to act, they say work has begun.
    # completion is the strict one and waits for everybody
    DRAFT = "draft"
    PUBLISHED = "published"
    ACKNOWLEDGED = "acknowledged"
    IN_FLIGHT = "in_flight"
    COMPLETED = "completed"


# what a pilot may move a mission on from
ACKNOWLEDGEABLE = {MissionStatus.PUBLISHED}
STARTABLE = {MissionStatus.PUBLISHED, MissionStatus.ACKNOWLEDGED}
# a mission still awaiting reports, whatever stage of flying it has reached
OPEN_STATUSES = {MissionStatus.PUBLISHED, MissionStatus.ACKNOWLEDGED, MissionStatus.IN_FLIGHT}


class Waypoint(BaseModel):
    lat: float
    lng: float
    alt: float = 0
    heading: float | None = None
    speed: float | None = None


class WaypointPlanParams(BaseModel):
    # manual point placement, waypoints here are a pass-through to Mission.waypoints
    type: Literal["waypoint"] = "waypoint"
    waypoints: list[Waypoint] = Field(default_factory=list)


class SurveyPlanParams(BaseModel):
    # boundary + settings for a lawnmower sweep, generated client-side (see tmp/flight-path-planning.md)
    type: Literal["survey"] = "survey"
    boundary: list[Waypoint]
    altitude: float
    spacing: float
    heading: float | None = None


PlanParams = Union[WaypointPlanParams, SurveyPlanParams]


class Mission(Document):
    name: str
    status: MissionStatus = MissionStatus.DRAFT
    owner_id: str  # id of the admin who created it
    assigned_pilot_ids: list[str] = Field(default_factory=list)
    # the actual flight path, manually placed or generated, always concrete points
    waypoints: list[Waypoint] = Field(default_factory=list)
    # how the waypoints above were produced, kept so settings stay editable
    plan_params: PlanParams | None = Field(default=None, discriminator="type")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "missions"
