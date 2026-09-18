import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger(__name__)


def _send(to_email: str, subject: str, body: str) -> None:
    # console mode is for local work with no mailbox, the link is the whole point
    # of these emails so logging it is enough to carry on by hand
    if settings.email_to_console:
        logger.info("email not sent (console mode). to=%s subject=%s\n%s", to_email, subject, body)
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)


def send_invite_email(to_email: str, token: str) -> None:
    link = f"{settings.public_base_url}/accept-invite?token={token}"
    _send(
        to_email,
        "You've been invited to Flyby mission planning",
        f"Set your password to get started:\n{link}\n\nIf you weren't expecting this, ignore it.",
    )


def _with_note(body: str, message: str | None) -> str:
    return f"{body}\n\nFrom your admin:\n{message}\n" if message else body


def send_mission_assigned_email(
    to_email: str, mission_name: str, mission_id: str, message: str | None
) -> None:
    link = f"{settings.public_base_url}/missions/{mission_id}"
    _send(
        to_email,
        f"You've been assigned to {mission_name}",
        _with_note(f"You're flying {mission_name}. The plan is here:\n{link}", message),
    )


def send_mission_unassigned_email(
    to_email: str, mission_name: str, mission_id: str, message: str | None
) -> None:
    link = f"{settings.public_base_url}/missions/{mission_id}"
    _send(
        to_email,
        f"You've been taken off {mission_name}",
        _with_note(f"You're no longer assigned to {mission_name}:\n{link}", message),
    )


def send_mission_withdrawn_email(
    to_email: str, mission_name: str, mission_id: str, message: str | None
) -> None:
    link = f"{settings.public_base_url}/missions/{mission_id}"
    _send(
        to_email,
        f"{mission_name} is back in planning",
        _with_note(
            f"{mission_name} lost the aircraft it was booked on and has gone back to a draft, "
            f"so it is off your queue for now:\n{link}",
            message,
        ),
    )


def send_password_reset_email(to_email: str, token: str) -> None:
    link = f"{settings.public_base_url}/reset-password?token={token}"
    _send(
        to_email,
        "Reset your Flyby password",
        f"Reset your password here:\n{link}\n\nIf you didn't request this, ignore it.",
    )
