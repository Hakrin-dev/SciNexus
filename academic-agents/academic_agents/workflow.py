from __future__ import annotations

from typing import Any

from langgraph.graph import END, START, StateGraph

from .agents import AGENTS, execute_agent
from .config import Settings
from .state import AgentName, WorkflowState
from .supervisor import create_task_plan


def supervisor_node(state: WorkflowState) -> dict[str, Any]:
    task_type, task_plan = create_task_plan(
        state["user_query"], state.get("requested_task_type")
    )
    return {
        "task_type": task_type,
        "task_plan": task_plan,
        "plan_index": 0,
        "current_agent": task_plan[0],
        "completed_agents": [],
        "history": [],
        "artifacts": {},
        "revision_count": 0,
        "status": "running",
    }


def _artifact_updates(agent_name: str, result: dict[str, Any]) -> dict[str, Any]:
    if agent_name == "scout":
        return {"papers": result.get("papers", [])}
    if agent_name == "synthesis":
        return {"reading_notes": result}
    if agent_name == "librarian":
        return {"knowledge_graph": result.get("graph_data", {})}
    if agent_name == "research_design":
        updates = {"proposal": result.get("proposal", {})}
        if "research_report" in result:
            updates["research_report"] = result["research_report"]
        return updates
    if agent_name == "code_assistant":
        return {"code_plan": result}
    if agent_name == "writer":
        return {"draft": result.get("draft", ""), "writing_result": result}
    if agent_name == "critic":
        return {"review_report": result}
    return {}


def make_agent_node(agent_name: AgentName, settings: Settings):
    def agent_node(state: WorkflowState) -> dict[str, Any]:
        try:
            result = execute_agent(agent_name, state, settings)
            artifacts = dict(state.get("artifacts", {}))
            artifacts.update(_artifact_updates(agent_name, result))
            history = list(state.get("history", []))
            history.append(
                {
                    "step": len(history) + 1,
                    "agent": agent_name,
                    "status": result.get("status", "SUCCESS"),
                    "summary": result,
                }
            )
            completed = list(state.get("completed_agents", []))
            completed.append(agent_name)
            return {
                "result": result,
                "artifacts": artifacts,
                "history": history,
                "completed_agents": completed,
                "status": "running",
            }
        except Exception as exc:
            return {
                "status": "failed",
                "error": str(exc),
                "result": {"status": "FAILED", "agent": agent_name, "error": str(exc)},
            }

    return agent_node


def coordinator_node(state: WorkflowState) -> dict[str, Any]:
    if state.get("status") == "failed":
        return {"next_route": "__end__"}

    current = state["current_agent"]
    review = state.get("artifacts", {}).get("review_report", {})
    revision_count = state.get("revision_count", 0)
    max_revisions = state.get("max_revisions", 1)

    if (
        state.get("task_type") == "paper_writing"
        and current == "critic"
        and review.get("decision") == "REJECT_WITH_REVISION"
        and revision_count < max_revisions
    ):
        return {
            "current_agent": "writer",
            "plan_index": 0,
            "revision_count": revision_count + 1,
            "next_route": "writer",
        }

    next_index = state.get("plan_index", 0) + 1
    task_plan = state["task_plan"]
    if next_index >= len(task_plan):
        return {
            "status": "success",
            "next_route": "__end__",
            "result": {
                "status": "SUCCESS",
                "task_type": state["task_type"],
                "completed_agents": state.get("completed_agents", []),
                "artifacts": state.get("artifacts", {}),
            },
        }

    next_agent = task_plan[next_index]
    return {
        "plan_index": next_index,
        "current_agent": next_agent,
        "next_route": next_agent,
    }


def build_workflow(settings: Settings | None = None):
    settings = settings or Settings.from_env()
    graph = StateGraph(WorkflowState)
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("coordinator", coordinator_node)
    for agent_name in AGENTS:
        graph.add_node(agent_name, make_agent_node(agent_name, settings))

    graph.add_edge(START, "supervisor")
    graph.add_conditional_edges(
        "supervisor",
        lambda state: state["current_agent"],
        {name: name for name in AGENTS},
    )
    for agent_name in AGENTS:
        graph.add_edge(agent_name, "coordinator")
    graph.add_conditional_edges(
        "coordinator",
        lambda state: state["next_route"],
        {**{name: name for name in AGENTS}, "__end__": END},
    )
    return graph.compile()


def run_workflow(
    query: str,
    mode: str | None = None,
    task_type: str | None = None,
    active_paper_id: str | None = None,
    conversation_history: list[dict[str, Any]] | None = None,
    settings: Settings | None = None,
) -> WorkflowState:
    if not query.strip():
        raise ValueError("用户任务不能为空")
    if settings is not None and mode is not None:
        raise ValueError("settings 和 mode 不能同时传入")
    settings = settings or Settings.from_env(mode)
    workflow = build_workflow(settings)
    return workflow.invoke(
        {
            "user_query": query.strip(),
            "requested_task_type": task_type,
            "active_paper_id": active_paper_id,
            "conversation_history": conversation_history or [],
            "status": "pending",
            "max_revisions": settings.max_revisions,
        }
    )
