from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.models import document_models


async def init_db(client: AsyncIOMotorClient | None = None) -> None:
    # pass a client in tests to swap in a mock mongo client
    client = client or AsyncIOMotorClient(settings.mongo_url)
    await init_beanie(database=client[settings.mongo_db_name], document_models=document_models)
