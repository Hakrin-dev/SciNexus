"""Writer（论文写作）：基于研究设想与学术证据链撰写、修改高可信度论文草稿。"""
from __future__ import annotations

import re

from research_assistant.agents.base import BaseAgent
from research_assistant.llm import LLMProvider
from research_assistant.schemas import ClaimEvidence, GeneratedFile, WrittenContent, WriterOutput, WriterPlan
from research_assistant.tools import tools
from research_assistant.tools.data_source import backend

SYSTEM_PROMPT = (
    "你是一位学术写作专家，精通顶级期刊会议的写作规范：\n"
    "\n"
    "【写作原则】\n"
    "1. 事实准确性：所有引用必须存在于证据链中，严禁虚构\n"
    "2. 逻辑连贯性：段落间使用过渡句连接，避免跳跃式论述\n"
    "3. 表达客观性：避免主观形容词，使用被动语态和第三人称\n"
    "4. 格式规范性：严格遵循目标会议的 LaTeX 模板要求\n"
    "\n"
    "【质量控制】\n"
    "- 每句话包含断言时必须映射到具体证据\n"
    "- 复杂概念用例子或类比进行解释\n"
    "- 图表标题自包含，无需回看正文即可理解\n"
    "- 摘要控制在 250 字以内，包含背景、方法、结果、结论四要素\n"
    "\n"
    "【禁止事项】\n"
    "严禁虚构任何参考文献、作者或 DOI 编号；不得抄袭他人作品而不正确引用；禁止使用歧视性、偏见性或"
    "不当语言；不允许夸大研究成果的实际意义；不得违反目标会议的匿名投稿规则。"
)


