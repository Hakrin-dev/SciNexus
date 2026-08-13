"""API 契约（paper_id / history / generated_files / 诚实兜底）的 TDD 测试。"""
import asyncio
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
AGENT_DIR = PROJECT_ROOT / "agent"
for _p in (AGENT_DIR, PROJECT_ROOT):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))


# --------------------------------------------------------------------------- #
# A. server/main.py：ChatRequest.paper_id / _chat_history / 诚实兜底回复
# --------------------------------------------------------------------------- #
def test_chat_request_accepts_paper_id() -> None:
    from server.main import ChatRequest

    req = ChatRequest(messages=[{"role": "user", "content": "hi"}], paper_id="p1")
    assert req.paper_id == "p1"
    assert req.paper_id is not None


def test_chat_request_paper_id_defaults_to_none() -> None:
    from server.main import ChatRequest

    req = ChatRequest(message="hi")
    assert req.paper_id is None


def test_chat_history_excludes_last_user_message_and_keeps_system_first() -> None:
    from server.main import ChatRequest, _chat_history

    req = ChatRequest(
        messages=[
            {"role": "system", "content": "你是科研助手"},
            {"role": "user", "content": "介绍一下 Attention"},
            {"role": "assistant", "content": "这是 Transformer 论文"},
            {"role": "user", "content": "它的创新点是什么"},
        ]
    )
    history = _chat_history(req)
    assert history[0] == {"role": "system", "content": "你是科研助手"}
    assert {"role": "user", "content": "介绍一下 Attention"} in history
    assert {"role": "assistant", "content": "这是 Transformer 论文"} in history
    # 最后一条用户消息（当前问题）必须被排除
    assert not any(m["content"] == "它的创新点是什么" for m in history)


def test_chat_history_caps_at_twelve_turns() -> None:
    from server.main import ChatRequest, _chat_history

    messages: list[dict] = []
    for i in range(20):
        messages.append({"role": "user", "content": f"u{i}"})
        messages.append({"role": "assistant", "content": f"a{i}"})
    messages.append({"role": "user", "content": "当前问题"})
    history = _chat_history(ChatRequest(messages=messages))
    # 排除最后一条用户消息，且最多保留 12 轮（24 条 user/assistant）
    assert len(history) == 24
    assert history[0]["content"] == "u8"


def test_chat_history_keeps_only_most_recent_system() -> None:
    from server.main import ChatRequest, _chat_history

    req = ChatRequest(
        messages=[
            {"role": "system", "content": "旧 system"},
            {"role": "user", "content": "u1"},
            {"role": "assistant", "content": "a1"},
            {"role": "system", "content": "新 system"},
            {"role": "user", "content": "当前问题"},
        ]
    )
    history = _chat_history(req)
    system_msgs = [m for m in history if m["role"] == "system"]
    assert len(system_msgs) == 1
    assert system_msgs[0] == {"role": "system", "content": "新 system"}


def test_chat_history_empty_when_no_history() -> None:
    from server.main import ChatRequest, _chat_history

    assert _chat_history(ChatRequest(message="hi")) == []
    assert _chat_history(ChatRequest(messages=[{"role": "user", "content": "只此一条"}])) == []


def test_generate_chat_reply_is_honest_when_agent_unavailable() -> None:
    from server.main import _generate_chat_reply

    reply = _generate_chat_reply("帮我分析一下 transformer 的注意力机制")
    assert "智能体服务暂时不可用" in reply
    # 不再出现伪造的学术分析话术
    assert "让我从学术角度为您分析" not in reply
    assert "最新进展是" not in reply


def test_generate_chat_reply_gives_truthful_search_hint() -> None:
    from server.main import _generate_chat_reply

    reply = _generate_chat_reply("帮我找几篇关于大模型的论文")
    assert "论文搜索" in reply


def test_generate_chat_reply_includes_reason() -> None:
    from server.main import _generate_chat_reply

    reply = _generate_chat_reply("随便聊聊", reason="LLM 连接超时")
    assert "LLM 连接超时" in reply


