from datetime import datetime

from pydantic import BaseModel, Field

from app.models.mission_report import MissionReportStatus


class MissionReportCreate(BaseModel):
    status: MissionReportStatus = MissionReportStatus.IN_PROGRESS
    notes: str = ""
    data: dict = Field(default_factory=dict)


class MissionReportUpdate(BaseModel):
    status: MissionReportStatus | None = None
    notes: str | None = None
    data: dict | None = None


class MissionReportOut(BaseModel):
    id: str
    mission_id: str
    pilot_id: str
    status: MissionReportStatus
    notes: str
    data: dict
    submitted_at: datetime | None
    created_at: datetime
    updated_at: datetime
