"""paper_analysis 持久化 + 结构化分析 core_innovation 的 TDD 测试。"""
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
AGENT_DIR = PROJECT_ROOT / "agent"
if str(AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(AGENT_DIR))


def _make_paper() -> dict:
    """按 store.py _upsert 内部契约构造单篇论文 dict。"""
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
        "arxiv_id": "2401.001",
        "references": ["W001", "W002"],
    }


def test_save_load_roundtrip_returns_identical_dict(tmp_path) -> None:
    from research_assistant.tools.store import PaperStore

    db = tmp_path / "store.db"
    store = PaperStore(str(db), [], [])
    analysis = {
        "summary": {"content": "本文提出新方法", "evidence": []},
        "methodology": {"content": "使用图神经网络", "evidence": [{"page": 2, "chunk_id": "c1", "quote": "图神经网络"}]},
    }
    store.save_structured_analysis("W123", analysis)
    loaded = store.load_structured_analysis("W123")
    store.close()

    assert loaded == analysis


def test_save_twice_upserts_latest_without_duplicate_rows(tmp_path) -> None:
    from research_assistant.tools.store import PaperStore

    db = tmp_path / "store.db"
    store = PaperStore(str(db), [], [])
    store.save_structured_analysis("W123", {"content": "第一版"})
    store.save_structured_analysis("W123", {"content": "第二版，最新"})
    loaded = store.load_structured_analysis("W123")

    assert loaded == {"content": "第二版，最新"}
    with store._lock:
        rows = store.conn.execute(
            "SELECT COUNT(*) AS n FROM paper_analysis WHERE paper_id=?", ("W123",)
        ).fetchone()
    assert rows["n"] == 1
    store.close()


def test_open_does_not_wipe_papers_table(tmp_path) -> None:
    from research_assistant.tools.store import PaperStore

    db = tmp_path / "store.db"
    store = PaperStore(str(db), [_make_paper()], [])
    store.close()

    opened = PaperStore.open(str(db))
    with opened._lock:
        paper_count = opened.conn.execute("SELECT COUNT(*) AS n FROM papers").fetchone()["n"]
    assert paper_count == 1
    opened.save_structured_analysis("W123", {"content": "开库写入"})
    assert opened.load_structured_analysis("W123") == {"content": "开库写入"}
    opened.close()

    papers, _ = PaperStore.load(str(db))
    assert [p["paper_id"] for p in papers] == ["W123"]


def test_all_analysis_ids_returns_saved_ids(tmp_path) -> None:
    from research_assistant.tools.store import PaperStore

    db = tmp_path / "store.db"
    store = PaperStore(str(db), [], [])
    store.save_structured_analysis("W123", {"content": "a"})
    store.save_structured_analysis("W456", {"content": "b"})

    assert store.all_analysis_ids() == {"W123", "W456"}
    store.close()


def test_load_structured_analysis_returns_none_for_unknown_id(tmp_path) -> None:
    from research_assistant.tools.store import PaperStore

    db = tmp_path / "store.db"
    store = PaperStore(str(db), [], [])

    assert store.load_structured_analysis("W-unknown") is None
    store.close()


def test_build_structured_analysis_contains_core_innovation() -> None:
    from research_assistant.tools.evidence.hybrid import build_structured_analysis

    chunks = [
        {
            "page": 1,
            "chunk_id": "c0",
            "text": (
                "We propose a novel architecture for knowledge graph reasoning. "
                "The main contribution is a cross-layer attention mechanism that reduces "
                "memory cost while preserving expressiveness."
            ),
        },
        {
            "page": 3,
            "chunk_id": "c1",
            "text": (
                "Experiments on four datasets show our method outperforms all baselines "
                "in accuracy and training speed."
            ),
        },
    ]
    analysis = build_structured_analysis(chunks)

    assert "core_innovation" in analysis
    assert analysis["core_innovation"]["content"].strip()