def test_chat_impl_fallback_shape() -> None:
    from server.main import ChatRequest, _chat_impl

    result = _chat_impl(ChatRequest(conversation_id="c9", message="hi"), reason="boom")
    assert set(result) == {"reply", "conversation_id", "tokens", "workflow", "generated_files"}
    assert result["workflow"] is None
    assert result["generated_files"] is None
    assert result["conversation_id"] == "c9"
    assert "boom" in result["reply"]


# --------------------------------------------------------------------------- #
# A. server/main.py：chat/chat_stream 端点在 agent 关闭时的兜底行为
# --------------------------------------------------------------------------- #
def test_chat_endpoint_fallback_when_agent_disabled(monkeypatch) -> None:
    from server import main
    from server.main import ChatRequest, app

    monkeypatch.setattr(main, "AGENT_ENABLED", False)
    app.state.limiter.enabled = False
    try:
        result = asyncio.run(main.chat_endpoint(ChatRequest(message="帮我写综述"), request=None))
    finally:
        app.state.limiter.enabled = True
    assert set(result) == {"reply", "conversation_id", "tokens", "workflow", "generated_files"}
    assert result["workflow"] is None
    assert result["generated_files"] is None


# --------------------------------------------------------------------------- #
# A. server/agent_gateway.py：paper_id/history 传播 + generated_files 提取
# --------------------------------------------------------------------------- #
def test_run_agent_passes_paper_id_and_history_into_initial_state(monkeypatch) -> None:
    import research_assistant.graph as graph_mod
    from server import agent_gateway

    captured: dict = {}

    class FakeGraph:
        def invoke(self, initial):
            captured["initial"] = initial
            return {"working_memory": {"agent_outputs": {}}, "errors": []}

    monkeypatch.setattr(graph_mod, "build_graph", lambda **kwargs: FakeGraph())
    agent_gateway._run_agent(
        "帮我总结这篇论文", task_type="ai_reading",
        paper_id="p1", history=[{"role": "user", "content": "上一轮"}],
    )
    initial = captured["initial"]
    assert initial["paper_id"] == "p1"
    assert initial["history"] == [{"role": "user", "content": "上一轮"}]
    assert initial["raw_input"] == {"task_type": "ai_reading"}
    assert initial["user_query"] == "帮我总结这篇论文"


def test_run_agent_omits_paper_id_and_history_when_absent(monkeypatch) -> None:
    import research_assistant.graph as graph_mod
    from server import agent_gateway

    captured: dict = {}

    class FakeGraph:
        def invoke(self, initial):
            captured["initial"] = initial
            return {"working_memory": {"agent_outputs": {}}, "errors": []}

    monkeypatch.setattr(graph_mod, "build_graph", lambda **kwargs: FakeGraph())
    agent_gateway._run_agent("搜索论文", task_type="paper_search")
    initial = captured["initial"]
    assert "paper_id" not in initial
    assert "history" not in initial


def test_extract_generated_files_maps_writer_output() -> None:
    from server.agent_gateway import _extract_generated_files

    result = {
        "working_memory": {
            "agent_outputs": {
                "writer": {
                    "status": "SUCCESS",
                    "generated_files": [
                        {"path": "docs/x.md", "language": "markdown", "content": "# 综述"},
                        {"path": "paper/x.tex", "language": "latex", "content": "\\section"},
                    ],
                }
            }
        }
    }
    files = _extract_generated_files(result)
    assert files == [
        {"path": "docs/x.md", "language": "markdown", "content": "# 综述"},
        {"path": "paper/x.tex", "language": "latex", "content": "\\section"},
    ]


def test_extract_generated_files_returns_none_when_no_files() -> None:
    from server.agent_gateway import _extract_generated_files

    assert _extract_generated_files({"working_memory": {"agent_outputs": {"synthesis": {"status": "SUCCESS"}}}}) is None
    assert _extract_generated_files({}) is None


