from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import settings

TOKEN_TTL = timedelta(hours=12)


def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + TOKEN_TTL,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    # raises JWTError on bad or expired token, caller turns that into a 401
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


__all__ = ["create_access_token", "decode_access_token", "JWTError"]
