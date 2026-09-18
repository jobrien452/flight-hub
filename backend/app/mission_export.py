"""A plan written out as QGC WPL 110, the waypoint file ArduPilot reads.

The F-11 runs ArduPilot with a Jetson alongside it, so a plan leaves here in the
format Mission Planner and mavproxy already load rather than anything of ours.
"""

from app.models.mission import Waypoint

HEADER = "QGC WPL 110"

# MAV_CMD numbers, named so the rows below can be read without the spec open
NAV_WAYPOINT = 16
DO_CHANGE_SPEED = 178
DO_DIGICAM_CONTROL = 203
DO_MOUNT_CONTROL = 205

FRAME_GLOBAL = 0
FRAME_RELATIVE_ALT = 3
MOUNT_MODE_MAVLINK = 2
SPEED_TYPE_GROUND = 1


def _row(index: int, command: int, frame: int, params: list[float], current: int = 0) -> str:
    # seven parameters, the last three being lat/lng/alt on a nav command and
    # plain parameters on a do command
    values = list(params) + [0.0] * (7 - len(params))
    cells = [index, current, frame, command, *values, 1]
    return "\t".join(
        str(cell) if isinstance(cell, int) else f"{cell:.8f}" for cell in cells
    )


# a do command runs when the nav command above it is reached, so where it sits
# decides whether it applies to the leg into a waypoint or the one out of it
def _before(point: Waypoint) -> list[tuple[int, list[float]]]:
    # speed is the leg flown into the point, the same way the editor reads it
    # when it works the flight time out
    if not point.speed:
        return []
    return [(DO_CHANGE_SPEED, [SPEED_TYPE_GROUND, point.speed])]


def _on_arrival(point: Waypoint) -> list[tuple[int, list[float]]]:
    actions: list[tuple[int, list[float]]] = []
    if point.gimbal_pitch is not None:
        actions.append((DO_MOUNT_CONTROL, [point.gimbal_pitch, 0, 0, 0, 0, 0, MOUNT_MODE_MAVLINK]))
    if point.photo or point.zoom:
        # one command carries both, zoom sits in param2 and the shutter in param5
        actions.append((DO_DIGICAM_CONTROL, [0, point.zoom or 0, 0, 0, 1 if point.photo else 0]))
    return actions


def to_qgc_wpl(waypoints: list[Waypoint]) -> str:
    rows = [HEADER]
    index = 0

    # every file opens with home. nothing in a plan says where the aircraft
    # takes off from, so the first waypoint stands in for it
    home = waypoints[0]
    rows.append(
        _row(
            index,
            NAV_WAYPOINT,
            FRAME_GLOBAL,
            [0, 0, 0, 0, home.lat, home.lng, home.alt],
            current=1,
        )
    )
    index += 1

    for point in waypoints:
        # a do command has no position of its own, so it carries the global
        # frame rather than claiming a height relative to home
        for command, params in _before(point):
            rows.append(_row(index, command, FRAME_GLOBAL, params))
            index += 1

        rows.append(
            _row(
                index,
                NAV_WAYPOINT,
                FRAME_RELATIVE_ALT,
                [0, 0, 0, point.heading or 0, point.lat, point.lng, point.alt],
            )
        )
        index += 1

        for command, params in _on_arrival(point):
            rows.append(_row(index, command, FRAME_GLOBAL, params))
            index += 1

    return "\n".join(rows) + "\n"
