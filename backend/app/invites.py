from datetime import datetime, timedelta, timezone

from app.config import settings
from app.email_client import send_invite_email
from app.models.user import User
from app.security import generate_token


async def sync_invites() -> int:
    # sends (or re-sends) an invite to every preloaded user with no password yet
    pending = await User.find(User.password_hash == None).to_list()  # noqa: E711
    for user in pending:
        user.invite_token = generate_token()
        user.invite_token_expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=settings.invite_token_ttl_seconds
        )
        await user.save()
        send_invite_email(user.email, user.invite_token)
    return len(pending)
