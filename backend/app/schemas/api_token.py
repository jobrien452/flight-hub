from datetime import datetime

from pydantic import BaseModel


class ApiTokenCreate(BaseModel):
    name: str


class ApiTokenOut(BaseModel):
    id: str
    name: str
    prefix: str
    created_at: datetime
    last_used_at: datetime | None


class ApiTokenCreated(ApiTokenOut):
    # the only time the secret is ever returned, it is not recoverable later
    token: str
