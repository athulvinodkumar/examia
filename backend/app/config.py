import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_root_dir = os.path.dirname(_backend_dir)
_env_candidates = (
    os.path.join(_backend_dir, ".env"),
    os.path.join(_root_dir, ".env"),
    "backend/.env",
    ".env"
)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_env_candidates, env_file_encoding="utf-8", extra="ignore")

    app_env: str = Field(default="development")
    app_secret_key: str = Field(default="examia_default_secret_key_change_me")
    frontend_url: str = Field(default="https://examia.athulvinodkumar08.workers.dev")
    backend_port: int = Field(default=8000)
    upload_dir: str = Field(default="./uploads")
    
    # Database
    database_url: Optional[str] = Field(default="")
    
    # Supabase
    supabase_url: Optional[str] = Field(default="")
    supabase_anon_key: Optional[str] = Field(default="")
    supabase_service_role_key: Optional[str] = Field(default="")
    supabase_jwt_secret: Optional[str] = Field(default="")
    supabase_storage_bucket: str = Field(default="exam-papers")
    
    # Google OAuth
    google_client_id: Optional[str] = Field(default="")
    google_client_secret: Optional[str] = Field(default="")
    google_redirect_uri: Optional[str] = Field(default="https://examia.athulvinodkumar08.workers.dev/login.html")
    
    # Gemini AI
    gemini_api_key: Optional[str] = Field(default="")
    gemini_model: str = Field(default="gemini-3.5-flash-lite")
    
    # Optional Email / SMTP
    smtp_host: Optional[str] = Field(default="")
    smtp_port: int = Field(default=587)
    smtp_username: Optional[str] = Field(default="")
    smtp_password: Optional[str] = Field(default="")
    smtp_from_email: str = Field(default="noreply@examia.io")

    @property
    def effective_database_url(self) -> str:
        """Returns PostgreSQL URL if set, or defaults to local SQLite for local dev."""
        url = (self.database_url or "").strip()
        if not url:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            db_path = os.path.join(base_dir, "examia.db")
            return f"sqlite:///{db_path}"
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql://", 1)
        return url

    @property
    def is_supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)

    @property
    def is_gemini_configured(self) -> bool:
        return bool(self.gemini_api_key and len(self.gemini_api_key) > 5)

    @property
    def is_google_oauth_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

settings = Settings()