class WriterAgent(BaseAgent):
    name = "writer"

    def __init__(self, llm: LLMProvider) -> None:
        super().__init__(llm)
        self.system_prompt = SYSTEM_PROMPT

    @staticmethod
    def _topic_title(query: str) -> str:
        topic = query
        for token in ("请帮我", "帮我", "请", "生成一个", "生成", "撰写一篇关于", "撰写", "写一篇关于", "写一篇", "文献综述", "综述"):
            topic = topic.replace(token, " ")
        topic = re.sub(r"[「」：《》:，。,.\s]+", " ", topic).strip()
        return topic or query

    @classmethod
    def _topic_slug(cls, query: str) -> str:
        cleaned = re.sub(r"[^\w\u4e00-\u9fff-]+", "_", cls._topic_title(query)).strip("_")
        return (cleaned[:36] or "literature_review").lower()

    @staticmethod
    def _paper_line(pid: str) -> str:
        paper = backend.get_paper(pid) or {}
        title = paper.get("title") or pid
        author = paper.get("author") or "Unknown authors"
        year = paper.get("year") or ""
        venue = paper.get("venue") or "Unknown venue"
        return f"- [{pid}] {author}. {title}. {venue}, {year}."

    @staticmethod
    def _paper_summary(pid: str) -> str:
        paper = backend.get_paper(pid) or {}
        title = paper.get("title") or pid
        abstract = (paper.get("abstract") or "暂无摘要。").strip().replace("\n", " ")
        if len(abstract) > 220:
            abstract = abstract[:220].rstrip() + "..."
        return f"- **{title}** [{pid}]：{abstract}"

    def _build_literature_review_files(self, query: str, cited: list[str], latex: str) -> list[GeneratedFile]:
        topic = self._topic_title(query)
        slug = self._topic_slug(query)
        cited = cited[:8]
        references = "\n".join(self._paper_line(pid) for pid in cited) or "- 暂无可用引用，请先完成论文检索。"
        summaries = "\n".join(self._paper_summary(pid) for pid in cited[:5]) or "- 暂无可用论文摘要。"
        review_md = f"""# {topic}：文献综述

## 摘要
本文围绕“{topic}”梳理已有研究脉络，重点关注代表性方法、技术演进、实验范式与未来问题。综述基于当前论文库检索结果生成，引用条目均来自已加载数据库。

## 1. 研究背景
该方向的发展通常由基础模型、任务需求和工程约束共同推动。早期工作侧重核心机制验证，后续研究逐渐转向效率、可扩展性、泛化能力和真实场景部署。

## 2. 代表性工作
{summaries}

## 3. 方法脉络
从已检索论文看，相关研究大体可分为三条路线：一是通过架构设计提升表达能力；二是通过训练策略与数据构造改善泛化；三是通过系统优化降低部署成本。

## 4. 对比分析
| 维度 | 主要关注点 | 写作建议 |
| --- | --- | --- |
| 方法创新 | 架构、目标函数、训练范式 | 对比核心假设和适用边界 |
| 实验设置 | 数据集、指标、baseline | 优先引用公开可复现实验 |
| 工程价值 | 复杂度、显存、延迟 | 区分研究原型和生产部署 |

## 5. 未来方向
未来研究可进一步关注长上下文处理、低资源适配、可信评测、跨领域迁移和可解释性。若用于正式论文，建议继续补充近两年顶会论文并扩展实验对比表。

## 参考文献
{references}
"""
        return [
            GeneratedFile(path=f"docs/{slug}_文献综述.md", language="markdown", content=review_md),
            GeneratedFile(path=f"paper/{slug}_review.tex", language="latex", content=latex),
        ]

    def run(self, state: dict) -> dict:
        query = state["user_query"]
        wm = state.get("working_memory") or {}
        ev = wm.get("evidence_chain_index") or {}
        paper_ids = ev.get("paper_ids") or []

        # 阶段1. LLM 规划：确定章节类型、目标风格与拟引用文献（mock 回显确定性计划）
        plan: WriterPlan = self.generate(
            {"user_query": query, "available_papers": paper_ids[:3]},
            WriterPlan,
            {"section_type": "Abstract", "style_preference": "IEEE", "cited_paper_ids": paper_ids[:3]},
        )

        # 阶段2. 工具执行：从全局工作记忆中提取证据链 Chunk 作为断言锚点
        chunks = []
        for pid in plan.cited_paper_ids:
            chunks.extend(tools.call("pdf_parser", paper_id=pid).get("chunks", []))
        anchors = [c["chunk_id"] for c in chunks[:3]]

        # 阶段3. 生成包含真实引用的 LaTeX 文本，建立「断言-证据」映射表
        cited = list(plan.cited_paper_ids) or paper_ids[:3]
        latex = (
            "\\section{Abstract}\n"
            f"我们针对 {query} 展开研究，相关工作建立在已有成果之上"
            + "".join(f"~\\cite{{{pid}}}" for pid in cited)
            + "。\n"
        )
        claim_map = [
            ClaimEvidence(claim=f"已有工作 {pid} 为本文提供基础。", source_chunk_id=anchors[i] if i < len(anchors) else "")
            for i, pid in enumerate(cited)
        ]

        # 4. 通过 DPO 风格对齐，去除口语化表述（mock 直接对齐文本）
        latex = tools.call("dpo_align", text=latex, style=plan.style_preference)

        generated_files = self._build_literature_review_files(query, cited, latex)

        content = WrittenContent(
            section_name=plan.section_type,
            latex_payload=latex,
            cited_paper_ids=cited,
            claim_evidence_map=claim_map,
        )
        output = self.generate(
            {"query": query, "plan": plan.model_dump(), "evidence_anchors": anchors, "draft_content": content.model_dump()},
            WriterOutput,
            {
                "status": "SUCCESS",
                "written_content": content.model_dump(),
                "generated_files": [file.model_dump() for file in generated_files],
            },
        )
        wm = self.remember(state, "write paper draft", output.model_dump(), paper_ids=cited)
        return {"last_output": output.model_dump(), "working_memory": wm}
