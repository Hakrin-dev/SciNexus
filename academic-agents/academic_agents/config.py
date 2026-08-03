from __future__ import annotations

import os
from dataclasses import dataclass


def _safe_contact_email(value: str) -> str:
    value = value.strip()
    if not value or "@" not in value:
        return ""
    try:
        value.encode("ascii")
    except UnicodeEncodeError:
        return ""
    return value


@dataclass(frozen=True)
class Settings:
    mode: str
    model_provider: str
    model: str
    model_base_url: str | None
    paper_data_source: str
    paper_result_limit: int
    crossref_contact_email: str
    max_revisions: int

    @classmethod
    def from_env(
        cls,
        mode: str | None = None,
        *,
        model_provider: str | None = None,
        paper_data_source: str | None = None,
        paper_result_limit: int | None = None,
    ) -> "Settings":
        chosen_mode = (mode or os.getenv("APP_MODE", "demo")).lower()
        if chosen_mode == "openai":
            chosen_mode = "llm"
        if chosen_mode not in {"demo", "llm"}:
            raise ValueError("APP_MODE 只能是 demo 或 llm")

        chosen_provider = (
            model_provider or os.getenv("MODEL_PROVIDER", "openai")
        ).lower()
        if chosen_provider not in {"openai", "deepseek"}:
            raise ValueError("MODEL_PROVIDER 只能是 openai 或 deepseek")

        if chosen_provider == "openai":
            model = os.getenv("OPENAI_MODEL", "gpt-5.6-terra")
            model_base_url = None
            required_key = "OPENAI_API_KEY"
        else:
            model = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")
            model_base_url = os.getenv(
                "DEEPSEEK_BASE_URL", "https://api.deepseek.com"
            )
            required_key = "DEEPSEEK_API_KEY"

        if chosen_mode == "llm" and not os.getenv(required_key):
            raise RuntimeError(
                f"{chosen_provider} 模式需要 {required_key}；"
                "请在本机 .env 中填写，不要把 Key 发到聊天或提交到 Git。"
            )
        chosen_paper_source = (
            paper_data_source or os.getenv("PAPER_DATA_SOURCE", "mock")
        ).lower()
        if chosen_paper_source not in {"mock", "crossref"}:
            raise ValueError("PAPER_DATA_SOURCE 只能是 mock 或 crossref")
        chosen_result_limit = (
            paper_result_limit
            if paper_result_limit is not None
            else int(os.getenv("PAPER_RESULT_LIMIT", "5"))
        )
        if not 1 <= chosen_result_limit <= 20:
            raise ValueError("PAPER_RESULT_LIMIT 必须在 1 到 20 之间")
        return cls(
            mode=chosen_mode,
            model_provider=chosen_provider,
            model=model,
            model_base_url=model_base_url,
            paper_data_source=chosen_paper_source,
            paper_result_limit=chosen_result_limit,
            crossref_contact_email=_safe_contact_email(
                os.getenv("CROSSREF_CONTACT_EMAIL", "")
            ),
            max_revisions=max(0, int(os.getenv("MAX_REVISIONS", "1"))),
        )
