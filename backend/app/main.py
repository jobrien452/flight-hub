from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import init_db
from app.invites import sync_invites
from app.routers import auth, mission_reports, missions, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # picks up anyone preloaded by a migration since the last restart
    await sync_invites()
    yield


app = FastAPI(title="Flyby Mission Planner", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(missions.router)
app.include_router(mission_reports.router)
app.include_router(users.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
