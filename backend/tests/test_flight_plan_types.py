async def test_mission_stores_flight_plan_type_and_plan_params(client, admin_headers):
    payload = {
        "name": "Waypoint Mission",
        "waypoints": [{"lat": 1.0, "lng": 2.0}],
        "plan_params": {"type": "waypoint", "waypoints": [{"lat": 1.0, "lng": 2.0}]},
    }
    resp = await client.post("/missions", json=payload, headers=admin_headers)
    assert resp.status_code == 201
    assert resp.json()["plan_params"]["type"] == "waypoint"


async def test_waypoint_type_mission_accepts_raw_waypoints(client, admin_headers):
    payload = {
        "name": "Waypoint Mission",
        "waypoints": [{"lat": 1.0, "lng": 2.0}, {"lat": 1.1, "lng": 2.1}],
        "plan_params": {
            "type": "waypoint",
            "waypoints": [{"lat": 1.0, "lng": 2.0}, {"lat": 1.1, "lng": 2.1}],
        },
    }
    resp = await client.post("/missions", json=payload, headers=admin_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert len(body["plan_params"]["waypoints"]) == 2
    assert len(body["waypoints"]) == 2


async def test_survey_type_mission_accepts_boundary_and_settings(client, admin_headers):
    payload = {
        "name": "Survey Mission",
        "waypoints": [],
        "plan_params": {
            "type": "survey",
            "boundary": [
                {"lat": 0.0, "lng": 0.0},
                {"lat": 0.0, "lng": 1.0},
                {"lat": 1.0, "lng": 1.0},
                {"lat": 1.0, "lng": 0.0},
            ],
            "altitude": 50,
            "spacing": 10,
            "heading": 90,
        },
    }
    resp = await client.post("/missions", json=payload, headers=admin_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["plan_params"]["type"] == "survey"
    assert body["plan_params"]["altitude"] == 50
    assert body["plan_params"]["spacing"] == 10
    assert len(body["plan_params"]["boundary"]) == 4


async def test_survey_type_mission_stores_generated_waypoints(client, admin_headers):
    # waypoints are generated client-side and sent alongside plan_params, server just stores them
    generated = [{"lat": 0.0, "lng": 0.0}, {"lat": 0.0, "lng": 1.0}, {"lat": 0.5, "lng": 1.0}]
    payload = {
        "name": "Survey Mission",
        "waypoints": generated,
        "plan_params": {
            "type": "survey",
            "boundary": [
                {"lat": 0.0, "lng": 0.0},
                {"lat": 0.0, "lng": 1.0},
                {"lat": 1.0, "lng": 1.0},
                {"lat": 1.0, "lng": 0.0},
            ],
            "altitude": 50,
            "spacing": 10,
        },
    }
    resp = await client.post("/missions", json=payload, headers=admin_headers)
    assert resp.status_code == 201
    assert len(resp.json()["waypoints"]) == 3


async def test_unknown_flight_plan_type_is_rejected(client, admin_headers):
    payload = {
        "name": "Bad Mission",
        "plan_params": {"type": "orbit", "waypoints": []},
    }
    resp = await client.post("/missions", json=payload, headers=admin_headers)
    assert resp.status_code == 422
