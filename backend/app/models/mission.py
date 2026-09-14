from datetime import datetime, timezone
from enum import Enum

from beanie import Document
from pydantic import BaseModel, Field


class MissionStatus(str, Enum):
    DRAFT = "draft"
    PLANNED = "planned"
    COMPLETE = "complete"


class Waypoint(BaseModel):
    lat: float
    lng: float
    alt: float = 0
    heading: float | None = None
    speed: float | None = None


class Mission(Document):
    name: str
    status: MissionStatus = MissionStatus.DRAFT
    owner_id: str  # id of the admin who created it
    assigned_pilot_ids: list[str] = Field(default_factory=list)
    waypoints: list[Waypoint] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "missions"
