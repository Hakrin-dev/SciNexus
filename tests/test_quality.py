"""checklist 质量分级的单测。

对齐设计文档「基于 checklist 进行三级评估（Perfect/Partial/Weak）」：
四维（主题相关度 / CCF 等级 / 引用量 / 时效性）→ 三级质量分级，确定性规则。
"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
AGENT_DIR = PROJECT_ROOT / "agent"
for _p in (AGENT_DIR, PROJECT_ROOT):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from research_assistant.tools.quality import checklist_match_level  # noqa: E402


def test_perfect_when_all_signals_high() -> None:
    """高相关 + CCF-A + 高引用 + 近年 → perfect。"""
    assert checklist_match_level(0.7, "A", 5000, 2023, current_year=2026) == "perfect"


def test_partial_when_medium_signals() -> None:
    """中相关 + 无 CCF + 低引用 + 近年 → partial。"""
    assert checklist_match_level(0.4, None, 50, 2023, current_year=2026) == "partial"


def test_weak_when_low_signals() -> None:
    """低相关 + 无 CCF + 低引用 + 旧 → weak。"""
    assert checklist_match_level(0.1, None, 10, 2010, current_year=2026) == "weak"


def test_foundational_old_but_high_citations_still_perfect() -> None:
    """旧但高引用的奠基论文（如 Attention Is All You Need, 2017）→ 引用量补偿时效，仍 perfect。"""
    assert checklist_match_level(0.66, "A", 98700, 2017, current_year=2026) == "perfect"


def test_missing_ccf_is_neutral_not_penalty() -> None:
    """缺 CCF（OpenAlex 真实论文常见）不崩溃、不扣分。"""
    assert checklist_match_level(0.6, None, 2000, 2024, current_year=2026) == "perfect"


def test_lowercase_ccf_normalized() -> None:
    """CCF 大小写不敏感。"""
    assert checklist_match_level(0.7, "a", 5000, 2023, current_year=2026) == "perfect"
