import logging

from app.config import settings
from app.email_client import send_invite_email


def test_the_link_goes_to_the_log_when_email_is_set_to_console(monkeypatch, caplog):
    monkeypatch.setattr(settings, "email_to_console", True)
    monkeypatch.setattr(settings, "public_base_url", "http://localhost:5173")

    with caplog.at_level(logging.INFO):
        send_invite_email("pete@example.com", "invite-token-123")

    logged = caplog.text
    assert "pete@example.com" in logged
    # the whole point is that a dev can click it without a mailbox
    assert "http://localhost:5173/accept-invite?token=invite-token-123" in logged


def test_console_mode_never_opens_an_smtp_connection(monkeypatch):
    monkeypatch.setattr(settings, "email_to_console", True)

    def explode(*args, **kwargs):
        raise AssertionError("smtp should not be touched in console mode")

    monkeypatch.setattr("app.email_client.smtplib.SMTP", explode)

    send_invite_email("pete@example.com", "invite-token-123")


def test_normal_mode_still_goes_through_smtp(monkeypatch):
    monkeypatch.setattr(settings, "email_to_console", False)
    sent = []

    class FakeSMTP:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def starttls(self):
            pass

        def login(self, *args):
            pass

        def send_message(self, message):
            sent.append(message["To"])

    monkeypatch.setattr("app.email_client.smtplib.SMTP", FakeSMTP)

    send_invite_email("pete@example.com", "invite-token-123")

    assert sent == ["pete@example.com"]
