import json
from pathlib import Path
from uuid import uuid4

import pytest

import academic_agents.tools.paper_search as paper_search_module
from academic_agents.tools.paper_search import (
    CrossrefPaperSource,
    MockPaperSource,
    clean_search_query,
    extract_year_range,
)


def test_extract_year_range():
    assert extract_year_range("搜索 2023 到 2025 年的多智能体论文") == (2023, 2025)
    assert extract_year_range("搜索多智能体论文") == (None, None)


def test_clean_search_query_removes_instructions_and_years():
    assert (
        clean_search_query(
            "搜索 large language model multi-agent collaboration 2023 2026 的论文"
        )
        == "large language model multi-agent collaboration"
    )
    assert (
        clean_search_query(
            "分析 large language model multi-agent collaboration 2023 2026 的研究趋势"
        )
        == "large language model multi-agent collaboration"
    )


def test_crossref_excludes_weak_matches_and_keeps_strong_matches(monkeypatch):
    source = CrossrefPaperSource()
    monkeypatch.setattr(
        source,
        "_load_or_fetch",
        lambda _: {
            "message": {
                "items": [
                    {
                        "DOI": "10.1234/weak",
                        "title": ["A Language Model for Translation"],
                        "published": {"date-parts": [[2025]]},
                    },
                    {
                        "DOI": "10.1234/strong",
                        "title": [
                            "Large Language Model Multi-Agent Collaboration"
                        ],
                        "published": {"date-parts": [[2025]]},
                    },
                    {
                        "DOI": "10.1234/strong",
                        "title": [
                            "Large Language Model Multi-Agent Collaboration"
                        ],
                        "published": {"date-parts": [[2025]]},
                    },
                ]
            }
        },
    )
    papers = source.search(
        "搜索 large language model multi-agent collaboration 的论文", limit=5
    )
    assert len(papers) == 1
    assert papers[0].doi == "10.1234/strong"


def test_crossref_does_not_drop_all_results_for_chinese_only_query(monkeypatch):
    source = CrossrefPaperSource()
    monkeypatch.setattr(
        source,
        "_load_or_fetch",
        lambda _: {
            "message": {
                "items": [
                    {
                        "DOI": "10.1234/chinese-query-result",
                        "title": ["Multi-Agent Collaboration"],
                        "published": {"date-parts": [[2025]]},
                    }
                ]
            }
        },
    )
    papers = source.search("多智能体协作", limit=5)
    assert [paper.doi for paper in papers] == [
        "10.1234/chinese-query-result"
    ]


def test_mock_source_is_clearly_marked():
    papers = MockPaperSource().search("multi-agent", limit=1)
    assert len(papers) == 1
    assert papers[0].is_mock is True
    assert papers[0].source == "mock"


def test_crossref_normalization():
    paper = CrossrefPaperSource._normalize(
        {
            "DOI": "10.1234/example",
            "title": ["Example Paper"],
            "author": [{"given": "Ada", "family": "Lovelace"}],
            "published": {"date-parts": [[2025, 1, 1]]},
            "container-title": ["Example Journal"],
            "URL": "https://doi.org/10.1234/example",
            "is-referenced-by-count": 7,
        }
    )
    assert paper.title == "Example Paper"
    assert paper.authors == ["Ada Lovelace"]
    assert paper.year == 2025
    assert paper.is_mock is False
    assert paper.url == "https://doi.org/10.1234/example"


def test_crossref_cleans_abstract_and_scores_relevance():
    paper = CrossrefPaperSource._normalize(
        {
            "title": ["Multi-Agent Collaboration"],
            "abstract": "<jats:p>Large language model agents collaborate.</jats:p>",
        }
    )
    assert paper.abstract == "Large language model agents collaborate."
    assert CrossrefPaperSource._relevance_score("large language model multi agent", paper) > 0


def test_crossref_uses_cached_response():
    cache_dir = Path("data/cache/test") / str(uuid4())
    cache_dir.mkdir(parents=True, exist_ok=True)
    source = CrossrefPaperSource(cache_dir=cache_dir)
    url = "https://example.test/query"
    canonical = source._canonical_cache_url(url)
    cache_name = __import__("hashlib").sha256(canonical.encode()).hexdigest() + ".json"
    (cache_dir / cache_name).write_text(
        json.dumps({"message": {"items": []}}), encoding="utf-8"
    )
    assert source._load_or_fetch(url) == {"message": {"items": []}}


def test_crossref_cache_ignores_contact_email():
    source = CrossrefPaperSource()
    first = source._canonical_cache_url(
        "https://api.crossref.org/v1/works?query=x&mailto=a@example.com"
    )
    second = source._canonical_cache_url(
        "https://api.crossref.org/v1/works?mailto=b@example.com&query=x"
    )
    assert first == second


def test_crossref_retries_transient_ssl_error(monkeypatch):
    calls = {"count": 0}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"message": {"items": []}}

    def flaky_get(*args, **kwargs):
        calls["count"] += 1
        if calls["count"] < 3:
            raise paper_search_module.httpx.ConnectError("temporary SSL EOF")
        return FakeResponse()

    monkeypatch.setattr(CrossrefPaperSource, "_request", flaky_get)
    monkeypatch.setattr(paper_search_module.time, "sleep", lambda _: None)
    cache_dir = Path("data/cache/test") / str(uuid4())
    source = CrossrefPaperSource(cache_dir=cache_dir, max_retries=3)
    assert source._load_or_fetch("https://example.test/retry")["message"]["items"] == []
    assert calls["count"] == 3


def test_crossref_reports_failure_after_retries(monkeypatch):
    def always_fails(*args, **kwargs):
        raise paper_search_module.httpx.ConnectError("SSL EOF")

    monkeypatch.setattr(CrossrefPaperSource, "_request", always_fails)
    monkeypatch.setattr(paper_search_module.time, "sleep", lambda _: None)
    cache_dir = Path("data/cache/test") / str(uuid4())
    source = CrossrefPaperSource(cache_dir=cache_dir, max_retries=2)
    with pytest.raises(RuntimeError, match="已重试 2 次"):
        source._load_or_fetch("https://example.test/fail")
