import logging

from app.config import settings
from app.models.user import Role, User
from app.security import hash_password

logger = logging.getLogger(__name__)


# the normal way in is an emailed invite, which needs working SMTP. this is the
# way in for a dev who has none: one admin with a password already set, created
# only when APP_ENV is dev and only when credentials were actually supplied
async def seed_dev_admin() -> User | None:
    if settings.app_env != "dev":
        return None
    if not (settings.dev_admin_email and settings.dev_admin_password):
        return None

    existing = await User.find_one(User.email == settings.dev_admin_email)
    if existing is not None:
        # a restart must not quietly reset a password somebody has since changed
        logger.info("dev admin %s already exists, leaving it alone", settings.dev_admin_email)
        return existing

    user = User(
        name=settings.dev_admin_name,
        email=settings.dev_admin_email,
        role=Role.ADMIN,
        password_hash=hash_password(settings.dev_admin_password),
    )
    await user.insert()
    logger.warning(
        "seeded dev admin %s with the password from DEV_ADMIN_PASSWORD, dev only",
        settings.dev_admin_email,
    )
    return user
