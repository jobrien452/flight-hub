from app.models.mission import Mission, Waypoint
from app.models.user import User

ROUTE = [
    {"lat": 47.1, "lng": -122.3, "alt": 40},
    {"lat": 47.2, "lng": -122.4, "alt": 50},
]


async def with_route(mission: Mission, route=None) -> Mission:
    mission.waypoints = [Waypoint(**w) for w in (route or ROUTE)]
    await mission.save()
    return mission


def lines(body: str) -> list[list[str]]:
    return [line.split("\t") for line in body.strip().splitlines()]


async def test_the_file_opens_with_the_qgc_header(
    client, admin_headers, flyable_mission: Mission
):
    await with_route(flyable_mission)

    resp = await client.get(f"/missions/{flyable_mission.id}/export", headers=admin_headers)

    assert resp.status_code == 200
    assert resp.text.splitlines()[0] == "QGC WPL 110"


async def test_it_comes_back_as_a_waypoints_file(client, admin_headers, flyable_mission: Mission):
    await with_route(flyable_mission)

    resp = await client.get(f"/missions/{flyable_mission.id}/export", headers=admin_headers)

    assert resp.headers["content-type"].startswith("text/plain")
    assert ".waypoints" in resp.headers["content-disposition"]


async def test_the_first_row_is_home_and_the_route_follows(
    client, admin_headers, flyable_mission: Mission
):
    await with_route(flyable_mission)

    resp = await client.get(f"/missions/{flyable_mission.id}/export", headers=admin_headers)

    rows = lines(resp.text)[1:]
    assert len(rows) == 3  # home, then the two waypoints
    home = rows[0]
    assert home[0] == "0"  # index
    assert home[1] == "1"  # the current waypoint, which is always home
    assert home[2] == "0"  # absolute frame, home is not relative to itself
    assert float(home[8]) == 47.1
    assert float(home[9]) == -122.3


async def test_the_route_flies_relative_to_home(client, admin_headers, flyable_mission: Mission):
    await with_route(flyable_mission)

    rows = lines((await client.get(
        f"/missions/{flyable_mission.id}/export", headers=admin_headers
    )).text)[1:]

    first = rows[1]
    assert first[0] == "1"
    assert first[2] == "3"  # MAV_FRAME_GLOBAL_RELATIVE_ALT
    assert first[3] == "16"  # MAV_CMD_NAV_WAYPOINT
    assert float(first[10]) == 40
    assert first[11] == "1"  # autocontinue


async def test_a_gimbal_angle_rides_along_after_its_waypoint(
    client, admin_headers, flyable_mission: Mission
):
    await with_route(flyable_mission, [{"lat": 1.0, "lng": 2.0, "alt": 30, "gimbal_pitch": -90}])

    rows = lines((await client.get(
        f"/missions/{flyable_mission.id}/export", headers=admin_headers
    )).text)[1:]

    mount = rows[2]  # home, the waypoint, then the command it carries
    assert mount[3] == "205"  # MAV_CMD_DO_MOUNT_CONTROL
    assert float(mount[4]) == -90


async def test_a_photo_and_a_zoom_share_one_camera_command(
    client, admin_headers, flyable_mission: Mission
):
    await with_route(
        flyable_mission, [{"lat": 1.0, "lng": 2.0, "alt": 30, "photo": True, "zoom": 4}]
    )

    rows = lines((await client.get(
        f"/missions/{flyable_mission.id}/export", headers=admin_headers
    )).text)[1:]

    camera = rows[2]
    assert camera[3] == "203"  # MAV_CMD_DO_DIGICAM_CONTROL
    assert float(camera[5]) == 4  # zoom position
    assert float(camera[8]) == 1  # shoot now


