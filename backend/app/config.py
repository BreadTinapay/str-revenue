from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://str_revenue:str_revenue@localhost:5432/str_revenue"
    redis_url: str = "redis://localhost:6379/0"

    # CORS
    cors_origins: str = "http://localhost:5173"

    # Rate limiting / scraper behavior
    scraper_min_delay_seconds: float = 3.0
    scraper_max_delay_seconds: float = 9.0
    scraper_max_concurrency: int = 2
    scraper_proxy_url: str | None = None  # pluggable; unset = direct connection

    # Phase 2 enrichment
    searxng_url: str = "http://searxng:8080"

    # Phase 4 auth
    jwt_secret_key: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 12

    # Phase 5 campaign engine
    email_provider: str = "ses"  # "ses" | "resend"
    email_from_address: str = "outreach@mail.strrevenueco.com"
    email_from_name: str = "STR Revenue"
    email_reply_to: str | None = None
    company_physical_address: str = "STR Revenue Co, [ADDRESS NOT YET SET]"
    app_base_url: str = "http://localhost:8000"

    aws_region: str = "us-east-1"
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None

    resend_api_key: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
