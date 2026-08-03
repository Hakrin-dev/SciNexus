from __future__ import annotations

from typing import Any

from academic_agents.config import Settings
from academic_agents.state import WorkflowState
from academic_agents.tools.paper_search import search_papers

from .base import BaseAgent


class ScoutAgent(BaseAgent):
    name = "scout"
    title = "信息搜集智能体（Scout）"
    responsibility = "检索真实或模拟论文，按统一结构返回可核查来源。"

    def run(self, state: WorkflowState, settings: Settings) -> dict[str, Any]:
        papers = search_papers(
            state["user_query"],
            source=settings.paper_data_source,
            limit=settings.paper_result_limit,
            contact_email=settings.crossref_contact_email,
        )
        return {
            "status": "SUCCESS",
            "agent": self.title,
            "data_source": settings.paper_data_source,
            "paper_count": len(papers),
            "papers": [paper.to_dict() for paper in papers],
            "is_evidence_ready": settings.paper_data_source != "mock",
            "warning": (
                "模拟数据不可作为科研证据。"
                if settings.paper_data_source == "mock"
                else "正式引用前请打开 DOI 页面复核。"
            ),
        }

