from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
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

# only needed when the frontend calls this api cross-origin, e.g. local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(missions.router)
app.include_router(mission_reports.router)
app.include_router(users.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
