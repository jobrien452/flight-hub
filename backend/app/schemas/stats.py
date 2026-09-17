from pydantic import BaseModel


class PilotStat(BaseModel):
    pilot_id: str
    name: str
    email: str
    missions_assigned: int
    reports_submitted: int
    flight_hours: float


class DashboardStats(BaseModel):
    # every count here is scoped to the admin asking, same as their mission list
    missions_total: int
    missions_by_status: dict[str, int]
    drones_total: int
    drones_by_status: dict[str, int]
    fleet_flight_hours: float
    fleet_missions_flown: int
    pilots: list[PilotStat]
