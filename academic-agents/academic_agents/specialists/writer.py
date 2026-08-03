from __future__ import annotations

from typing import Any

from academic_agents.config import Settings
from academic_agents.state import WorkflowState

from .base import BaseAgent


class WriterAgent(BaseAgent):
    name = "writer"
    title = "论文写作智能体"
    responsibility = "基于证据撰写草稿，并维护断言到证据的映射。"

    def run(self, state: WorkflowState, settings: Settings) -> dict[str, Any]:
        revision = state.get("revision_count", 0)
        previous_review = state.get("artifacts", {}).get("review_report")
        model_draft = self.call_model(
            f"任务：{state['user_query']}。上一轮审查：{previous_review}。"
            "没有证据的地方必须标记待补证据。",
            settings,
        )
        draft = (
            model_draft
            or "多智能体系统通过角色分工组织复杂任务。[待补真实文献证据] "
            "本研究拟比较带审查反馈与不带审查反馈的协作流程。"
        )
        if revision:
            draft += " 修订说明：已将结论改为待实验验证，并保留证据缺口标记。"
        return {
            "status": "SUCCESS",
            "agent": self.title,
            "section_name": "Introduction",
            "draft": draft,
            "revision": revision,
            "claim_evidence_map": [
                {
                    "claim": "角色分工可能改善复杂任务协作",
                    "source": None,
                    "status": "MISSING_EVIDENCE",
                }
            ],
            "cited_paper_ids": [],
        }

