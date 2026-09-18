from typing import Annotated

from pydantic import BaseModel, EmailStr, StringConstraints

from app.models.user import Role
from app.schemas.auth import Password

UserName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Role
    has_password: bool


class UserCreate(BaseModel):
    name: UserName
    email: EmailStr
    role: Role
    # set one and they can sign in straight away, leave it out and they get an
    # invite link to pick their own
    password: Password | None = None
