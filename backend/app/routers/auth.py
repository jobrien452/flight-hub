from fastapi import APIRouter, HTTPException, status

from app.schemas.auth import LoginRequest, LoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest) -> LoginResponse:
    # TODO: implement, tests in tests/test_auth.py define the contract
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)
