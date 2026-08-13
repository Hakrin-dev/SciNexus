"""server.agent_gateway 结构化分析透传的 TDD 测试。

验证 get_paper 从 store 加载结构化分析并透传到前端契约（structured 字段），
且列表/无数据场景保持原契约（不出现 structured 键）。
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


SAMPLE_ANALYSIS = {
    "summary": {"content": "本文提出面向图推理的新架构", "evidence": []},
    "core_innovation": {
        "content": "跨层注意力机制，在保持表达能力的同时降低显存开销",
        "evidence": [{"page": 1, "chunk_id": "c0", "quote": "cross-layer attention"}],
    },
    "methodology": {"content": "基于图神经网络的端到端训练", "evidence": []},
    "experiments": {"content": "四个数据集上超过全部基线", "evidence": []},
    "limitations": {"content": "仅在中小规模图上验证", "evidence": []},
    "note": "demo 分析",
}


def _make_paper() -> dict:
    """构造一条带完整内部字段的论文契约（覆盖 _to_frontend_paper 全部来源字段）。"""
    return {
        "paper_id": "W123",
        "title": "A Novel Architecture for Graph Reasoning",
        "author": "Alice Zhang",
        "year": 2024,
        "venue": "ICLR",
        "ccf": "A",
        "citation_count": 12,
        "abstract": "We propose a novel architecture for knowledge graph reasoning.",
        "keywords": ["graph", "reasoning"],
        "heat": "high",
        "match_label": "match",
        "doi": "10.1234/abc",
        "institute": "Tsinghua",
    }


class _StubStore:
    """最小 store 替身：只实现 get_paper 需要访问的 load_structured_analysis。"""

    def __init__(self, analysis: dict | None) -> None:
        self._analysis = analysis

    def load_structured_analysis(self, paper_id: str) -> dict | None:
        return self._analysis


class _StubBackend:
    """最小 Backend 替身：papers + get_paper + store。"""

    def __init__(self, papers: list[dict], analysis: dict | None) -> None:
        self.papers = papers
        self.store = _StubStore(analysis)

    def get_paper(self, paper_id: str) -> dict | None:
        for p in self.papers:
            if p["paper_id"] == paper_id:
                return p
        return None


def _patch_backend(monkeypatch, analysis: dict | None) -> _StubBackend:
    """用替身后端替换 data_source.backend（agent_gateway 在函数内懒加载该全局）。"""
    stub = _StubBackend([_make_paper()], analysis)
    monkeypatch.setattr("research_assistant.tools.data_source.backend", stub)
    return stub


def test_get_paper_includes_structured_when_store_has_analysis(monkeypatch) -> None:
    from server import agent_gateway

    _patch_backend(monkeypatch, SAMPLE_ANALYSIS)

    result = agent_gateway.get_paper("W123")

    assert result is not None
    assert result["structured"] == SAMPLE_ANALYSIS


def test_get_paper_omits_structured_when_store_returns_none(monkeypatch) -> None:
    from server import agent_gateway

    _patch_backend(monkeypatch, None)

    result = agent_gateway.get_paper("W123")

    assert result is not None
    assert "structured" not in result


def test_to_frontend_paper_without_structured_has_no_key() -> None:
    from server import agent_gateway

    result = agent_gateway._to_frontend_paper(_make_paper())

    assert "structured" not in result


def test_to_frontend_paper_includes_structured_when_passed() -> None:
    from server import agent_gateway

    result = agent_gateway._to_frontend_paper(_make_paper(), SAMPLE_ANALYSIS)

    assert result["structured"] == SAMPLE_ANALYSIS


def test_to_frontend_paper_keeps_all_existing_fields() -> None:
    from server import agent_gateway

    result = agent_gateway._to_frontend_paper(_make_paper())

    for field in (
        "id", "title", "authors", "venue", "ccf", "match", "matchLabel",
        "abstract", "citations", "heat", "year", "keywords", "doi", "institute",
    ):
        assert field in result, f"缺少前端字段: {field}"
    assert result["id"] == "W123"
    assert result["authors"] == "Alice Zhang"
    assert result["year"] == 2024
