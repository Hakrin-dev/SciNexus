"""RRF 倒数排名融合（稠密 + BM25 + 图）的单测。"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
AGENT_DIR = PROJECT_ROOT / "agent"
for _p in (AGENT_DIR, PROJECT_ROOT):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from research_assistant.tools.vector_index import rrf_fuse  # noqa: E402


def test_consensus_beats_single_signal() -> None:
    """多路共识 > 单路高分：出现在两路的论文排第一。"""
    dense = [{"paper_id": "X", "score": 1.0}, {"paper_id": "Y", "score": 0.5}]
    sparse = [{"paper_id": "Y", "score": 1.0}, {"paper_id": "Z", "score": 0.9}]
    fused = rrf_fuse([dense, sparse], k=60)
    assert fused[0]["paper_id"] == "Y"


def test_score_normalized_to_0_1() -> None:
    """融合分归一化到 0..1。"""
    dense = [{"paper_id": "A", "score": 0.9}, {"paper_id": "B", "score": 0.8}]
    sparse = [{"paper_id": "A", "score": 0.7}, {"paper_id": "B", "score": 0.6}]
    fused = rrf_fuse([dense, sparse], k=60)
    assert all(0.0 <= f["score"] <= 1.0 for f in fused)
    # A 在两路都 rank1 → 归一化后 = 1.0
    assert fused[0]["paper_id"] == "A"
    assert fused[0]["score"] == 1.0


def test_handles_empty_list() -> None:
    """空列表（如 Ollama 不可用稠密为空）不崩、不计入归一化分母。"""
    dense: list[dict] = []
    sparse = [{"paper_id": "A", "score": 0.9}, {"paper_id": "B", "score": 0.8}]
    fused = rrf_fuse([dense, sparse], k=60)
    assert fused[0]["paper_id"] == "A"
    assert fused[0]["score"] == 1.0


def test_all_empty_returns_empty() -> None:
    assert rrf_fuse([[], []], k=60) == []


def test_rank_1_in_all_lists_is_top() -> None:
    """三路都 rank1 的论文融合分最高。"""
    l1 = [{"paper_id": "A", "score": 0.9}, {"paper_id": "B", "score": 0.8}]
    l2 = [{"paper_id": "A", "score": 0.7}, {"paper_id": "B", "score": 0.6}]
    l3 = [{"paper_id": "A", "score": 0.5}, {"paper_id": "B", "score": 0.4}]
    fused = rrf_fuse([l1, l2, l3], k=60)
    assert fused[0]["paper_id"] == "A"
    assert fused[0]["score"] == 1.0


def test_weighted_rrf_prefers_dense() -> None:
    """加权 RRF：稠密信号权重高时，仅稠密命中的论文排第一。"""
    dense = [{"paper_id": "A", "score": 0.9}]
    sparse = [{"paper_id": "B", "score": 0.9}]
    graph = [{"paper_id": "C", "score": 0.9}]
    # 等权：三者各 rank1，分数相同
    equal = rrf_fuse([dense, sparse, graph], k=60)
    assert equal[0]["score"] == equal[1]["score"] == equal[2]["score"]
    # 加权（稠密 3 倍）→ A 排第一
    weighted = rrf_fuse([dense, sparse, graph], k=60, weights=[3.0, 1.0, 1.0])
    assert weighted[0]["paper_id"] == "A"
    assert weighted[0]["score"] > weighted[1]["score"]
