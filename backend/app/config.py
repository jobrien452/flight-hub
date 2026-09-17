import os

from pydantic_settings import BaseSettings, SettingsConfigDict

# has to come from the real environment, not from a file, since it decides which
# files get read. compose and your shell can set it, .env.dev cannot set itself
APP_ENV = os.getenv("APP_ENV", "dev")

# dev overrides layer on top of .env. a deployment never reads .env.dev at all
ENV_FILES = (".env", ".env.dev") if APP_ENV == "dev" else (".env",)


class Settings(BaseSettings):
    # "dev" or "prod". dev is the default because running this by hand is a dev
    # act, a real deployment sets APP_ENV=prod in its own env
    app_env: str = APP_ENV

    # local mongo by default, override via env in docker-compose
    mongo_url: str = "mongodb://localhost:27017"
    mongo_db_name: str = "flyby"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"

    # how long an invite/reset link stays clickable
    invite_token_ttl_seconds: int = 60 * 60 * 24 * 7
    reset_token_ttl_seconds: int = 60 * 60

    # used to build the links that go out in invite/reset emails
    public_base_url: str = "http://localhost:5173"

    # SMTP, gmail works fine here with an app password
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "no-reply@example.com"
    smtp_use_tls: bool = True

    # handed to signed in users at runtime instead of being baked into the
    # frontend bundle, so it can be rotated without rebuilding the frontend
    mapbox_token: str = ""

    # --- dev only ---
    # an admin created at startup with this password already set, so a dev can
    # sign in without SMTP and without an invite link. ignored unless app_env is dev
    dev_admin_email: str = ""
    dev_admin_password: str = ""
    dev_admin_name: str = "Dev Admin"
    # writes invite and reset links to the log instead of sending them, so the
    # links are clickable from `docker compose logs backend` with no mailbox
    email_to_console: bool = False

    # comma separated, only needed when the frontend calls this api cross-origin
    # (e.g. local dev, vite on :5173 hitting this on :8000). Not needed when nginx
    # reverse-proxies /api to this service, that's already same-origin.
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    # extra keys in an env file are ignored rather than fatal, so a stray line in
    # someone's .env.dev does not stop the server booting
    model_config = SettingsConfigDict(env_file=ENV_FILES, extra="ignore")


settings = Settings()
