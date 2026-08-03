from __future__ import annotations

from .state import AgentName

ROUTING_RULES: list[tuple[tuple[str, ...], AgentName, str]] = [
    (("代码", "python", "报错", "程序", "实现"), "code_assistant", "coding"),
    (("审稿", "检查论文", "投稿", "期刊", "会议"), "critic", "paper_review"),
    (("写论文", "撰写", "摘要", "引言", "latex"), "writer", "paper_writing"),
    (("科研探索", "研究趋势", "趋势分析", "研究探索"), "scout", "research_exploration"),
    (("研究方案", "实验设计", "创新点", "研究问题", "课题"), "research_design", "research_design"),
    (("文献库", "知识图谱", "相似论文", "共引", "引用网络"), "librarian", "library_management"),
    (("精读", "阅读论文", "总结论文", "解释公式", "pdf"), "synthesis", "paper_reading"),
    (
        (
            "搜索",
            "检索",
            "找论文",
            "文献",
            "search paper",
            "paper search",
        ),
        "scout",
        "paper_search",
    ),
]


def route_query(query: str) -> tuple[AgentName, str]:
    normalized = query.lower()
    for keywords, agent, task_type in ROUTING_RULES:
        if any(keyword in normalized for keyword in keywords):
            return agent, task_type
    return "research_design", "research_exploration"


TASK_PLANS: dict[str, list[AgentName]] = {
    "paper_search": ["scout"],
    "paper_reading": ["synthesis"],
    "library_management": ["scout", "librarian"],
    "research_design": ["scout", "librarian", "research_design"],
    "research_exploration": ["scout", "librarian", "research_design"],
    "coding": ["code_assistant"],
    "paper_writing": ["writer", "critic"],
    "paper_review": ["critic"],
}


def create_task_plan(
    query: str, requested_task_type: str | None = None
) -> tuple[str, list[AgentName]]:
    if requested_task_type:
        if requested_task_type not in TASK_PLANS:
            raise ValueError(f"不支持的任务闭环：{requested_task_type}")
        return requested_task_type, list(TASK_PLANS[requested_task_type])
    first_agent, task_type = route_query(query)
    plan = TASK_PLANS.get(task_type, [first_agent])
    return task_type, list(plan)
