"""PDF 解析：读取 data/pdfs/{paper_id}.pdf 生成 chunk（含页码/坐标估计/文本）。

无真实 PDF 文件时回退：用论文摘要按句切成 chunk，保证返回结构一致。
"""
from __future__ import annotations

import re
from pathlib import Path

from research_assistant.tools.data_source import backend

_CHUNK_SIZE = 900


def _chunk_text(text: str, paper_id: str, page: int) -> list[dict]:
    text = text.strip()
    if not text:
        return []
    chunks: list[dict] = []
    # 按空白/换行切分段落，再按 _CHUNK_SIZE 合并
    segments = re.split(r"\n+", text)
    buf = ""
    seq = 0
    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue
        if buf and len(buf) + len(seg) > _CHUNK_SIZE:
            seq += 1
            chunks.append(_make_chunk(paper_id, page, seq, buf))
            buf = seg
        else:
            buf = (buf + "\n" + seg) if buf else seg
    if buf:
        seq += 1
        chunks.append(_make_chunk(paper_id, page, seq, buf))
    return chunks


def _make_chunk(paper_id: str, page: int, seq: int, text: str) -> dict:
    return {
        "chunk_id": f"{paper_id}-p{page}-c{seq}",
        "page": page,
        "bbox": [0, (page - 1) * 100, 600, page * 100],  # 坐标估计，前端高亮占位
        "text": text,
    }


def parse_pdf(paper_id: str, pdf_dir: Path) -> dict:
    """解析论文 PDF；文件不存在时回退为摘要分块。

    工程保护：校验 %PDF 文件头与 30MB 上限（与 evidence/reader 一致）。
    """
    pdf_path = pdf_dir / f"{paper_id}.pdf"
    if pdf_path.exists() and pdf_path.stat().st_size <= 30 * 1024 * 1024:
        try:
            head = pdf_path.open("rb").read(4)
            if head == b"%PDF":
                from pypdf import PdfReader  # noqa: PLC0415

                reader = PdfReader(str(pdf_path))
                chunks: list[dict] = []
                for i, page in enumerate(reader.pages, start=1):
                    text = page.extract_text() or ""
                    chunks.extend(_chunk_text(text, paper_id, i))
                if chunks:
                    return {"paper_id": paper_id, "source": str(pdf_path), "chunks": chunks[:60]}
        except Exception:
            pass  # 解析失败回退摘要

    p = backend.get_paper(paper_id) or {}
    abstract = p.get("abstract", "")
    chunks = _chunk_text(abstract, paper_id, 1) or [
        _make_chunk(paper_id, 1, 1, abstract or "（无摘要）")
    ]
    return {"paper_id": paper_id, "source": "abstract_fallback", "chunks": chunks}
