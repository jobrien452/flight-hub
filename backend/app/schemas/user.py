from pydantic import BaseModel, EmailStr

from app.models.user import Role


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Role
    has_password: bool
