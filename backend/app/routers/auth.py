from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status

from app.config import settings
from app.email_client import send_password_reset_email
from app.models.user import User
from app.schemas.auth import (
    AcceptInviteRequest,
    LoginRequest,
    LoginResponse,
    RequestPasswordResetRequest,
    ResetPasswordRequest,
)
from app.security import create_access_token, generate_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _is_expired(expires_at: datetime | None) -> bool:
    # mongo round-trips datetimes as naive UTC, so compare on equal footing
    if expires_at is None:
        return True
    now = datetime.now(timezone.utc)
    if expires_at.tzinfo is None:
        now = now.replace(tzinfo=None)
    return expires_at < now


def _login_response(user: User) -> LoginResponse:
    token = create_access_token(user_id=str(user.id), role=user.role.value)
    return LoginResponse(token=token, user_id=str(user.id), name=user.name, role=user.role)


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest) -> LoginResponse:
    user = await User.find_one(User.email == payload.email)
    # same generic error whether the email is unknown, unclaimed, or the password's wrong
    if user is None or user.password_hash is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return _login_response(user)


@router.post("/accept-invite", response_model=LoginResponse)
async def accept_invite(payload: AcceptInviteRequest) -> LoginResponse:
    user = await User.find_one(User.invite_token == payload.token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if _is_expired(user.invite_token_expires_at):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invite expired")

    user.password_hash = hash_password(payload.password)
    user.invite_token = None
    user.invite_token_expires_at = None
    await user.save()
    return _login_response(user)


@router.post("/request-password-reset", status_code=status.HTTP_200_OK)
async def request_password_reset(payload: RequestPasswordResetRequest) -> dict[str, str]:
    user = await User.find_one(User.email == payload.email)
    if user is not None:
        user.reset_token = generate_token()
        user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=settings.reset_token_ttl_seconds
        )
        await user.save()
        send_password_reset_email(user.email, user.reset_token)
    # always the same response, don't leak whether the email exists
    return {"status": "ok"}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(payload: ResetPasswordRequest) -> dict[str, str]:
    user = await User.find_one(User.reset_token == payload.token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if _is_expired(user.reset_token_expires_at):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="reset link expired")

    user.password_hash = hash_password(payload.password)
    user.reset_token = None
    user.reset_token_expires_at = None
    await user.save()
    return {"status": "ok"}
