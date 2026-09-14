from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # local mongo by default, override via env in docker-compose
    mongo_url: str = "mongodb://localhost:27017"
    mongo_db_name: str = "flyby"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"

    class Config:
        env_file = ".env"


settings = Settings()
