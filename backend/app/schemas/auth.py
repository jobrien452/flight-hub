from pydantic import BaseModel

from app.models.user import Role


class LoginRequest(BaseModel):
    name: str


class LoginResponse(BaseModel):
    token: str
    user_id: str
    name: str
    role: Role
