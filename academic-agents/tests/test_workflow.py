import pytest

from academic_agents.config import Settings
from academic_agents.supervisor import create_task_plan, route_query
from academic_agents.tools.paper_reader import PaperChunk
from academic_agents.workflow import run_workflow


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("帮我搜索 Transformer 论文", "scout"),
        ("帮我精读这篇 PDF", "synthesis"),
        ("构建相似论文知识图谱", "librarian"),
        ("设计一个可验证的研究方案", "research_design"),
        ("这段 Python 代码报错了", "code_assistant"),
        ("帮我写论文引言", "writer"),
        ("模拟审稿并推荐投稿会议", "critic"),
    ],
)
def test_routing(query, expected):
    assert route_query(query)[0] == expected


def test_demo_workflow_runs_without_api_key():
    result = run_workflow("帮我分析 Transformer 近五年的研究趋势", mode="demo")
    assert result["status"] == "success"
    assert result["completed_agents"] == ["scout", "librarian", "research_design"]
    assert result["result"]["status"] == "SUCCESS"
    assert "papers" in result["artifacts"]
    assert "knowledge_graph" in result["artifacts"]
    assert "proposal" in result["artifacts"]
    assert "research_report" in result["artifacts"]
    assert result["artifacts"]["research_report"]["evidence_count"] > 0
    assert result["artifacts"]["research_report"]["year_distribution"]


def test_empty_query_is_rejected():
    with pytest.raises(ValueError):
        run_workflow("  ", mode="demo")


def test_workflow_accepts_explicit_session_settings(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "openai")
    settings = Settings.from_env(
        "demo",
        model_provider="deepseek",
        paper_data_source="mock",
        paper_result_limit=2,
    )
    result = run_workflow(
        "搜索 multi-agent 论文",
        task_type="paper_search",
        settings=settings,
    )
    assert settings.model_provider == "deepseek"
    assert settings.paper_result_limit == 2
    assert result["status"] == "success"


def test_workflow_rejects_mode_and_settings_together():
    settings = Settings.from_env("demo")
    with pytest.raises(ValueError, match="不能同时"):
        run_workflow("搜索论文", mode="demo", settings=settings)


def test_research_plan_is_a_three_agent_chain():
    task_type, plan = create_task_plan("分析多智能体近年的研究趋势")
    assert task_type == "research_exploration"
    assert plan == ["scout", "librarian", "research_design"]


def test_explicit_paper_search_runs_only_scout():
    result = run_workflow(
        "分析一下这些论文", mode="demo", task_type="paper_search"
    )
    assert result["task_type"] == "paper_search"
    assert result["completed_agents"] == ["scout"]
    assert "papers" in result["artifacts"]
    assert "research_report" not in result["artifacts"]
    assert "knowledge_graph" not in result["artifacts"]


def test_explicit_research_exploration_runs_three_agents():
    result = run_workflow(
        "搜索相关论文", mode="demo", task_type="research_exploration"
    )
    assert result["task_type"] == "research_exploration"
    assert result["completed_agents"] == [
        "scout",
        "librarian",
        "research_design",
    ]
    assert "research_report" in result["artifacts"]


def test_generic_exploration_creates_a_general_research_report():
    query = "比较 multi-agent collaboration 的主要方法"
    result = run_workflow(query, mode="demo")
    report = result["artifacts"]["research_report"]
    assert report["question"] == query
    assert "answer" in report
    assert "limitations" in report


def test_writing_review_loop_stops_after_one_revision(monkeypatch):
    monkeypatch.setenv("MAX_REVISIONS", "1")
    result = run_workflow("帮我写论文引言", mode="demo")
    assert result["status"] == "success"
    assert result["completed_agents"] == ["writer", "critic", "writer", "critic"]
    assert result["revision_count"] == 1
    assert result["artifacts"]["review_report"]["decision"] == "ACCEPT_FOR_DEMO"


