from __future__ import annotations

from typing import Any

from academic_agents.config import Settings
from academic_agents.state import WorkflowState

from .base import BaseAgent


class LibrarianAgent(BaseAgent):
    name = "librarian"
    title = "知识管家智能体"
    responsibility = "整理文献库并生成可供图形界面使用的节点和关系。"

    def run(self, state: WorkflowState, settings: Settings) -> dict[str, Any]:
        papers = state.get("artifacts", {}).get("papers", [])
        nodes = [
            {
                "id": paper["paper_id"],
                "label": paper["title"],
                "category": "retrieved",
                "read_priority": index + 1,
            }
            for index, paper in enumerate(papers)
        ]
        edges = [
            {
                "source": nodes[index]["id"],
                "target": nodes[index + 1]["id"],
                "relation_type": "same_search_topic",
            }
            for index in range(max(0, len(nodes) - 1))
        ]
        return {
            "status": "SUCCESS",
            "agent": self.title,
            "graph_data": {"nodes": nodes, "edges": edges},
            "tags_recommendation": ["multi-agent", "LLM", "collaboration"],
            "folder_suggestion": "多智能体/待精读",
            "note": "当前关系来自同一次检索；接入引用数据后可升级为真实共引图谱。",
        }

