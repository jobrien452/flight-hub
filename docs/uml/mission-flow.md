# End to end flow

One mission, from an empty map to a completed record with flight hours on the
aircraft. This is the demo path.

```mermaid
sequenceDiagram
    actor Admin
    participant SPA as React SPA
    participant API as FastAPI
    participant DB as MongoDB
    participant Mail as SMTP
    actor Pilot

    Note over Admin,SPA: planning
    Admin->>SPA: book an aircraft and pick a payload
    SPA->>API: GET /drones
    API-->>SPA: this admin's fleet, minus retired and minus anything booked
    Admin->>SPA: pick a tool, click out a boundary or a centre line
    SPA->>SPA: snap the shape, work the line spacing out of the payload<br/>(GSD, frame width, side overlap), generate the sweep with turf
    Admin->>SPA: Save
    SPA->>API: POST /missions {name, drone_id, payload, waypoints, plan_params}
    API->>API: the drone must be this admin's, available, and held by nobody else
    API->>DB: insert, status = draft
    API-->>SPA: 201 mission

    Note over Admin,API: publishing
    Admin->>SPA: Publish
    SPA->>API: POST /missions/{id}/publish
    API->>API: owner check, needs waypoints and a booked aircraft
    API->>DB: status = published
    API-->>SPA: mission
    SPA-->>Admin: "assign pilots now?"

    Note over Admin,Pilot: assignment
    Admin->>SPA: pick a pilot, add a note
    SPA->>API: POST /missions/{id}/assignments
    API->>DB: append to assigned_pilot_ids
    API->>Mail: mission assigned email + link
    Mail-->>Pilot: link to the mission
    Note over Pilot,DB: flying
    Pilot->>SPA: open the mission (now visible, it is published)
    Pilot->>SPA: Export .waypoints
    SPA->>API: GET /missions/{id}/export
    API-->>SPA: QGC WPL 110, the file ArduPilot and Mission Planner load
    Pilot->>SPA: Acknowledge
    SPA->>API: POST /missions/{id}/acknowledge
    API->>DB: status = acknowledged
    Pilot->>SPA: Start flight
    SPA->>API: POST /missions/{id}/start
    API->>DB: status = in_flight
    API->>DB: drone.status = in_flight

    Note over Pilot,DB: reporting
    Pilot->>SPA: flight time, photos, notes
    SPA->>API: POST /missions/{id}/reports {status: submitted, data}
    API->>DB: insert report
    API->>DB: drone.flight_hours += duration / 60
    API->>API: has every assigned pilot reported?
    API->>DB: status = completed
    API->>DB: drone.status = available, missions_flown += 1
    API-->>SPA: report
    SPA->>API: GET /missions/{id}
    SPA-->>Pilot: mission reads completed

    Note over Admin,DB: afterwards
    Admin->>SPA: Dashboard
    SPA->>API: GET /stats
    API->>DB: this admin's missions, drones and every pilot
    API-->>SPA: counts, fleet hours, a row per pilot
```

## The authorization check that runs on nearly every step

Every mission route goes through one helper rather than repeating the rule:

```python
owns = (mission.owner_id == current_user.user_id
        if current_user.role == Role.ADMIN
        else current_user.user_id in mission.assigned_pilot_ids)
if not owns:
    raise HTTPException(status_code=404)
```

Two things to point out:

1. **Admins are isolated from each other.** Admin A cannot see or touch admin B's
   missions, while the pilot pool stays shared. This was a real gap I found and
   closed: the list route was a `find_all()` and the ownership check never ran for
   admins.
2. **Not-yours reads as 404, not 403.** A 403 would confirm the resource exists to
   anyone walking ids. Role refusals (a pilot trying to publish) stay 403, because
   there the existence of the thing was never the secret.
