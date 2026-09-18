from app.models.mission import Mission, MissionStatus


# a mission holds its aircraft from the moment it is drafted until it is flown.
# a completed mission is history, so it gives the drone back
def _held_by_query(owner_id: str):
    return Mission.find(
        Mission.owner_id == owner_id,
        Mission.status != MissionStatus.COMPLETED,
    )


async def holder_of(drone_id: str, owner_id: str, ignoring: str | None = None) -> Mission | None:
    """The mission currently holding this drone, if any."""
    missions = await _held_by_query(owner_id).to_list()
    for mission in missions:
        if mission.drone_id == drone_id and str(mission.id) != ignoring:
            return mission
    return None


async def bookings_by_drone(owner_id: str) -> dict[str, str]:
    """drone id to the mission holding it, for a whole fleet in one pass."""
    missions = await _held_by_query(owner_id).to_list()
    return {m.drone_id: str(m.id) for m in missions if m.drone_id}
