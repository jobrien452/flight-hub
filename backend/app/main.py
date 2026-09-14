from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import init_db
from app.routers import auth, missions


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Flyby Mission Planner", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(missions.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
