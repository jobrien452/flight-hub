from enum import Enum

from beanie import Document


class Role(str, Enum):
    ADMIN = "admin"
    PILOT = "pilot"


class User(Document):
    name: str
    role: Role

    class Settings:
        name = "users"
