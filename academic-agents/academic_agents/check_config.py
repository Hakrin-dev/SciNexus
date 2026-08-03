"""Safely inspect configuration without printing any API key."""

from __future__ import annotations

import json
import os

from dotenv import load_dotenv

from .config import Settings


def main() -> None:
    load_dotenv()
    provider = os.getenv("MODEL_PROVIDER", "openai").lower()
    key_name = (
        "DEEPSEEK_API_KEY" if provider == "deepseek" else "OPENAI_API_KEY"
    )
    try:
        settings = Settings.from_env(mode="demo")
        result = {
            "configuration_valid": True,
            "app_mode": os.getenv("APP_MODE", "demo"),
            "model_provider": settings.model_provider,
            "model": settings.model,
            "required_key_name": key_name,
            "required_key_is_set": bool(os.getenv(key_name)),
            "paper_data_source": settings.paper_data_source,
            "crossref_email_is_set": bool(settings.crossref_contact_email),
        }
    except Exception as exc:
        result = {"configuration_valid": False, "error": str(exc)}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
