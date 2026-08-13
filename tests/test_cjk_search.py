"""中文检索质量修复的 TDD 测试。

覆盖四层：
1. text_utils.tokenize_query：混合中英文查询 → 拉丁词 + CJK 双字组合（去重保序）
2. VectorIndex 词法模式：中文查询能命中含中文摘要的论文（修复前单 token 零召回）
3. GraphIndex.search：中文 bigram 种子能定位到对应论文
4. agent_gateway.search_papers：scout 无结果时按 errors 区分回退原因，且本地直检
   仍无结果时追加提示步骤（不再把原因归咎于 Supervisor）
"""
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
AGENT_DIR = PROJECT_ROOT / "agent"
for _p in (AGENT_DIR, PROJECT_ROOT):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))


# --------------------------------------------------------------------------- #
# A. tokenize_query：拉丁/数字词 + CJK bigram，去重保序
# --------------------------------------------------------------------------- #
def test_tokenize_query_mixed_chinese_english() -> None:
    from research_assistant.tools.text_utils import tokenize_query

    tokens = tokenize_query("GPT-4 大语言模型 Transformer")
    # 拉丁词在前（按出现顺序），CJK 连续片段切成相邻双字组合
    assert tokens == ["gpt-4", "transformer", "大语", "语言", "言模", "模型"]


def test_tokenize_query_five_char_cjk_run_emits_bigrams() -> None:
    from research_assistant.tools.text_utils import tokenize_query

    tokens = tokenize_query("图神经网络")
    assert tokens == ["图神", "神经", "经网", "网络"]


def test_tokenize_query_single_char_cjk_run_kept() -> None:
    from research_assistant.tools.text_utils import tokenize_query

    tokens = tokenize_query("图神经网络 的")
    assert "的" in tokens
    assert tokens.index("的") == tokens.index("网络") + 1  # 保序：单字 run 保留在末尾


def test_tokenize_query_deduplicates_preserving_order() -> None:
    from research_assistant.tools.text_utils import tokenize_query

    tokens = tokenize_query("模型 模型 大模型")
    assert tokens == ["模型", "大模"]


def test_tokenize_query_single_char_latin_dropped() -> None:
    from research_assistant.tools.text_utils import tokenize_query

    # 单字符拉丁词（如 Q）不满足 [a-z0-9][a-z0-9\-]{1,}，被丢弃；CJK bigram 保留
    assert tokenize_query("Q 学习") == ["学习"]


def test_tokenize_query_empty_and_punctuation_only() -> None:
    from research_assistant.tools.text_utils import tokenize_query

    assert tokenize_query("") == []
    assert tokenize_query("，，") == []


# --------------------------------------------------------------------------- #
# B. VectorIndex 词法模式：中文查询命中中文摘要
# --------------------------------------------------------------------------- #
def test_vector_lexical_search_matches_chinese_query(monkeypatch) -> None:
    from research_assistant.tools.vector_index import VectorIndex

    papers = [
        {"paper_id": "c1", "title": "Attention Is All You Need",
         "abstract": "提出 Transformer 架构，核心是多头注意力机制。",
         "keywords": ["transformer"]},
        {"paper_id": "c2", "title": "Graph Neural Networks for Molecules",
         "abstract": "GNN 在分子性质预测中的应用。",
         "keywords": ["gnn"]},
    ]
    # 强制词法模式：embedding 全部失败 + 空缓存，且不触碰真实 server/data/embeddings.json
    monkeypatch.setattr(VectorIndex, "_embed", lambda self, text: None)
    monkeypatch.setattr(VectorIndex, "_load_cache", lambda self: {})
    monkeypatch.setattr(VectorIndex, "_save_cache", lambda self, cache: None)

    vi = VectorIndex(papers, base_url="http://127.0.0.1:1")
    assert vi.mode == "lexical"
    hits = vi.search("注意力机制", top_k=5)
    # 修复前「注意力机制」是单一 token，无法子串命中英文摘要 → []
    assert hits and hits[0]["paper_id"] == "c1"
    assert hits[0]["score"] > 0


