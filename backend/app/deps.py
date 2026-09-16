from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models.api_token import ApiToken
from app.models.user import Role, User
from app.security import API_TOKEN_PREFIX, JWTError, decode_access_token, hash_api_token

bearer_scheme = HTTPBearer()


class CurrentUser:
    def __init__(self, user_id: str, role: Role, via_api_token: bool = False):
        self.user_id = user_id
        self.role = role
        # api tokens are shut out of token management, so a leaked one cannot
        # mint replacements that outlive its own revocation
        self.via_api_token = via_api_token


async def _user_from_api_token(raw_token: str) -> CurrentUser:
    token = await ApiToken.find_one(ApiToken.token_hash == hash_api_token(raw_token))
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")

    owner = await User.get(token.user_id)
    if owner is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")

    token.last_used_at = datetime.now(timezone.utc)
    await token.save()
    return CurrentUser(user_id=str(owner.id), role=owner.role, via_api_token=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    raw_token = credentials.credentials
    if raw_token.startswith(API_TOKEN_PREFIX):
        return await _user_from_api_token(raw_token)

    try:
        payload = decode_access_token(raw_token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")
    return CurrentUser(user_id=payload["sub"], role=Role(payload["role"]))


async def require_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin only")
    return current_user


async def require_session(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if current_user.via_api_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="sign in to manage api tokens"
        )
    return current_user
