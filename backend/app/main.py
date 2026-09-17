from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.deps import CurrentUser, require_admin
from app.invites import sync_invites
from app.routers import (
    api_tokens,
    auth,
    config,
    drones,
    me,
    mission_reports,
    missions,
    stats,
    users,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # picks up anyone preloaded by a migration since the last restart
    await sync_invites()
    yield


# the built in docs routes are off because they cannot carry a bearer token.
# the frontend serves swagger at /api-docs and fetches the spec below with one
app = FastAPI(
    title="Flyby Mission Planner",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# only needed when the frontend calls this api cross-origin, e.g. local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# auth takes passwords and api-tokens mints credentials, neither works with a
# token, so both stay out of the spec rather than inviting calls that cannot work
app.include_router(auth.router, include_in_schema=False)
app.include_router(api_tokens.router, include_in_schema=False)
app.include_router(missions.router)
app.include_router(drones.router)
app.include_router(stats.router)
app.include_router(config.router)
app.include_router(mission_reports.router)
app.include_router(me.router)
app.include_router(users.router)


@app.get("/openapi.json", include_in_schema=False)
async def openapi_spec(current_user: CurrentUser = Depends(require_admin)) -> dict:
    return app.openapi()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