def test_chat_with_meta_returns_generated_files(monkeypatch) -> None:
    from server import agent_gateway

    fake_result = {
        "final_response": "综述完成。",
        "intent": {"task_id": "t1", "required_agents": ["writer"]},
        "task_plan": [],
        "errors": [],
        "working_memory": {
            "agent_outputs": {
                "writer": {
                    "status": "SUCCESS",
                    "generated_files": [{"path": "docs/x.md", "language": "markdown", "content": "# 综述"}],
                }
            }
        },
    }
    monkeypatch.setattr(agent_gateway, "_run_agent", lambda *a, **k: fake_result)
    result = agent_gateway.chat_with_meta("写综述", task_type="literature_review", paper_id="p1",
                                          history=[{"role": "user", "content": "hi"}])
    assert result["reply"] == "综述完成。"
    assert result["generated_files"] == [{"path": "docs/x.md", "language": "markdown", "content": "# 综述"}]
    assert isinstance(result["workflow"], dict)


# --------------------------------------------------------------------------- #
# B. synthesis.py：paper_id 解析顺序 + mock 问答基于证据
# --------------------------------------------------------------------------- #
def test_synthesis_prefers_state_paper_id(monkeypatch) -> None:
    from research_assistant.llm import MockProvider
    from research_assistant.agents.synthesis import SynthesisAgent
    from research_assistant.tools.data_source import backend

    if not backend.papers:
        pytest.skip("数据后端为空")

    target = backend.papers[0]["paper_id"]
    agent = SynthesisAgent(MockProvider())
    state = {
        "user_query": "这篇论文讲了什么",
        "paper_id": target,
        "history": [],
        "working_memory": {"session_context": [], "evidence_chain_index": {"paper_ids": []}, "agent_outputs": {}},
    }
    out = agent.run(state)
    # mock 模式下证据应来自显式 paper_id 指定的论文（chunk_id 前缀 / evidence.paper_id）
    assert out["last_output"]["status"] == "SUCCESS"
    assert any(target in cid for cid in out["last_output"]["target_chunks"])
    evidence_pids = {e.get("paper_id") for e in out["last_output"]["evidence"]}
    assert target in evidence_pids


def test_mock_qa_answer_is_grounded_in_evidence() -> None:
    from research_assistant.llm import MockProvider
    from research_assistant.agents.synthesis import SynthesisAgent
    from research_assistant.tools.data_source import backend

    if not backend.papers:
        pytest.skip("数据后端为空")

    target = backend.papers[0]["paper_id"]
    agent = SynthesisAgent(MockProvider())
    state = {
        "user_query": "它的实验设置是怎样的",
        "paper_id": target,
        "history": [{"role": "user", "content": "介绍一下这篇论文"}],
        "working_memory": {"session_context": [], "evidence_chain_index": {"paper_ids": []}, "agent_outputs": {}},
    }
    out = agent.run(state)
    qa = out["last_output"]["qa_response"]
    # mock 问答必须引用实际检索到的证据（chunk_id / 页码），而不是模板 FAQ
    assert "直接证据片段" in qa
    assert "chunk_id" not in qa  # 不应暴露字面 chunk_id 字样
    assert out["last_output"]["qa_response"].strip()


# --------------------------------------------------------------------------- #
# C. writer.py：真实模式综述由 LLM 生成，mock 模式回退模板；dpo_align 仅 mock
# --------------------------------------------------------------------------- #
class _ReviewFakeLLM:
    """最小 LLM 替身：仅实现 writer 真实路径需要的 complete。"""

    def __init__(self):
        self.calls: list[tuple[str, dict]] = []

    def complete(self, system_prompt, user_payload, output_model):
        self.calls.append((output_model.__name__, dict(user_payload)))
        if output_model.__name__ == "ReviewMarkdown":
            return output_model(markdown="# LLM 综述\n\n## 摘要\n由大模型生成。")
        if output_model.__name__ == "WriterPlan":
            return output_model(section_type="Abstract", style_preference="IEEE", cited_paper_ids=[])
        if output_model.__name__ == "WriterOutput":
            from research_assistant.schemas import WrittenContent
            return output_model(
                status="SUCCESS",
                written_content=WrittenContent(section_name="Abstract", latex_payload=""),
                generated_files=[],
            )
        raise AssertionError(f"unexpected schema: {output_model}")


