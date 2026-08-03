"""Create the configured LLM without exposing provider details to agents."""

from __future__ import annotations

import os
from typing import Any

from langchain_openai import ChatOpenAI

from .config import Settings


def create_model(settings: Settings) -> Any:
    """Create an OpenAI-compatible model client without logging API keys."""

    if settings.mode != "llm":
        raise RuntimeError("demo 模式不应创建真实模型客户端")

    if settings.model_provider == "openai":
        return ChatOpenAI(
            model=settings.model,
            api_key=os.environ["OPENAI_API_KEY"],
        )

    if settings.model_provider == "deepseek":
        return ChatOpenAI(
            model=settings.model,
            api_key=os.environ["DEEPSEEK_API_KEY"],
            base_url=settings.model_base_url,
        )

    raise ValueError(f"不支持的模型提供商：{settings.model_provider}")
