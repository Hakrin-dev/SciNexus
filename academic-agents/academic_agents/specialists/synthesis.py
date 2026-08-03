from __future__ import annotations

from typing import Any

from academic_agents.config import Settings
from academic_agents.state import WorkflowState
from academic_agents.tools.document_store import DocumentStore
from academic_agents.tools.hybrid_retriever import hybrid_retrieve
from academic_agents.tools.paper_reader import (
    download_pdf,
    extract_url_and_question,
)

from .base import BaseAgent


class SynthesisAgent(BaseAgent):
    name = "synthesis"
    title = "知识综合智能体"
    responsibility = "提取摘要、创新、方法、实验和难点，并保留证据位置。"

    def run(self, state: WorkflowState, settings: Settings) -> dict[str, Any]:
        store = DocumentStore()
        paper_id = state.get("active_paper_id")
        raw_question = state["user_query"].strip()
        contains_url = "http://" in raw_question or "https://" in raw_question
        cache_hit = bool(paper_id) and not contains_url
        if paper_id and not contains_url:
            raw_question = state["user_query"].strip()
            question = raw_question
            metadata = store.load_metadata(paper_id)
        else:
            source_url, question = extract_url_and_question(raw_question)
            pdf_bytes, resolved_pdf_url = download_pdf(source_url)
            filename = resolved_pdf_url.rsplit("/", 1)[-1] or "paper.pdf"
            metadata, cache_hit = store.ingest_pdf(
                pdf_bytes,
                filename=filename,
                source_url=source_url,
                resolved_pdf_url=resolved_pdf_url,
            )
            paper_id = metadata["paper_id"]

        chunks = store.load_chunks(paper_id)
        evidence = hybrid_retrieve(chunks, question, limit=6)
        conversation = state.get("conversation_history", [])[-4:]
        evidence_text = "\n\n".join(
            f"[第 {item['page']} 页，{item['chunk_id']}]\n{item['text']}"
            for item in evidence
        )
        model_answer = self.call_model(
            f"最近对话：{conversation}\n\n"
            f"用户问题：{question}\n\n"
            f"论文证据片段：\n{evidence_text}\n\n"
            "请仅根据证据回答。每个关键结论都用[第X页]标注来源；"
            "如果证据不足，明确说无法从当前片段确认。最后列出可关联阅读的页码和原因。",
            settings,
        )
        evidence_pages = sorted({item["page"] for item in evidence})
        return {
            "status": "SUCCESS",
            "agent": self.title,
            "paper_id": paper_id,
            "filename": metadata["filename"],
            "cache_hit": cache_hit,
            "question": question,
            "answer": (
                model_answer
                or (
                    "演示模式已完成混合检索，相关证据位于"
                    + "、".join(f"第 {page} 页" for page in evidence_pages)
                    + "。切换到真实模型后，会依据这些证据生成完整回答。"
                )
            ),
            "source_url": metadata.get("source_url"),
            "resolved_pdf_url": metadata.get("resolved_pdf_url"),
            "page_count": metadata["page_count"],
            "chunk_count": metadata["chunk_count"],
            "extracted_characters": metadata["extracted_characters"],
            "evidence_anchors": evidence,
            "structured_analysis": store.load_structured_analysis(paper_id),
            "retrieval_method": "BM25 关键词检索 + TF-IDF 字符向量检索 + RRF 融合",
            "related_sections": [
                {
                    "page": item["page"],
                    "chunk_id": item["chunk_id"],
                    "reason": "该片段与用户问题的关键词或语义线索相关。",
                }
                for item in evidence
            ],
            "limitations": [
                "答案只基于成功提取的 PDF 文字，不包含图片中的文字。",
                "当前向量检索使用本地 TF-IDF 字符向量，不等同于大型语义嵌入模型。",
                "复杂公式、跨栏排版和表格可能需要人工查看原始页面复核。",
            ],
        }
