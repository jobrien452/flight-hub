from datetime import datetime, timezone
from enum import Enum

from beanie import Document
from pydantic import Field
from pymongo import IndexModel


class MissionReportStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"


class MissionReport(Document):
    mission_id: str
    pilot_id: str
    status: MissionReportStatus = MissionReportStatus.IN_PROGRESS
    notes: str = ""
    data: dict = Field(default_factory=dict)  # whatever the pilot reports back, no fixed shape
    submitted_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "mission_reports"
        indexes = [IndexModel([("mission_id", 1), ("pilot_id", 1)], unique=True)]
