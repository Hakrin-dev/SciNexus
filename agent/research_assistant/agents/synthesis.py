"""Knowledge Synthesis（知识综合）：深度阅读与结构化解析单篇或多篇论文。"""
from __future__ import annotations

from research_assistant.agents.base import BaseAgent
from research_assistant.llm import LLMProvider
from research_assistant.schemas import AnchoredText, StructuredElements, SynthesisOutput, SynthesisPlan
from research_assistant.tools import tools
from research_assistant.tools.data_source import backend

SYSTEM_PROMPT = (
    "你是一位深度阅读专家，专注于从学术论文中提取结构化知识：\n"
    "\n"
    "【分析维度】\n"
    "1. 核心创新点：识别方法论突破、理论贡献、应用场景拓展\n"
    "2. 实验设计：数据集选择、基线对比、评价指标合理性\n"
    "3. 技术细节：关键公式推导、算法复杂度、实现难点\n"
    "4. 局限性分析：假设条件、适用范围、潜在缺陷\n"
    "\n"
    "【输出要求】\n"
    "- 使用 Markdown 格式组织内容，包含目录导航\n"
    "- 关键结论必须标注原文位置（页码/段落）\n"
    "- 提供跨文档对比表格，突出异同点\n"
    "- 生成可执行的问答对，支持后续交互\n"
    "\n"
    "【禁止事项】\n"
    "严禁虚构论文中的实验数据或结论；不得遗漏关键的方法论细节；禁止将不同论文的内容混淆或张冠李戴；"
    "不允许使用主观臆测替代客观分析；不得忽略原文中的重要限制条件和假设。"
)


class SynthesisAgent(BaseAgent):
    name = "synthesis"

    def __init__(self, llm: LLMProvider) -> None:
        super().__init__(llm)
        self.system_prompt = SYSTEM_PROMPT

    @staticmethod
    def _clean_question(query: str) -> str:
        for marker in ("我的问题是：", "我的问题是:"):
            if marker in query:
                return query.split(marker, 1)[-1].strip()
        return query.strip()

    @staticmethod
    def _paper_context(pid: str) -> str:
        paper = backend.get_paper(pid) or {}
        title = paper.get("title") or pid
        venue = paper.get("venue") or "未知来源"
        year = paper.get("year") or "未知年份"
        keywords = "、".join(paper.get("keywords") or [])
        abstract = (paper.get("abstract") or "").strip()
        if abstract:
            return abstract
        parts = [f"论文《{title}》发表于 {venue} {year}。"]
        if keywords:
            parts.append(f"关键词包括：{keywords}。")
        parts.append("当前库中缺少完整摘要，以下研读基于题名、发表信息、关键词与可用证据生成。")
        return "".join(parts)

    @staticmethod
    def _usable_text(text: str | None) -> str:
        text = (text or "").strip()
        return "" if text in {"（无摘要）", "(无摘要)", "暂无摘要"} else text

    def run(self, state: dict) -> dict:
        query = state["user_query"]
        ev = (state.get("working_memory") or {}).get("evidence_chain_index") or {}
        paper_ids = ev.get("paper_ids") or []
        if not paper_ids:
            paper_ids = [p["paper_id"] for p in backend.papers if p.get("paper_id") and p["paper_id"] in query]
        if not paper_ids:
            lower = query.lower()
            paper_ids = [
                p["paper_id"] for p in backend.papers
                if p.get("title") and p.get("title", "").lower() in lower
            ][:1]
        if not paper_ids and backend.papers:
            paper_ids = [backend.papers[0]["paper_id"]]

        # 阶段1. LLM 规划：从证据链中选择要精读的论文与抽取要素（mock 回显确定性计划）
        plan: SynthesisPlan = self.generate(
            {"user_query": query, "available_papers": paper_ids},
            SynthesisPlan,
            {
                "paper_ids": paper_ids,
                "extraction_schema": ["core_innovation", "methodology", "experimental_results", "key_challenges"],
            },
        )

        # 阶段2. 工具执行：解析 PDF + 按问题做混合证据检索（BM25+TF-IDF+RRF），产出页码锚点
        from research_assistant.tools.evidence import build_structured_analysis  # noqa: PLC0415

        evidence_all: list[dict] = []
        analyses: dict[str, dict] = {}
        for pid in plan.paper_ids:
            parsed = tools.call("pdf_parser", paper_id=pid)
            chunks = parsed.get("chunks", [])
            if chunks:
                analyses[pid] = build_structured_analysis(chunks)
            ev_hits = tools.call("evidence_retrieve", paper_id=pid, question=query, limit=3).get("evidence", [])
            for item in ev_hits:
                item["paper_id"] = pid
                evidence_all.append(item)
        evidence_all.sort(key=lambda e: -e.get("rrf_score", 0))
        target_chunks = [e["chunk_id"] for e in evidence_all[:6]]
        anchors = [f"{e.get('paper_id', '')}·第{e['page']}页·{e['chunk_id']}" for e in evidence_all[:3]]

        # 阶段3. 要素抽取 + 结构重组：用检索到的证据构建结构化要素（含页码溯源）
        first = evidence_all[0] if evidence_all else {}
        first_text = first.get("text", "")
        if not first_text or first_text == "（无摘要）":
            first_text = self._paper_context(plan.paper_ids[0]) if plan.paper_ids else ""
        question = self._clean_question(query)
        comparison_table = "\n".join(
            f"| {pid} | 创新点 | 实验设计 | 结论 |" for pid in plan.paper_ids
        )
        elements = StructuredElements(
            summary=f"对 {len(plan.paper_ids)} 篇论文进行结构化精读，回答问题：「{question}」。",
            core_innovation=AnchoredText(
                text=first_text[:500],
                anchor_bbox=None,
                chunk_id=first.get("chunk_id"),
            ),
            methodology="\n\n".join(
                f"### {pid}\n{self._usable_text(a.get('methodology', {}).get('content')) or self._paper_context(pid)}"
                for pid, a in analyses.items()
            ) or "\n\n".join(f"### {pid}\n{self._paper_context(pid)}" for pid in plan.paper_ids) or "## 方法\n暂无足够证据。",
            experimental_results=f"## 实验\n跨文档对比表：\n{comparison_table}",
            key_challenges="\n\n".join(
                f"### {pid}\n{self._usable_text(a.get('limitations', {}).get('content')) or '建议重点核查论文是否报告强基线、消融实验、泛化设置和失败案例。'}"
                for pid, a in analyses.items()
            ) or "## 局限\n建议重点核查论文是否报告强基线、消融实验、泛化设置和失败案例。",
        )
        page_note = "、".join(anchors) or "无"
        draft = {
            "status": "SUCCESS",
            "structured_elements": elements.model_dump(),
            "qa_response": (
                f"已基于证据链中 {len(plan.paper_ids)} 篇论文完成精读并回答你的问题：「{question}」。\n"
                f"关键证据位置：{page_note}\n"
                "FAQ：\n- 该方向的核心创新是什么？\n- 各方法的实验设置有何异同？（见对比表）"
            ),
        }
        payload = {
            "query": query,
            "plan": plan.model_dump(),
            "target_chunks": target_chunks,
            "evidence": evidence_all[:6],
            "extracted_elements": elements.model_dump(),
        }
        output: SynthesisOutput = self.generate(payload, SynthesisOutput, draft)
        result = output.model_dump() | {"target_chunks": target_chunks, "evidence": evidence_all[:6]}
        wm = self.remember(state, "read & structure papers", result, paper_ids=list(plan.paper_ids))
        return {"last_output": result, "working_memory": wm}
