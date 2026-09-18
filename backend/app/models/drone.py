from datetime import datetime, timezone
from enum import Enum

from beanie import Document
from pydantic import Field


class DroneStatus(str, Enum):
    # available and in_flight move on their own as missions are flown, the other
    # two are the admin taking an aircraft out of rotation by hand
    AVAILABLE = "available"
    IN_FLIGHT = "in_flight"
    MAINTENANCE = "maintenance"
    RETIRED = "retired"


class Drone(Document):
    name: str
    model: str = ""
    serial: str = ""
    # where the aircraft puts its video, the jetson serves rtsp on the airframe
    stream_url: str = ""
    # retired is how an aircraft leaves the fleet, the record stays so the
    # missions it flew can still say what flew them
    status: DroneStatus = DroneStatus.AVAILABLE
    owner_id: str  # the admin whose fleet this belongs to
    # the digital twin's running totals, both fed by submitted pilot reports
    flight_hours: float = 0
    missions_flown: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "drones"
