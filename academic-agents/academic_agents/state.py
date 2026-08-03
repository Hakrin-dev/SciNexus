from __future__ import annotations

from typing import Any, Literal, TypedDict

AgentName = Literal[
    "scout",
    "synthesis",
    "librarian",
    "research_design",
    "code_assistant",
    "writer",
    "critic",
]


class WorkflowState(TypedDict, total=False):
    user_query: str
    requested_task_type: str | None
    active_paper_id: str | None
    conversation_history: list[dict[str, Any]]
    task_type: str
    current_agent: AgentName
    status: Literal["pending", "running", "success", "failed"]
    task_plan: list[AgentName]
    plan_index: int
    completed_agents: list[AgentName]
    history: list[dict[str, Any]]
    artifacts: dict[str, Any]
    revision_count: int
    max_revisions: int
    next_route: str
    result: dict[str, Any]
    error: str