async def test_a_speed_change_is_set_on_the_way_in(client, admin_headers, flyable_mission: Mission):
    await with_route(flyable_mission, [{"lat": 1.0, "lng": 2.0, "alt": 30, "speed": 6}])

    rows = lines((await client.get(
        f"/missions/{flyable_mission.id}/export", headers=admin_headers
    )).text)[1:]

    # speed belongs to the leg flown into the point, so it is set before it and
    # not after, which is also how the editor works the flight time out
    speed = rows[1]
    assert speed[3] == "178"  # MAV_CMD_DO_CHANGE_SPEED
    assert float(speed[5]) == 6
    assert rows[2][3] == "16"  # the waypoint it applies to follows it


async def test_the_payload_commands_still_follow_their_waypoint(
    client, admin_headers, flyable_mission: Mission
):
    await with_route(
        flyable_mission,
        [{"lat": 1.0, "lng": 2.0, "alt": 30, "speed": 6, "gimbal_pitch": -90, "photo": True}],
    )

    rows = lines((await client.get(
        f"/missions/{flyable_mission.id}/export", headers=admin_headers
    )).text)[1:]

    # speed, the waypoint, then what the payload does once it is reached
    assert [row[3] for row in rows] == ["16", "178", "16", "205", "203"]


async def test_a_command_row_carries_no_frame_of_its_own(
    client, admin_headers, flyable_mission: Mission
):
    await with_route(flyable_mission, [{"lat": 1.0, "lng": 2.0, "alt": 30, "gimbal_pitch": -90}])

    rows = lines((await client.get(
        f"/missions/{flyable_mission.id}/export", headers=admin_headers
    )).text)[1:]

    # a do command has no position, so it takes the global frame like mission
    # planner writes rather than claiming a height relative to home
    assert rows[2][2] == "0"


async def test_the_rows_are_numbered_straight_through(
    client, admin_headers, flyable_mission: Mission
):
    await with_route(
        flyable_mission,
        [
            {"lat": 1.0, "lng": 2.0, "alt": 30},
            {"lat": 1.1, "lng": 2.1, "alt": 30, "photo": True},
            {"lat": 1.2, "lng": 2.2, "alt": 30},
        ],
    )

    rows = lines((await client.get(
        f"/missions/{flyable_mission.id}/export", headers=admin_headers
    )).text)[1:]

    assert [row[0] for row in rows] == [str(i) for i in range(len(rows))]


async def test_a_plain_waypoint_carries_no_commands(
    client, admin_headers, flyable_mission: Mission
):
    await with_route(flyable_mission, [{"lat": 1.0, "lng": 2.0, "alt": 30}])

    rows = lines((await client.get(
        f"/missions/{flyable_mission.id}/export", headers=admin_headers
    )).text)[1:]

    assert len(rows) == 2


async def test_a_mission_with_no_route_cannot_be_exported(
    client, admin_headers, flyable_mission: Mission
):
    resp = await client.get(f"/missions/{flyable_mission.id}/export", headers=admin_headers)

    assert resp.status_code == 409


async def test_the_pilot_flying_it_can_export_it(client, pilot_headers, flyable_mission: Mission):
    await with_route(flyable_mission)

    resp = await client.get(f"/missions/{flyable_mission.id}/export", headers=pilot_headers)

    assert resp.status_code == 200


async def test_another_pilot_cannot(client, other_pilot_headers, flyable_mission: Mission):
    await with_route(flyable_mission)

    resp = await client.get(f"/missions/{flyable_mission.id}/export", headers=other_pilot_headers)

    assert resp.status_code == 404


async def test_another_admin_cannot(client, other_admin_headers, flyable_mission: Mission):
    await with_route(flyable_mission)

    resp = await client.get(f"/missions/{flyable_mission.id}/export", headers=other_admin_headers)

    assert resp.status_code == 404


async def test_a_pilot_cannot_export_a_draft(
    client, pilot_headers, assigned_mission: Mission, pilot_user: User
):
    await with_route(assigned_mission)

    resp = await client.get(f"/missions/{assigned_mission.id}/export", headers=pilot_headers)

    assert resp.status_code == 404
