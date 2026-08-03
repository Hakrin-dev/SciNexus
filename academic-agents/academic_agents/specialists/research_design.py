from __future__ import annotations

from typing import Any

from academic_agents.config import Settings
from academic_agents.state import WorkflowState

from .base import BaseAgent


class ResearchDesignAgent(BaseAgent):
    name = "research_design"
    title = "研究设计智能体"
    responsibility = "基于已有文献提出不过度夸大的假设和可验证实验。"

    def run(self, state: WorkflowState, settings: Settings) -> dict[str, Any]:
        papers = state.get("artifacts", {}).get("papers", [])
        is_exploration_task = state.get("task_type") == "research_exploration"
        model_proposal = self.call_model(
            f"用户目标：{state['user_query']}。论文元数据：{papers[:5]}。"
            + (
                "请围绕用户的具体问题形成一份简明研究报告。"
                "先直接回答问题，再总结主要发现、证据论文、可能的研究空白和局限；"
                "不要擅自把所有问题都改写成趋势分析，不得虚构。"
                if is_exploration_task
                else "请提出保守、可验证的研究设计。"
            ),
            settings,
        )
        result = {
            "status": "SUCCESS",
            "agent": self.title,
            "proposal": {
                "title": "面向复杂任务的可验证多智能体协作研究",
                "core_hypothesis": "显式角色分工和审查反馈可能降低协作过程中的矛盾率。",
                "novelty_level": "待文献全文核验",
                "experimental_design": {
                    "datasets": ["公开推理任务集", "公开代码任务集"],
                    "baselines": ["单智能体", "无审查多智能体"],
                    "metrics": ["任务成功率", "矛盾率", "成本", "延迟"],
                    "ablations": ["移除 Critic", "移除共享记忆"],
                },
            },
            "model_analysis": model_proposal,
            "evidence_count": len(papers),
            "warning": "这是研究方案草案，不代表实验已经执行或创新性已经证实。",
        }
        if is_exploration_task:
            result["research_report"] = self._build_research_report(
                state["user_query"], papers, model_proposal
            )
        return result

    @staticmethod
    def _build_research_report(
        user_query: str,
        papers: list[dict[str, Any]],
        model_analysis: str | None,
    ) -> dict[str, Any]:
        year_distribution: dict[str, int] = {}
        for paper in papers:
            year = str(paper.get("year") or "未知")
            year_distribution[year] = year_distribution.get(year, 0) + 1

        topic_rules = {
            "协作与通信机制": ("collaboration", "cooperative", "communication"),
            "规划与复杂任务求解": ("planning", "task solving", "reasoning"),
            "强化学习优化": ("reinforcement learning", "grpo", "reward"),
            "评测与可靠性": ("evaluation", "benchmark", "verification", "robust"),
            "行业应用": ("medical", "education", "fire", "software"),
        }
        topic_signals = []
        for label, keywords in topic_rules.items():
            matched_titles = [
                paper.get("title", "")
                for paper in papers
                if any(
                    keyword
                    in f"{paper.get('title', '')} {paper.get('abstract') or ''}".lower()
                    for keyword in keywords
                )
            ]
            if matched_titles:
                topic_signals.append(
                    {
                        "topic": label,
                        "paper_count": len(matched_titles),
                        "evidence_titles": matched_titles[:3],
                    }
                )

        cited = sorted(
            papers,
            key=lambda paper: paper.get("citation_count") or 0,
            reverse=True,
        )
        return {
            "question": user_query,
            "evidence_count": len(papers),
            "evidence_summary": (
                f"本报告基于本次检索到的 {len(papers)} 条论文元数据生成。"
                if papers
                else "本次没有检索到可用论文，因此只能报告证据不足，不能形成可靠结论。"
            ),
            "year_distribution": dict(
                sorted(year_distribution.items(), key=lambda item: item[0])
            ),
            "topic_evidence": topic_signals,
            "most_cited_in_sample": [
                {
                    "title": paper.get("title"),
                    "year": paper.get("year"),
                    "citation_count": paper.get("citation_count") or 0,
                    "doi": paper.get("doi"),
                }
                for paper in cited[:3]
            ],
            "answer": (
                model_analysis
                or "演示模式只展示结构化证据概览；切换到真实模型后，会围绕你的问题生成完整文字报告。"
            ),
            "limitations": [
                "报告仅基于本次 Crossref 检索样本，不代表完整系统综述。",
                "引用数受发表时间影响，较新的论文通常引用较少。",
                "正式结论需要扩大数据库来源并阅读论文全文后复核。",
            ],
        }