def test_paper_reading_returns_page_evidence(monkeypatch):
    import academic_agents.specialists.synthesis as synthesis_module

    class FakeStore:
        def load_metadata(self, paper_id):
            return {
                "paper_id": paper_id,
                "filename": "paper.pdf",
                "source_url": None,
                "resolved_pdf_url": None,
                "page_count": 3,
                "chunk_count": 2,
                "extracted_characters": 1200,
            }

        def load_chunks(self, paper_id):
            return [
                PaperChunk(
                    page=2, chunk_id="p2-c1", text="方法证据片段"
                )
            ]

        def load_structured_analysis(self, paper_id):
            return {"methodology": {"content": "方法证据片段", "evidence": []}}

    monkeypatch.setattr(synthesis_module, "DocumentStore", FakeStore)
    result = run_workflow(
        "方法是什么？",
        mode="demo",
        task_type="paper_reading",
        active_paper_id="a" * 64,
    )
    notes = result["artifacts"]["reading_notes"]
    assert result["completed_agents"] == ["synthesis"]
    assert notes["page_count"] == 3
    assert notes["evidence_anchors"][0]["page"] == 2


def test_new_pdf_url_overrides_previously_active_paper(monkeypatch):
    import academic_agents.specialists.synthesis as synthesis_module

    calls = {"downloaded": False}

    class FakeStore:
        def ingest_pdf(self, pdf_bytes, **kwargs):
            return (
                {
                    "paper_id": "b" * 64,
                    "filename": "new.pdf",
                    "source_url": kwargs["source_url"],
                    "resolved_pdf_url": kwargs["resolved_pdf_url"],
                    "page_count": 2,
                    "chunk_count": 1,
                    "extracted_characters": 100,
                },
                False,
            )

        def load_chunks(self, paper_id):
            assert paper_id == "b" * 64
            return [
                PaperChunk(page=2, chunk_id="p2-c1", text="新论文方法证据")
            ]

        def load_structured_analysis(self, paper_id):
            return {}

    def fake_download(url):
        calls["downloaded"] = True
        return b"%PDF-new", url

    monkeypatch.setattr(synthesis_module, "DocumentStore", FakeStore)
    monkeypatch.setattr(synthesis_module, "download_pdf", fake_download)
    result = run_workflow(
        "https://example.org/new.pdf 新论文的方法是什么？",
        mode="demo",
        task_type="paper_reading",
        active_paper_id="a" * 64,
    )
    notes = result["artifacts"]["reading_notes"]
    assert calls["downloaded"] is True
    assert notes["paper_id"] == "b" * 64
    assert notes["question"] == "新论文的方法是什么？"


def test_all_seven_agents_are_reachable(monkeypatch):
    import academic_agents.specialists.synthesis as synthesis_module

    class FakeStore:
        def load_metadata(self, paper_id):
            return {
                "paper_id": paper_id,
                "filename": "paper.pdf",
                "source_url": None,
                "resolved_pdf_url": None,
                "page_count": 1,
                "chunk_count": 1,
                "extracted_characters": 100,
            }

        def load_chunks(self, paper_id):
            return [
                PaperChunk(
                    page=1, chunk_id="p1-c1", text="论文正文"
                )
            ]

        def load_structured_analysis(self, paper_id):
            return {}

    monkeypatch.setattr(synthesis_module, "DocumentStore", FakeStore)
    queries = [
        "搜索多智能体论文",
        "精读这篇 PDF",
        "整理文献库",
        "分析研究趋势",
        "Python 代码报错",
        "帮我写论文引言",
        "模拟审稿",
    ]
    visited = set()
    for query in queries:
        kwargs = (
            {"active_paper_id": "a" * 64}
            if "PDF" in query
            else {}
        )
        visited.update(
            run_workflow(query, mode="demo", **kwargs)["completed_agents"]
        )
    assert visited == {
        "scout",
        "synthesis",
        "librarian",
        "research_design",
        "code_assistant",
        "writer",
        "critic",
    }