def test_vector_lexical_search_ranked_by_bigram_hits(monkeypatch) -> None:
    from research_assistant.tools.vector_index import VectorIndex

    papers = [
        {"paper_id": "c1", "title": "A Paper About Language Models",
         "abstract": "大语言模型综述。", "keywords": []},
        {"paper_id": "c2", "title": "Deep Learning for Language",
         "abstract": "语言与注意力。", "keywords": []},
    ]
    monkeypatch.setattr(VectorIndex, "_embed", lambda self, text: None)
    monkeypatch.setattr(VectorIndex, "_load_cache", lambda self: {})
    monkeypatch.setattr(VectorIndex, "_save_cache", lambda self, cache: None)

    vi = VectorIndex(papers, base_url="http://127.0.0.1:1")
    hits = vi.search("语言模型", top_k=5)
    # c1 命中 语言+言模+模型（3 个 bigram），c2 只命中 语言（1 个）→ c1 排名更高
    assert hits and hits[0]["paper_id"] == "c1"
    assert hits[1]["paper_id"] == "c2"
    assert hits[0]["score"] > hits[1]["score"]


# --------------------------------------------------------------------------- #
# C. GraphIndex.search：中文 bigram 种子
# --------------------------------------------------------------------------- #
def _graph_papers() -> list[dict]:
    return [
        {"paper_id": "g1", "title": "大语言模型综述",
         "abstract": "大语言模型的训练与对齐方法。",
         "keywords": [], "references": [], "citation_count": 10,
         "heat": "Hot", "venue": "ACL", "year": 2023, "ccf": "A"},
        {"paper_id": "g2", "title": "Graph Neural Networks",
         "abstract": "GNN 在分子发现中的应用。",
         "keywords": [], "references": [], "citation_count": 5},
    ]


def test_graph_search_seeds_with_chinese_bigrams() -> None:
    from research_assistant.tools.graph_index import GraphIndex

    gi = GraphIndex(_graph_papers())
    hits = gi.search("大语言模型", top_k=5)
    # bigram 种子 [大语, 语言, 言模, 模型] 命中 g1 标题/摘要
    assert hits and hits[0]["paper_id"] == "g1"
    assert hits[0]["title"] == "大语言模型综述"


def test_graph_search_returns_empty_when_no_seed_matches() -> None:
    from research_assistant.tools.graph_index import GraphIndex

    gi = GraphIndex(_graph_papers())
    assert gi.search("量子计算", top_k=5) == []


# --------------------------------------------------------------------------- #
# D. agent_gateway.search_papers：回退原因区分 + 本地直检空结果提示
# --------------------------------------------------------------------------- #
def _fake_paper() -> dict:
    return {
        "paper_id": "W1",
        "title": "A Paper",
        "author": "Alice Zhang",
        "year": 2023,
        "venue": "ICLR",
        "ccf": "A",
        "citation_count": 3,
        "abstract": "A short abstract.",
        "keywords": ["nlp"],
        "heat": "Warm",
        "match_label": "partial",
        "doi": None,
        "institute": None,
    }


def test_search_papers_uses_direct_search(monkeypatch) -> None:
    from server import agent_gateway

    monkeypatch.setattr(agent_gateway, "_direct_search", lambda query, top_k: [_fake_paper()])

    out = agent_gateway.search_papers("transformer")
    ds_steps = [s for s in out["meta"]["workflow"]["steps"] if s["agent"] == "data_source"]

    assert ds_steps[0]["action"] == "本地索引召回候选论文并计算相关度"
    assert ds_steps[0]["status"] == "done"
    assert ds_steps[0]["tools"] == ["vector_index"]
    assert "data_source" in out["meta"]["workflow"]["agents"]
    # 本地直检有结果 → 不再追加"无匹配"步骤
    assert len(ds_steps) == 1
    assert out["meta"]["count"] == 1
    assert out["data"][0]["id"] == "W1"
    assert out["meta"]["task_type"] == "paper_search"


def test_search_papers_empty_hint_when_no_results(monkeypatch) -> None:
    from server import agent_gateway

    monkeypatch.setattr(agent_gateway, "_direct_search", lambda query, top_k: [])

    out = agent_gateway.search_papers("不存在的关键词")
    ds_steps = [s for s in out["meta"]["workflow"]["steps"] if s["agent"] == "data_source"]

    assert ds_steps[0]["action"] == "本地索引召回候选论文并计算相关度"
    assert ds_steps[1]["action"] == "本地论文库无匹配结果，请调整关键词或开启 Ollama 语义检索"
    assert ds_steps[1]["status"] == "done"
    assert ds_steps[1]["tools"] == []
    assert "data_source" in out["meta"]["workflow"]["agents"]
    assert out["meta"]["count"] == 0
    assert out["data"] == []
