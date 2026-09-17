Remote mission planning prototype, built for the Flyby full stack interview.
See interview PDF for more info.

An admin draws a flight plan on a 3d map, publishes it, then assigns pilots and a
drone to it. The pilot picks it up, flies it and files a report. The mission closes
itself once every assigned pilot has reported, and the drone's hours go up with it.

Built so far:

- Waypoint, rectangle survey and corridor tools, sweeps generated client side with turf

- 3d map with terrain, every waypoint sits at its own altitude with a tether to the ground

- Mission state machine, draft to published to acknowledged to in flight to completed,
  never set directly by the client

- Admins only see the missions and drones they own, the pilot pool is shared

- Pilot side, acknowledge a mission, start the flight, report back with flight time

- Fleet, drones tracked with flight hours and missions flown accrued off the reports

- Dashboard for mission status, fleet and per pilot numbers

- Invite based auth, api tokens for machines, swagger at /api-docs for admins only

Current Tech Stack:

- Fast API python backend

- React + Vite Frontend, typescript

- deck.gl + mapbox-gl + react-map-gl for the map, deck.gl draws the plan because
  mapbox layers are stuck on the ground

- Mongo DB database (for development speed)

Deployment Scheme

- Deployable via docker for all

- Compile React and serve via nginx reverse proxy for speed

- Possibly deploy in mini kube cluster for better interoperability

- Github actions for container packaging into my registry (done, runs both test
  suites then pushes both images to ghcr)

What you need locally:

- Docker, with compose v2. Everything else builds inside containers, no local
  node or python needed unless you want to run a side outside docker

- A mapbox public token, free from account.mapbox.com. The api hands it to the
  frontend at runtime so it is not baked into the build, without one everything
  works except the map

Local Deployment

```cp backend/.env.dev.example backend/.env```

```docker compose up --build -d```

For more granular controls of the system check the .env file for the backend

Frontend env file only contains the api url and need much less configuration

Dev Notes:

Accessible api - this read api tokens to me
Map component - start 2d top down move to 3d if time or easier than im assuming
Two users types - Types is roles/enums
    Admin - classic CRUD 
    Pilot - just R, however pilots likely need to report data back after a mission so an endpoint made for that will need to give pilots CRU

Android apps contacting our service login/token
Permanent state updates in database (worded interestingly may need to consider SQL over NOSQL)
