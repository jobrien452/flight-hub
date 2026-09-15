import smtplib
from email.message import EmailMessage

from app.config import settings


def _send(to_email: str, subject: str, body: str) -> None:
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


def send_password_reset_email(to_email: str, token: str) -> None:
    link = f"{settings.public_base_url}/reset-password?token={token}"
    _send(
        to_email,
        "Reset your Flyby password",
        f"Reset your password here:\n{link}\n\nIf you didn't request this, ignore it.",
    )