def test_writer_real_path_generates_review_via_llm(monkeypatch) -> None:
    from research_assistant.agents.writer import WriterAgent
    from research_assistant.tools.data_source import backend

    pids = [p["paper_id"] for p in backend.papers][:1]
    if not pids:
        pytest.skip("数据后端为空")

    llm = _ReviewFakeLLM()
    agent = WriterAgent(llm)  # type: ignore[arg-type]
    state = {
        "user_query": "写一篇关于 transformer 的文献综述",
        "working_memory": {"session_context": [], "evidence_chain_index": {"paper_ids": pids}, "agent_outputs": {}},
    }
    out = agent.run(state)
    assert out["last_output"]["status"] == "SUCCESS"
    files = out["last_output"]["generated_files"]
    assert len(files) == 2
    md = next(f["content"] for f in files if f["language"] == "markdown")
    latex = next(f["content"] for f in files if f["language"] == "latex")
    assert "LLM 综述" in md          # 正文来自 LLM
    assert "[IEEE 风格对齐]" not in latex  # 真实路径不调用 mock 的 dpo_align
    assert ("ReviewMarkdown", {}) and any(name == "ReviewMarkdown" for name, _ in llm.calls)


def test_writer_mock_path_keeps_dpo_align_and_template() -> None:
    from research_assistant.llm import MockProvider
    from research_assistant.agents.writer import WriterAgent
    from research_assistant.tools.data_source import backend

    pids = [p["paper_id"] for p in backend.papers][:1]
    if not pids:
        pytest.skip("数据后端为空")

    agent = WriterAgent(MockProvider())
    state = {
        "user_query": "写一篇关于 transformer 的文献综述",
        "working_memory": {"session_context": [], "evidence_chain_index": {"paper_ids": pids}, "agent_outputs": {}},
    }
    out = agent.run(state)
    files = out["last_output"]["generated_files"]
    latex = next(f["content"] for f in files if f["language"] == "latex")
    assert "[IEEE 风格对齐]" in latex  # mock 路径仍调用 dpo_align


# --------------------------------------------------------------------------- #
# E. config.py：provider 默认逻辑
# --------------------------------------------------------------------------- #
def test_default_llm_provider_logic(monkeypatch) -> None:
    from research_assistant.config import _default_llm_provider

    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert _default_llm_provider() == "mock"

    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    assert _default_llm_provider() == "openai"

    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    assert _default_llm_provider() == "ollama"


# --------------------------------------------------------------------------- #
# D. tools/pdf.py：PDF 缺失时合并已入库结构化分析
# --------------------------------------------------------------------------- #
def test_pdf_fallback_merges_structured_analysis(monkeypatch) -> None:
    from research_assistant.tools import pdf as pdf_mod

    class _StubStore:
        def __init__(self, analysis):
            self._a = analysis

        def load_structured_analysis(self, paper_id):
            return self._a

    class _StubBackend:
        def __init__(self, analysis):
            self.store = _StubStore(analysis)

        def get_paper(self, paper_id):
            return None

    analysis = {
        "core_innovation": {"content": "English innovation", "evidence": []},
        "zh": {
            "summary": "中文摘要",
            "core_innovation": "中文创新点",
            "methodology": "中文方法",
            "experiments": "中文实验",
            "limitations": "中文局限",
        },
    }
    monkeypatch.setattr(pdf_mod, "backend", _StubBackend(analysis))
    res = pdf_mod.parse_pdf("W999", Path("C:/no/such/pdfs"))
    assert res["source"] == "analysis_fallback"
    merged = "\n".join(c["text"] for c in res["chunks"])
    assert "中文创新点" in merged
    assert "中文方法" in merged
    assert "中文实验" in merged


def test_pdf_fallback_does_not_crash_when_analysis_empty(monkeypatch) -> None:
    from research_assistant.tools import pdf as pdf_mod

    class _StubStore:
        def load_structured_analysis(self, paper_id):
            return None

    class _StubBackend:
        store = _StubStore()

        def get_paper(self, paper_id):
            return None

    monkeypatch.setattr(pdf_mod, "backend", _StubBackend())
    res = pdf_mod.parse_pdf("W999", Path("C:/no/such/pdfs"))
    assert res["source"] == "abstract_fallback"
    assert res["chunks"]
