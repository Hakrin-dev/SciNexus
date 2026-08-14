"""交叉编码器重排的单测（重点覆盖模型不可用时的降级行为）。"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
AGENT_DIR = PROJECT_ROOT / "agent"
for _p in (AGENT_DIR, PROJECT_ROOT):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from research_assistant.tools.reranker import CrossEncoderReranker  # noqa: E402


def _unavailable_reranker() -> CrossEncoderReranker:
    r = CrossEncoderReranker("__invalid_model__")
    r._tried = True
    r._model = None  # 模拟模型不可用
    return r


def test_fallback_when_model_unavailable() -> None:
    """模型不可用时 rerank 原序返回、不改 relevance_score。"""
    r = _unavailable_reranker()
    papers = [
        {"paper_id": "A", "title": "t1", "abstract": "a1", "relevance_score": 0.9},
        {"paper_id": "B", "title": "t2", "abstract": "a2", "relevance_score": 0.5},
    ]
    out = r.rerank("query", papers, top_k=5)
    assert [p["paper_id"] for p in out] == ["A", "B"]
    assert out[0]["relevance_score"] == 0.9


def test_fallback_truncates_to_top_k() -> None:
    """降级时仍截取 top_k。"""
    r = _unavailable_reranker()
    papers = [
        {"paper_id": str(i), "title": "", "abstract": "", "relevance_score": 0.5}
        for i in range(10)
    ]
    out = r.rerank("query", papers, top_k=3)
    assert len(out) == 3


def test_doc_text_uses_title_and_abstract() -> None:
    """文档文本取标题 + 摘要（重排输入）。"""
    r = CrossEncoderReranker("__x__")
    assert r._doc_text({"paper_id": "A", "title": "Hello", "abstract": "World"}) == "Hello World"


def test_doc_text_falls_back_to_paper_id() -> None:
    """标题摘要都空时回退到 paper_id。"""
    r = CrossEncoderReranker("__x__")
    assert r._doc_text({"paper_id": "A", "title": "", "abstract": ""}) == "A"
