from datetime import datetime
from enum import Enum

from beanie import Document
from pydantic import EmailStr
from pymongo import IndexModel


class Role(str, Enum):
    ADMIN = "admin"
    PILOT = "pilot"


class User(Document):
    name: str
    email: EmailStr
    role: Role
    # None until the invite is claimed, first login sets this
    password_hash: str | None = None
    invite_token: str | None = None
    invite_token_expires_at: datetime | None = None
    reset_token: str | None = None
    reset_token_expires_at: datetime | None = None

    class Settings:
        name = "users"
        indexes = [IndexModel("email", unique=True)]
