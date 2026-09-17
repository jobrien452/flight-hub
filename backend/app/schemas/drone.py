from datetime import datetime

from pydantic import BaseModel

from app.models.drone import DroneStatus


class DroneCreate(BaseModel):
    name: str
    model: str = ""
    serial: str = ""
    status: DroneStatus = DroneStatus.AVAILABLE


class DroneUpdate(BaseModel):
    # flight hours and missions flown are not here, those only move when a
    # pilot files a report, never because a client sent a number
    name: str | None = None
    model: str | None = None
    serial: str | None = None
    status: DroneStatus | None = None


class DroneOut(BaseModel):
    id: str
    name: str
    model: str
    serial: str
    status: DroneStatus
    owner_id: str
    flight_hours: float
    missions_flown: int
    created_at: datetime
    updated_at: datetime
