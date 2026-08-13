"""相关度（relevance）评分的 TDD 测试。

覆盖四层：
1. VectorIndex 词法模式 BM25：含更多查询 token 的论文排在前（替代原始 raw TF）
2. BM25 分数随命中 token 数量严格递减（有区分度的数值分数）
3. agent_gateway._to_frontend_paper：仅当内部论文带 relevance_score 键时透传
   relevance（round 4 位）；推荐/列表等无该字段的场景不出现 relevance 键
4. Scout：relevance_score 取自工具 _score、按相关度降序排序、min-max 归一化
   到 [0,1]；全 0 / 全部同分时统一归一化为 0.0（弱匹配显示 0% 而非 100%）
"""
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
AGENT_DIR = PROJECT_ROOT / "agent"
for _p in (AGENT_DIR, PROJECT_ROOT):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))


# --------------------------------------------------------------------------- #
# A. VectorIndex 词法模式 BM25
# --------------------------------------------------------------------------- #
def _lexical_index(monkeypatch, papers):
    """构造强制词法模式的 VectorIndex（embedding 全失败 + 空缓存，不碰真实缓存）。"""
    from research_assistant.tools.vector_index import VectorIndex

    monkeypatch.setattr(VectorIndex, "_embed", lambda self, text: None)
    monkeypatch.setattr(VectorIndex, "_load_cache", lambda self: {})
    monkeypatch.setattr(VectorIndex, "_save_cache", lambda self, cache: None)
    vi = VectorIndex(papers, base_url="http://127.0.0.1:1")
    assert vi.mode == "lexical"
    return vi


def test_bm25_ranks_paper_with_more_query_tokens_above_fewer(monkeypatch) -> None:
    """查询「注意力机制」（bigram: 注意/意力/力机/机制）。

    p1 摘要含全部 4 个 bigram；p2 只含 注意/意力（2 个）→ p1 必须排在前。
    """
    papers = [
        {"paper_id": "p1", "title": "Attention Is All You Need",
         "abstract": "Transformer 架构：多头注意力机制与自注意力。", "keywords": []},
        {"paper_id": "p2", "title": "On Attention in NLP",
         "abstract": "对注意力的研究，分析其计算成本。", "keywords": []},
    ]
    vi = _lexical_index(monkeypatch, papers)

    hits = vi.search("注意力机制", top_k=5)

    assert [h["paper_id"] for h in hits] == ["p1", "p2"]
    assert hits[0]["score"] > hits[1]["score"]


def test_bm25_returns_finite_positive_scores(monkeypatch) -> None:
    papers = [
        {"paper_id": "p1", "title": "Graph Neural Networks for Molecules",
         "abstract": "GNN 在分子性质预测中的应用。", "keywords": ["gnn"]},
    ]
    vi = _lexical_index(monkeypatch, papers)

    hits = vi.search("分子性质", top_k=5)

    assert hits and hits[0]["paper_id"] == "p1"
    assert hits[0]["score"] > 0
    assert hits[0]["score"] < 100  # 有界数值，非 raw TF 的随意计数


def test_bm25_empty_corpus_returns_empty(monkeypatch) -> None:
    vi = _lexical_index(monkeypatch, [])
    assert vi.search("anything", top_k=5) == []


# --------------------------------------------------------------------------- #
# B. agent_gateway._to_frontend_paper：relevance 透传
# --------------------------------------------------------------------------- #
def _frontend_paper(with_relevance: bool) -> dict:
    p = {
        "paper_id": "W123",
        "title": "A Novel Architecture",
        "author": "Alice Zhang",
        "year": 2024,
        "venue": "ICLR",
        "ccf": "A",
        "citation_count": 12,
        "abstract": "We propose a novel architecture.",
        "keywords": ["graph"],
        "heat": "Hot",
        "match_label": "partial",
        "doi": None,
        "institute": None,
    }
    if with_relevance:
        p["relevance_score"] = 0.66666
    return p


def test_to_frontend_paper_adds_relevance_when_relevance_score_present() -> None:
    from server import agent_gateway

    result = agent_gateway._to_frontend_paper(_frontend_paper(with_relevance=True))

    assert result["relevance"] == 0.6667  # round 4 位


def test_to_frontend_paper_omits_relevance_when_relevance_score_absent() -> None:
    from server import agent_gateway

    result = agent_gateway._to_frontend_paper(_frontend_paper(with_relevance=False))

    assert "relevance" not in result


# --------------------------------------------------------------------------- #
# C. Scout：relevance_score 设置 / 排序 / min-max 归一化
# --------------------------------------------------------------------------- #
def _fake_hit(pid: str, score: float, citations: int) -> dict:
    return {
        "paper_id": pid,
        "title": f"Paper {pid}",
        "author": "Alice",
        "year": 2023,
        "institute": None,
        "citation_count": citations,
        "references": [],
        "venue": "ACL",
        "heat": "Warm",
        "abstract": "A transformer-related abstract.",
        "ccf": "A",
        "match_label": None,
        "keywords": ["nlp"],
        "_score": score,
    }


def _scout_papers(monkeypatch, vector_hits, graph_hits):
    """用替身 tools.call 跑通 ScoutAgent.run，返回 last_output.retrieved_papers。"""
    from research_assistant.agents.scout import ScoutAgent
    from research_assistant.llm import MockProvider
    from research_assistant.tools import tools

    def fake_call(name, **kwargs):
        if name == "vector_rag":
            return list(vector_hits)
        if name == "graph_rag":
            return list(graph_hits)
        return []

    monkeypatch.setattr(tools, "call", fake_call)

    agent = ScoutAgent(llm=MockProvider())
    state = {"user_query": "transformer", "working_memory": {"session_context": [], "agent_outputs": {}}}
    result = agent.run(state)
    return result["last_output"]["retrieved_papers"]


def test_scout_sets_relevance_score_and_ranks_by_relevance(monkeypatch) -> None:
    papers = _scout_papers(
        monkeypatch,
        vector_hits=[_fake_hit("v1", 0.9, 100), _fake_hit("v2", 0.5, 200)],
        graph_hits=[_fake_hit("g1", 0.1, 50)],
    )

    # 相关度降序（v2 引用数更高但相关度低，仍排后；同分场景才看引用数）
    assert [p["paper_id"] for p in papers] == ["v1", "v2", "g1"]
    # 相关度分数直接透传（源端已归一化到 0..1，不再 min-max）
    assert abs(papers[0]["relevance_score"] - 0.9) < 1e-6
    assert abs(papers[1]["relevance_score"] - 0.5) < 1e-6
    assert abs(papers[2]["relevance_score"] - 0.1) < 1e-6


def test_scout_normalizes_all_zero_scores_to_zero(monkeypatch) -> None:
    papers = _scout_papers(
        monkeypatch,
        vector_hits=[_fake_hit("v1", 0.0, 100), _fake_hit("v2", 0.0, 200)],
        graph_hits=[_fake_hit("g1", 0.0, 50)],
    )

    # 全部同分（全 0）→ 归一化为 0%，而不是 100%
    assert all(p["relevance_score"] == 0.0 for p in papers)


def test_scout_citation_count_breaks_relevance_ties(monkeypatch) -> None:
    papers = _scout_papers(
        monkeypatch,
        vector_hits=[_fake_hit("v1", 0.5, 100), _fake_hit("v2", 0.5, 200)],
        graph_hits=[],
    )

    # 同分时按引用数降序；相关度分数保持不变（不再 min-max 归零）
    assert [p["paper_id"] for p in papers] == ["v2", "v1"]
    assert all(abs(p["relevance_score"] - 0.5) < 1e-6 for p in papers)
