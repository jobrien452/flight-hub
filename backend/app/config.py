from pydantic_settings import BaseSettings


class Settings(BaseSettings):
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

    class Config:
        env_file = ".env"


settings = Settings()
