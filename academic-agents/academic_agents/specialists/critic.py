from __future__ import annotations

from typing import Any

from academic_agents.config import Settings
from academic_agents.state import WorkflowState

from .base import BaseAgent


class CriticAgent(BaseAgent):
    name = "critic"
    title = "论文审查与决策智能体"
    responsibility = "核查事实、证据、逻辑和格式，给出明确修改动作。"

    def run(self, state: WorkflowState, settings: Settings) -> dict[str, Any]:
        draft = state.get("artifacts", {}).get("draft")
        revision = state.get("revision_count", 0)
        missing_draft = not draft
        decision = (
            "REJECT_WITH_REVISION"
            if missing_draft or revision == 0
            else "ACCEPT_FOR_DEMO"
        )
        issues = []
        if missing_draft:
            issues.append(
                {
                    "type": "Missing Draft",
                    "detail": "没有收到待审查草稿。",
                    "action_required": "先提供或生成论文草稿。",
                }
            )
        elif revision == 0:
            issues.append(
                {
                    "type": "Missing Evidence",
                    "detail": "断言尚未绑定真实论文证据。",
                    "action_required": "降低结论强度并保留待补证据标记。",
                }
            )
        return {
            "status": "SUCCESS",
            "agent": self.title,
            "decision": decision,
            "overall_score": 4.0 if decision == "REJECT_WITH_REVISION" else 7.0,
            "issues_found": issues,
            "review_round": revision + 1,
            "note": "ACCEPT_FOR_DEMO 只表示演示闭环通过，不代表真实论文可投稿。",
        }
