from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from academic_agents.config import Settings
from academic_agents.model_gateway import create_model
from academic_agents.state import WorkflowState


class BaseAgent(ABC):
    name: str
    title: str
    responsibility: str

    @abstractmethod
    def run(self, state: WorkflowState, settings: Settings) -> dict[str, Any]:
        """Execute one specialist step and return a structured result."""

    def call_model(self, prompt: str, settings: Settings) -> str | None:
        if settings.mode != "llm":
            return None

        model = create_model(settings)
        try:
            response = model.invoke(
                [
                    (
                        "system",
                        f"你是{self.title}。职责：{self.responsibility}"
                        "。不得虚构论文、DOI、实验结果或已执行的操作。",
                    ),
                    ("user", prompt),
                ]
            )
        except Exception as exc:
            raise RuntimeError(
                f"{settings.model_provider} 模型调用失败：{exc}。"
                "若配置检查已通过，请在 VS Code 本机终端检查网络、API 余额和 Key 权限。"
            ) from exc
        return str(response.content)
