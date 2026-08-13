"""server.agent_gateway.get_fulltext 全文分块的 TDD 测试。

验证：有 PDF 的论文返回 has_pdf=true 且按 (页码, 序号) 排序的分块；
无 PDF 时回退摘要/分析分块（has_pdf=false）；论文不存在时返回 None。
"""
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
AGENT_DIR = PROJECT_ROOT / "agent"
if str(AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(AGENT_DIR))
# server 包需要项目根目录在 sys.path 上（main.py 同样做了该插入）
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


class _StubBackend:
    """最小 Backend 替身：只实现 get_fulltext 需要访问的 get_paper。"""

    def __init__(self, paper: dict | None) -> None:
        self._paper = paper

    def get_paper(self, paper_id: str) -> dict | None:
        return self._paper


def _patch(monkeypatch, paper: dict | None, pdf_result: dict | None) -> None:
    """替身后端与 parse_pdf（get_fulltext 在函数内懒加载二者）。"""
    monkeypatch.setattr("research_assistant.tools.data_source.backend", _StubBackend(paper))
    if pdf_result is not None:
        monkeypatch.setattr(
            "research_assistant.tools.pdf.parse_pdf",
            lambda paper_id, pdf_dir, max_chunks=60: pdf_result,
        )


def test_get_fulltext_has_pdf_sorts_chunks_numerically(monkeypatch) -> None:
    from server import agent_gateway

    _patch(
        monkeypatch,
        paper={"paper_id": "p1", "title": "T", "abstract": "A"},
        pdf_result={
            "paper_id": "p1",
            "source": str(PROJECT_ROOT / "server" / "data" / "pdfs" / "p1.pdf"),
            "chunks": [
                {"chunk_id": "p1-p1-c10", "page": 1, "bbox": [], "text": "第十段"},
                {"chunk_id": "p1-p2-c1", "page": 2, "bbox": [], "text": "第二页首段"},
                {"chunk_id": "p1-p1-c2", "page": 1, "bbox": [], "text": "第二段"},
            ],
        },
    )

    result = agent_gateway.get_fulltext("p1")

    assert result is not None
    assert result["paper_id"] == "p1"
    assert result["has_pdf"] is True
    assert result["source"].endswith("p1.pdf")
    # 同页内按序号排序（c2 在 c10 前），跨页按页码
    assert [c["chunk_id"] for c in result["chunks"]] == [
        "p1-p1-c2", "p1-p1-c10", "p1-p2-c1",
    ]
    for chunk in result["chunks"]:
        assert {"chunk_id", "page", "text"} <= set(chunk)
        assert "bbox" not in chunk


def test_get_fulltext_fallback_no_pdf(monkeypatch) -> None:
    from server import agent_gateway

    _patch(
        monkeypatch,
        paper={"paper_id": "p1", "title": "T", "abstract": "A"},
        pdf_result={
            "paper_id": "p1",
            "source": "abstract_fallback",
            "chunks": [
                {"chunk_id": "p1-p1-c1", "page": 1, "bbox": [], "text": "摘要分块"},
            ],
        },
    )

    result = agent_gateway.get_fulltext("p1")

    assert result is not None
    assert result["has_pdf"] is False
    assert result["source"] == "abstract_fallback"
    assert result["chunks"][0]["text"] == "摘要分块"


def test_get_fulltext_unknown_paper_returns_none(monkeypatch) -> None:
    from server import agent_gateway

    _patch(monkeypatch, paper=None, pdf_result=None)

    assert agent_gateway.get_fulltext("nope") is None


def test_get_fulltext_mock_library_paper_without_backend(monkeypatch) -> None:
    """p1 等演示论文不在 agent 后端，但在 server mock 论文库 → 仍应返回全文分块。"""
    from server import agent_gateway
    from server.data.mock_data import PAPERS

    p1 = next(p for p in PAPERS if p["id"] == "p1")
    _patch(
        monkeypatch,
        paper=None,
        pdf_result={
            "paper_id": "p1",
            "source": str(PROJECT_ROOT / "server" / "data" / "pdfs" / "p1.pdf"),
            "chunks": [
                {"chunk_id": "p1-p1-c1", "page": 1, "bbox": [], "text": "Transformer 原文"},
            ],
        },
    )

    result = agent_gateway.get_fulltext("p1")

    assert result is not None
    assert result["has_pdf"] is True
    assert result["chunks"][0]["text"] == "Transformer 原文"
