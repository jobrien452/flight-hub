from datetime import datetime, timezone

from beanie import Document
from pydantic import Field
from pymongo import IndexModel


class ApiToken(Document):
    user_id: str
    name: str
    # only the hash is kept, the secret itself is shown once when it is created
    token_hash: str
    # leading characters of the secret, so a token is recognisable in a list
    prefix: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_used_at: datetime | None = None

    class Settings:
        name = "api_tokens"
        indexes = [IndexModel("token_hash", unique=True)]
