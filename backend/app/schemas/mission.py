from datetime import datetime

from pydantic import BaseModel, Field

from app.models.mission import MissionStatus, PlanParams, Waypoint


class MissionCreate(BaseModel):
    name: str
    status: MissionStatus = MissionStatus.DRAFT
    assigned_pilot_ids: list[str] = Field(default_factory=list)
    waypoints: list[Waypoint] = Field(default_factory=list)
    plan_params: PlanParams | None = Field(default=None, discriminator="type")


class MissionUpdate(BaseModel):
    # all optional, only sent fields get applied
    name: str | None = None
    status: MissionStatus | None = None
    assigned_pilot_ids: list[str] | None = None
    waypoints: list[Waypoint] | None = None
    plan_params: PlanParams | None = Field(default=None, discriminator="type")


class MissionOut(BaseModel):
    id: str
    name: str
    status: MissionStatus
    owner_id: str
    assigned_pilot_ids: list[str]
    waypoints: list[Waypoint]
    plan_params: PlanParams | None = Field(default=None, discriminator="type")
    created_at: datetime
    updated_at: datetime
