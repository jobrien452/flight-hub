import logging
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.email_client import send_invite_email
from app.models.user import User
from app.security import generate_token

logger = logging.getLogger(__name__)


async def send_invite(user: User) -> None:
    # a fresh link every time, so an unclaimed invite can always be sent again
    user.invite_token = generate_token()
    user.invite_token_expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=settings.invite_token_ttl_seconds
    )
    await user.save()
    try:
        send_invite_email(user.email, user.invite_token)
    except Exception:
        # a bad mailbox shouldn't lose the account, the link can be reissued
        logger.exception("failed to send invite email to %s", user.email)


async def sync_invites() -> int:
    # sends (or re-sends) an invite to every preloaded user with no password yet
    pending = await User.find(User.password_hash == None).to_list()  # noqa: E711
    for user in pending:
        await send_invite(user)
    return len(pending)
