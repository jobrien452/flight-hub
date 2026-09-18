from typing import Annotated

from pydantic import BaseModel, EmailStr, Field

from app.models.user import Role

# bcrypt silently ignores anything past 72 bytes, so refuse it rather than let
# someone believe in a passphrase that is not all being checked
Password = Annotated[str, Field(min_length=8, max_length=72)]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    token: str
    user_id: str
    name: str
    role: Role


class AcceptInviteRequest(BaseModel):
    token: str
    password: Password


class RequestPasswordResetRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: Password
