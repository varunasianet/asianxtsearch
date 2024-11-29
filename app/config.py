from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # Required credentials and IDs
    PROJECT_ID: str
    GOOGLE_APPLICATION_CREDENTIALS: str
    GOOGLE_CSE_ID: str
    GOOGLE_API_KEY: str
    
    # Model Configuration
    GEMINI_MODEL: str = "gemini-1.5-pro-002"
    LOCATION: str = "us-central1"
    
    # Search Configuration
    NUM_SEARCH: int = 10
    SEARCH_TIME_LIMIT: int = 3
    TOTAL_TIMEOUT: int = 6
    MAX_CONTENT: int = 500
    MAX_TOKENS: int = 1000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )

# Create settings instance
settings = Settings()

# Export settings
__all__ = ['settings']
