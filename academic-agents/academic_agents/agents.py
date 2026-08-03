"""Agent registry.

Open this file first in VS Code to see how agent names map to implementations.
Each implementation lives in ``academic_agents/specialists/``.
"""

from __future__ import annotations

from typing import Any

from .config import Settings
from .specialists import (
    CodeAssistantAgent,
    CriticAgent,
    LibrarianAgent,
    ResearchDesignAgent,
    ScoutAgent,
    SynthesisAgent,
    WriterAgent,
)
from .specialists.base import BaseAgent
from .state import WorkflowState

AGENTS: dict[str, BaseAgent] = {
    "scout": ScoutAgent(),
    "synthesis": SynthesisAgent(),
    "librarian": LibrarianAgent(),
    "research_design": ResearchDesignAgent(),
    "code_assistant": CodeAssistantAgent(),
    "writer": WriterAgent(),
    "critic": CriticAgent(),
}


def execute_agent(
    agent_name: str,
    state: WorkflowState,
    settings: Settings,
) -> dict[str, Any]:
    try:
        agent = AGENTS[agent_name]
    except KeyError as exc:
        raise ValueError(f"未知智能体：{agent_name}") from exc
    return agent.run(state, settings)

