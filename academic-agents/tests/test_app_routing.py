from pathlib import Path

import pytest
from streamlit.testing.v1 import AppTest

APP_PATH = Path(__file__).resolve().parents[1] / "app.py"


@pytest.mark.parametrize(
    ("workflow_label", "query", "expected_type", "expected_agents"),
    [
        (
            "论文搜索（仅 Scout）",
            "搜索 multi-agent 论文",
            "paper_search",
            "1",
        ),
        (
            "代码辅助（仅 Code Assistant）",
            "写一个论文去重函数",
            "coding",
            "1",
        ),
        (
            "科研探索（3 个智能体 + 报告）",
            "分析 multi-agent 方法",
            "research_exploration",
            "3",
        ),
    ],
)
def test_streamlit_routes_selected_workflow(
    monkeypatch, workflow_label, query, expected_type, expected_agents
):
    monkeypatch.setenv("APP_MODE", "demo")
    monkeypatch.setenv("PAPER_DATA_SOURCE", "mock")
    app = AppTest.from_file(str(APP_PATH)).run()
    next(
        widget for widget in app.selectbox if widget.label == "任务闭环"
    ).select(workflow_label)
    app.run()
    next(
        widget for widget in app.text_area if widget.label == "输入科研任务"
    ).input(query)
    app.run()
    next(
        widget for widget in app.button if widget.label == "运行多智能体闭环"
    ).click()
    app.run(timeout=20)

    metrics = {metric.label: metric.value for metric in app.metric}
    assert metrics["任务类型"] == expected_type
    assert metrics["已完成 Agent"] == expected_agents
    assert not app.error


def test_example_button_follows_the_single_sidebar_workflow(monkeypatch):
    monkeypatch.setenv("APP_MODE", "demo")
    monkeypatch.setenv("PAPER_DATA_SOURCE", "mock")
    app = AppTest.from_file(str(APP_PATH)).run()
    assert "示例任务" not in [widget.label for widget in app.selectbox]

    next(
        widget for widget in app.selectbox if widget.label == "任务闭环"
    ).select("代码辅助（仅 Code Assistant）")
    app.run()
    empty_query = next(
        widget for widget in app.text_area if widget.label == "输入科研任务"
    ).value
    assert empty_query == ""
    next(
        widget
        for widget in app.button
        if widget.label == "填入当前闭环示例"
    ).click()
    app.run()

    query = next(
        widget for widget in app.text_area if widget.label == "输入科研任务"
    ).value
    assert "Python 论文去重程序" in query


def test_paper_reading_mode_shows_upload_and_question_controls(monkeypatch):
    monkeypatch.setenv("APP_MODE", "demo")
    monkeypatch.setenv("PAPER_DATA_SOURCE", "mock")
    app = AppTest.from_file(str(APP_PATH)).run()
    next(
        widget for widget in app.selectbox if widget.label == "任务闭环"
    ).select("论文精读（仅 Synthesis）")
    app.run()

    assert [
        uploader.label for uploader in app.file_uploader
    ] == ["上传本地论文 PDF（上传一次后可连续提问）"]
    assert "输入论文问题" in [
        widget.label for widget in app.text_area
    ]
    next(
        widget
        for widget in app.button
        if widget.label == "填入当前闭环示例"
    ).click()
    app.run()
    question = next(
        widget for widget in app.text_area if widget.label == "输入论文问题"
    ).value
    assert question == "这篇文章的研究主题与创新方法是什么？"


def test_paper_reading_can_switch_to_link_input(monkeypatch):
    monkeypatch.setenv("APP_MODE", "demo")
    monkeypatch.setenv("PAPER_DATA_SOURCE", "mock")
    app = AppTest.from_file(str(APP_PATH)).run()
    next(
        widget for widget in app.selectbox if widget.label == "任务闭环"
    ).select("论文精读（仅 Synthesis）")
    app.run()
    next(
        widget for widget in app.radio if widget.label == "论文输入方式"
    ).set_value("输入论文链接")
    app.run()

    assert not app.file_uploader
    assert any(
        "首次成功加载后" in info.value for info in app.info
    )
    question = next(
        widget for widget in app.text_area if widget.label == "输入论文问题"
    ).value
    assert question == ""
    next(
        widget
        for widget in app.button
        if widget.label == "填入当前闭环示例"
    ).click()
    app.run()
    filled_question = next(
        widget for widget in app.text_area if widget.label == "输入论文问题"
    ).value
    assert filled_question.startswith("https://arxiv.org/pdf/")
    assert "多头注意力" in filled_question
