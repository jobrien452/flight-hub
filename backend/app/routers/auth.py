import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request, status

from app.config import settings
from app.email_client import send_password_reset_email
from app.rate_limit import RateLimiter, caller, enforce
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
logger = logging.getLogger(__name__)

# an unknown email should cost what a real one costs. without this the reply
# comes back sooner for an address nobody has registered, which answers the
# question "is this person a user here" to anyone with a stopwatch
_TIMING_EQUALISER = hash_password("no user by that name")

# guessing is the attack these routes face, so the allowance is small. per
# address, and per email as well on login so one account cannot be worked on
# from a handful of machines
LOGINS_PER_CALLER = RateLimiter(limit=10, window_seconds=300)
LOGINS_PER_EMAIL = RateLimiter(limit=5, window_seconds=300)
RESETS_PER_CALLER = RateLimiter(limit=5, window_seconds=900)
TOKEN_TRIES_PER_CALLER = RateLimiter(limit=10, window_seconds=300)

LIMITERS = (LOGINS_PER_CALLER, LOGINS_PER_EMAIL, RESETS_PER_CALLER, TOKEN_TRIES_PER_CALLER)


def _is_expired(expires_at: datetime | None) -> bool:
    # mongo round-trips datetimes as naive UTC, so compare on equal footing
    if expires_at is None:
        return True
    now = datetime.now(timezone.utc)
    if expires_at.tzinfo is None:
        now = now.replace(tzinfo=None)
    return expires_at < now


def _login_response(user: User) -> LoginResponse:
    token = create_access_token(
        user_id=str(user.id),
        role=user.role.value,
        password_changed_at=user.password_changed_at,
    )
    return LoginResponse(token=token, user_id=str(user.id), name=user.name, role=user.role)


@router.post("/login", response_model=LoginResponse)
async def login(request: Request, payload: LoginRequest) -> LoginResponse:
    enforce(LOGINS_PER_CALLER, caller(request), retry_after=300)
    enforce(LOGINS_PER_EMAIL, payload.email.lower(), retry_after=300)

    user = await User.find_one(User.email == payload.email)
    # same generic error whether the email is unknown, unclaimed, or the password's wrong
    if user is None or user.password_hash is None:
        verify_password(payload.password, _TIMING_EQUALISER)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return _login_response(user)


@router.post("/accept-invite", response_model=LoginResponse)
async def accept_invite(request: Request, payload: AcceptInviteRequest) -> LoginResponse:
    enforce(TOKEN_TRIES_PER_CALLER, caller(request), retry_after=300)

    user = await User.find_one(User.invite_token == payload.token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if _is_expired(user.invite_token_expires_at):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invite expired")

    user.password_hash = hash_password(payload.password)
    user.password_changed_at = datetime.now(timezone.utc)
    user.invite_token = None
    user.invite_token_expires_at = None
    await user.save()
    return _login_response(user)


@router.post("/request-password-reset", status_code=status.HTTP_200_OK)
async def request_password_reset(
    request: Request, payload: RequestPasswordResetRequest
) -> dict[str, str]:
    enforce(RESETS_PER_CALLER, caller(request), retry_after=900)

    user = await User.find_one(User.email == payload.email)
    if user is not None:
        user.reset_token = generate_token()
        user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=settings.reset_token_ttl_seconds
        )
        await user.save()
        try:
            send_password_reset_email(user.email, user.reset_token)
        except Exception:
            # bad SMTP config shouldn't 500 this or hint that the email exists
            logger.exception("failed to send password reset email to %s", user.email)
    # always the same response, don't leak whether the email exists
    return {"status": "ok"}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(request: Request, payload: ResetPasswordRequest) -> dict[str, str]:
    enforce(TOKEN_TRIES_PER_CALLER, caller(request), retry_after=300)

    user = await User.find_one(User.reset_token == payload.token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if _is_expired(user.reset_token_expires_at):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="reset link expired")

    user.password_hash = hash_password(payload.password)
    # every session opened before now belongs to whoever knew the old password
    user.password_changed_at = datetime.now(timezone.utc)
    user.reset_token = None
    user.reset_token_expires_at = None
    await user.save()
    return {"status": "ok"}
