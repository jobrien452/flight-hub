from fastapi import APIRouter, HTTPException, status

from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse
from app.security import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest) -> LoginResponse:
    # name is the whole "auth" scheme here, no passwords per the brief
    user = await User.find_one(User.name == payload.name)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    token = create_access_token(user_id=str(user.id), role=user.role.value)
    return LoginResponse(token=token, user_id=str(user.id), name=user.name, role=user.role)
