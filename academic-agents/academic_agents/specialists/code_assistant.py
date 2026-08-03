from __future__ import annotations

from typing import Any

from academic_agents.config import Settings
from academic_agents.state import WorkflowState

from .base import BaseAgent


class CodeAssistantAgent(BaseAgent):
    name = "code_assistant"
    title = "代码辅助智能体"
    responsibility = "把研究任务拆成小函数、测试和可复现运行步骤。"

    def run(self, state: WorkflowState, settings: Settings) -> dict[str, Any]:
        model_answer = self.call_model(state["user_query"], settings)
        return {
            "status": "SUCCESS",
            "agent": self.title,
            "problem": state["user_query"],
            "implementation_plan": [
                "先确定输入和输出",
                "编写最小函数",
                "为正常与异常输入编写测试",
                "运行测试后再增加功能",
            ],
            "suggested_files": ["implementation.py", "tests/test_implementation.py"],
            "model_answer": model_answer,
            "execution_note": "当前 Agent 只给出方案，没有声称已修改或运行用户未提供的代码。",
        }

