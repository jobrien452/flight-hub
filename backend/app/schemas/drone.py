from datetime import datetime

from pydantic import BaseModel

from app.models.drone import DroneStatus


class DroneCreate(BaseModel):
    name: str
    model: str = ""
    serial: str = ""
    stream_url: str = ""
    status: DroneStatus = DroneStatus.AVAILABLE


class DroneUpdate(BaseModel):
    # flight hours and missions flown are not here, those only move when a
    # pilot files a report, never because a client sent a number
    name: str | None = None
    model: str | None = None
    serial: str | None = None
    stream_url: str | None = None
    status: DroneStatus | None = None


class DroneOut(BaseModel):
    id: str
    name: str
    model: str
    serial: str
    stream_url: str = ""
    status: DroneStatus
    owner_id: str
    flight_hours: float
    missions_flown: int
    # the mission holding this aircraft, so the ui can keep it out of other plans
    booked_on: str | None = None
    # deleted and out of the fleet, still readable for the missions it flew
    hidden: bool = False
    created_at: datetime
    updated_at: datetime
