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

Locally web is accessible at localhost and api at localhost:8000 or localhost/api

Https is only available if you have the system publicly exposed

For more granular controls of the system check the .env file for the backend

Frontend env file only contains the api url and need much less configuration

Running Tests

Both suites run outside docker, nothing needs to be up first. No mongo, no
containers, no mapbox token

Extra tech the docker path does not ask for:

- Python 3.12 or newer for the backend suite

- Node 22.22 or newer for the frontend suite, CI runs 24

Backend, from backend/

```python -m venv .venv```

```.venv\Scripts\activate``` on windows, ```source .venv/bin/activate``` anywhere else

```pip install -r requirements-dev.txt```

```pytest -q```

Frontend, from frontend/

```npm ci```

```npm run test```

```npm run test:watch``` to leave it running while working

```npm run lint``` and ```npm run build``` are the other two gates CI checks, build
runs tsc -b first so it typechecks at the same time

Why neither suite needs a database:

- backend swaps in mongomock per test, every test gets a fresh in memory db

- frontend runs in jsdom with msw standing in for the api, an unhandled request
  fails the test instead of quietly passing
