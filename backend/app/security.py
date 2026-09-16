import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings

TOKEN_TTL = timedelta(hours=12)
# marks a bearer credential as an api token rather than a session jwt
API_TOKEN_PREFIX = "flyby_"
API_TOKEN_DISPLAY_CHARS = 12


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def generate_token() -> str:
    # used for invite and password reset links, not JWTs
    return secrets.token_urlsafe(32)


def generate_api_token() -> str:
    return f"{API_TOKEN_PREFIX}{secrets.token_urlsafe(32)}"


def hash_api_token(token: str) -> str:
    # plain sha256, not bcrypt: these are already high entropy and get hashed on
    # every request, so a deliberately slow hash would only cost latency
    return hashlib.sha256(token.encode()).hexdigest()


def api_token_prefix(token: str) -> str:
    return token[:API_TOKEN_DISPLAY_CHARS]


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


__all__ = [
    "create_access_token",
    "decode_access_token",
    "hash_password",
    "verify_password",
    "generate_token",
    "generate_api_token",
    "hash_api_token",
    "api_token_prefix",
    "API_TOKEN_PREFIX",
    "JWTError",
]
