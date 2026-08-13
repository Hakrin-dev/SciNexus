"""Server -> Agent 网关：把 FastAPI 的搜索/对话转发到多智能体框架。

通过环境变量 AGENT_ENABLED 控制（默认 true；false 则回退到 server 自带 mock）。
agent 包懒加载（首次调用才 import 并构建数据后端），避免拖慢 server 启动。
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent
AGENT_DIR = SERVER_DIR.parent / "agent"
if str(AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(AGENT_DIR))

AGENT_ENABLED = os.getenv("AGENT_ENABLED", "true").lower() not in ("0", "false", "no")


def _run_agent(user_query: str, task_type: str | None = None) -> dict:
    """运行一次 agent 工作流，返回完整 result 状态。"""
    from research_assistant.graph import build_graph  # noqa: PLC0415

    graph = build_graph(checkpoint=False)
    initial = {
        "user_query": user_query,
        "plan_index": 0,
        "working_memory": {
            "session_context": [],
            "evidence_chain_index": {"paper_ids": []},
            "agent_outputs": {},
        },
    }
    if task_type:
        initial["raw_input"] = {"task_type": task_type}
    return graph.invoke(initial)


def _to_frontend_paper(p: dict, structured: dict | None = None) -> dict:
    """agent 内部论文契约 -> 前端 server/data 结构（id/authors/match/matchLabel/citations 等）。

    structured 仅在非 None 时写入返回 dict，保证列表场景（search_papers/list_papers）
    的载荷与之前完全一致。
    """
    citations = int(p.get("citation_count", 0) or 0)
    match = p.get("match_label") or p.get("match_level", "").lower()
    if not match:
        match = "partial"
    result = {
        "id": p.get("paper_id", ""),
        "title": p.get("title", ""),
        "authors": p.get("author", ""),
        "venue": p.get("venue") or "",
        "ccf": p.get("ccf"),
        "match": match,
        "matchLabel": match.capitalize(),
        "abstract": p.get("abstract") or "",
        "citations": f"{citations:,}+" if citations else "0",
        "heat": p.get("heat") or "Warm",
        "year": p.get("year", 0),
        "keywords": p.get("keywords", []),
        "doi": p.get("doi"),
        "institute": p.get("institute"),
    }
    if structured is not None:
        result["structured"] = structured
    return result


def _workflow_trace(result: dict) -> dict:
    """把 LangGraph 运行态压缩成前端可展示的流程轨迹。"""
    plan = result.get("task_plan") or []
    outputs = (result.get("working_memory") or {}).get("agent_outputs") or {}
    errors = result.get("errors") or []
    failed_agents = {e.get("agent") for e in errors if e.get("agent")}
    steps = [
        {"agent": "supervisor", "action": "规划任务并授权工具", "status": "done"}
    ]
    for step in plan:
        agent = step.get("agent", "")
        if agent in failed_agents:
            status = "failed"
        elif agent in outputs:
            status = "done"
        else:
            status = "pending"
        steps.append({
            "agent": agent,
            "action": step.get("action", ""),
            "status": status,
            "tools": step.get("authorized_tools", []),
        })
    return {
        "task_id": (result.get("intent") or {}).get("task_id", ""),
        "agents": (result.get("intent") or {}).get("required_agents", []),
        "steps": steps,
        "errors": errors,
        "status": ((result.get("working_memory") or {}).get("task_state") or {}).get("status", "done"),
    }


def _direct_search(query: str, top_k: int) -> list[dict]:
    """Supervisor/LLM 不可用时，直接使用已初始化的数据后端检索。"""
    from research_assistant.tools.data_source import backend  # noqa: PLC0415

    by_id = {p["paper_id"]: p for p in backend.papers}
    ranked_ids = [h["paper_id"] for h in backend.vector.search(query, top_k)]
    papers = [by_id[pid] for pid in ranked_ids if pid in by_id]
    if papers:
        return papers[:top_k]

    q = query.lower()
    fallback = []
    for p in backend.papers:
        blob = " ".join([p.get("title", ""), p.get("abstract", ""), " ".join(p.get("keywords", []))]).lower()
        if any(token and token in blob for token in q.split()):
            fallback.append(p)
    return fallback[:top_k]


def search_papers(query: str, top_k: int = 10, task_type: str | None = None) -> dict:
    """调用 agent（scout 检索），返回前端兼容的 {data, meta}。"""
    result = _run_agent(query, task_type or "paper_search")
    outputs = result.get("working_memory", {}).get("agent_outputs", {})
    papers = (outputs.get("scout") or {}).get("retrieved_papers", [])[:top_k]
    workflow = _workflow_trace(result)
    if not papers:
        papers = _direct_search(query, top_k)
        workflow["steps"].append({
            "agent": "data_source",
            "action": "Supervisor 不可用或无结果，直接查询已加载论文库",
            "status": "done",
            "tools": ["vector_index"],
        })
        workflow["agents"] = list(dict.fromkeys([*workflow.get("agents", []), "data_source"]))
    return {
        "data": [_to_frontend_paper(p) for p in papers],
        "meta": {
            "query": query,
            "count": len(papers),
            "task_type": (result.get("intent") or {}).get("task_type", ""),
            "agents": (result.get("intent") or {}).get("required_agents", []),
            "workflow": workflow,
        },
    }


def chat(message: str, task_type: str | None = None) -> str:
    """调用 agent 全流程，返回 final_response 作为对话回复。"""
    return chat_with_meta(message, task_type)["reply"]


def chat_with_meta(message: str, task_type: str | None = None) -> dict:
    """调用 agent 全流程，返回回复与前端可展示的工作流。"""
    result = _run_agent(message, task_type)
    outputs = (result.get("working_memory") or {}).get("agent_outputs") or {}
    if result.get("errors") and not outputs:
        raise RuntimeError(f"agent 工作流失败: {result.get('errors')}")
    return {"reply": result.get("final_response") or "（agent 未产生回复）", "workflow": _workflow_trace(result)}


def list_papers(page: int = 1, page_size: int = 10) -> dict:
    """论文列表（读 agent 数据后端，与检索同源）。"""
    from research_assistant.tools.data_source import backend  # noqa: PLC0415

    all_papers = backend.papers
    total = len(all_papers)
    start = (page - 1) * page_size
    data = [_to_frontend_paper(p) for p in all_papers[start : start + page_size]]
    return {
        "data": data,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


def get_paper(paper_id: str) -> dict | None:
    """论文详情（agent 数据后端），附带结构化分析（store 异常时降级为无 structured）。"""
    from research_assistant.tools.data_source import backend  # noqa: PLC0415

    p = backend.get_paper(paper_id)
    if not p:
        return None
    try:
        structured = backend.store.load_structured_analysis(paper_id)
    except Exception:
        structured = None
    return _to_frontend_paper(p, structured)


def recommended_papers(limit: int = 9) -> dict:
    """每日推荐：按引用量从真实论文库取前 N 篇（替代 server mock 的写死列表）。"""
    from research_assistant.tools.data_source import backend  # noqa: PLC0415

    ranked = sorted(
        backend.papers,
        key=lambda p: int(p.get("citation_count", 0) or 0),
        reverse=True,
    )[:limit]
    return {"data": [_to_frontend_paper(p) for p in ranked], "updated": "2026-08-11"}


def get_structured(paper_id: str) -> dict | None:
    """按 paper_id 读取结构化分析（兼容 mock 论文 p1-p11 等非 sqlite 论文）。"""
    from research_assistant.tools.data_source import DATA_DIR  # noqa: PLC0415
    from research_assistant.tools.store import PaperStore  # noqa: PLC0415

    try:
        store = PaperStore.open(str(DATA_DIR / "research.sqlite"))
        try:
            return store.load_structured_analysis(paper_id)
        finally:
            store.close()
    except Exception:
        return None


def venue_stats() -> dict:
    """供统计使用：论文总数 / CCF 分布。"""
    from research_assistant.tools.data_source import backend  # noqa: PLC0415

    by_ccf: dict[str, int] = {}
    for p in backend.papers:
        ccf = p.get("ccf") or "未知"
        by_ccf[ccf] = by_ccf.get(ccf, 0) + 1
    return {"papers": {"total": len(backend.papers), "by_ccf": by_ccf}}
