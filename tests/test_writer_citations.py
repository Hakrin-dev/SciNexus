"""writer 引用编号的单测：正文 [pid] 转 [1][2]... + 编号参考文献。"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
AGENT_DIR = PROJECT_ROOT / "agent"
for _p in (AGENT_DIR, PROJECT_ROOT):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from research_assistant.agents.writer import WriterAgent  # noqa: E402


def _patch_reference(monkeypatch) -> None:
    monkeypatch.setattr(
        WriterAgent, "_numbered_reference",
        staticmethod(lambda pid, n: f"[{n}] ref-of-{pid}"),
    )


def test_number_citations_orders_by_first_appearance(monkeypatch) -> None:
    """[pid] 按正文首次出现顺序编号，并追加参考文献。"""
    _patch_reference(monkeypatch)
    review = "先讲 B [p2]，再讲 A [p1]，最后又提 B [p2]。"
    out = WriterAgent._number_citations(review, ["p1", "p2"])
    assert "B [1]，再讲 A [2]，最后又提 B [1]" in out
    assert "## 参考文献" in out
    assert "[1] ref-of-p2" in out
    assert "[2] ref-of-p1" in out


def test_number_citations_drops_unreferenced_pids(monkeypatch) -> None:
    """未在正文出现的 pid 不进参考文献（无幽灵引用）。"""
    _patch_reference(monkeypatch)
    out = WriterAgent._number_citations("只有 A [p1]。", ["p1", "p2"])
    assert "[1] ref-of-p1" in out
    assert "ref-of-p2" not in out


def test_number_citations_keeps_numbered_output_when_no_pid(monkeypatch) -> None:
    """正文无 [pid] 时仍补全全部候选为参考文献。"""
    _patch_reference(monkeypatch)
    out = WriterAgent._number_citations("没有引用标记的正文。", ["p1", "p2"])
    assert "## 参考文献" in out
    assert "[1] ref-of-p1" in out
    assert "[2] ref-of-p2" in out
