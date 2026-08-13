import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
AGENT_DIR = PROJECT_ROOT / "agent"
if str(AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(AGENT_DIR))


from pydantic import BaseModel

from research_assistant.llm import LLMProvider
from research_assistant.schemas import SupervisorDecision, SupervisorStep


def test_forced_ai_reading_uses_only_synthesis() -> None:
    from research_assistant.supervisor import forced_decision

    decision = forced_decision("ai_reading")

    assert decision["task_type"] == "ai_reading"
    assert [step["agent"] for step in decision["steps"]] == ["synthesis"]


def test_forced_research_exploration_excludes_research_design() -> None:
    from research_assistant.supervisor import forced_decision

    decision = forced_decision("research_exploration")

    assert decision["task_type"] == "research_exploration"
    assert [step["agent"] for step in decision["steps"]] == ["scout", "librarian"]


def test_forced_autonomous_research_uses_full_pipeline() -> None:
    from research_assistant.supervisor import forced_decision

    decision = forced_decision("autonomous_research")

    assert [step["agent"] for step in decision["steps"]] == [
        "scout",
        "librarian",
        "research_design",
        "code_assistant",
        "writer",
        "critic",
    ]


# --------------------------------------------------------------------------- #
# 模块级 agent 白名单硬约束（TDD：先写失败测试，再实现 constrain_decision）
# --------------------------------------------------------------------------- #
class FakeLLM(LLMProvider):
    """测试用弱 LLM：直接回显 canned SupervisorDecision，模拟可能出错的规划输出。"""

    def __init__(self, decision: SupervisorDecision) -> None:
        self._decision = decision

    def complete(self, system_prompt: str, user_payload: dict, output_model: type[BaseModel]) -> BaseModel:
        return self._decision


def _reading_state(task_type: str | None = None) -> dict:
    return {
        "user_query": "帮我阅读这篇论文",
        "working_memory": {"session_context": [], "agent_outputs": {}},
        "raw_input": {"task_type": task_type} if task_type else {},
    }


def test_enforce_allowlist_filters_llm_steps_outside_module() -> None:
    from research_assistant.schemas import SupervisorDecision, SupervisorStep
    from research_assistant.supervisor import Supervisor

    fake = FakeLLM(
        SupervisorDecision(
            task_type="ai_reading",
            description="AI 辅助论文阅读",
            steps=[
                SupervisorStep(agent="writer", action="write paper draft", authorized_tools=["pdf_parser", "dpo_align"]),
                SupervisorStep(agent="critic", action="review paper", authorized_tools=["venue_db", "evidence_check"]),
                SupervisorStep(agent="synthesis", action="read & structure papers", authorized_tools=["pdf_parser", "evidence_retrieve", "vector_rag"]),
            ],
        )
    )

    result = Supervisor(llm=fake).run(_reading_state())

    plan = result["task_plan"]
    assert [step["agent"] for step in plan] == ["synthesis"]
    assert plan[0]["authorized_tools"] == ["pdf_parser", "evidence_retrieve"]


def test_enforce_allowlist_resolves_unknown_task_type_via_intent() -> None:
    from research_assistant.schemas import SupervisorDecision, SupervisorStep
    from research_assistant.supervisor import Supervisor

    fake = FakeLLM(
        SupervisorDecision(
            task_type="research",
            description="research",
            steps=[
                SupervisorStep(agent="scout", action="retrieve papers", authorized_tools=["vector_rag"]),
                SupervisorStep(agent="writer", action="write paper draft", authorized_tools=["pdf_parser", "dpo_align"]),
            ],
        )
    )

    result = Supervisor(llm=fake).run(_reading_state())

    assert result["intent"]["task_type"] == "ai_reading"
    assert [step["agent"] for step in result["task_plan"]] == ["synthesis"]


def test_enforce_allowlist_falls_back_to_deterministic_steps_when_empty() -> None:
    from research_assistant.schemas import SupervisorDecision
    from research_assistant.supervisor import Supervisor

    # model_construct 绕过 pydantic 校验，模拟弱 LLM 返回空步骤的非法输出
    fake = FakeLLM(SupervisorDecision.model_construct(task_type="ai_reading", description="AI 辅助论文阅读", steps=[]))

    result = Supervisor(llm=fake).run(_reading_state())

    plan = result["task_plan"]
    assert [step["agent"] for step in plan] == ["synthesis"]
    assert plan[0]["authorized_tools"] == ["pdf_parser", "evidence_retrieve"]


def test_explicit_unknown_task_type_falls_through_to_llm_path() -> None:
    from research_assistant.llm import MockProvider
    from research_assistant.schemas import SupervisorDecision, SupervisorStep
    from research_assistant.supervisor import Supervisor

    state = _reading_state(task_type="nonexistent")

    mock_result = Supervisor(llm=MockProvider()).run(state)
    assert mock_result["intent"]["task_type"] == "ai_reading"
    assert [step["agent"] for step in mock_result["task_plan"]] == ["synthesis"]

    fake = FakeLLM(
        SupervisorDecision(
            task_type="ai_writing",
            description="AI 辅助科研撰写",
            steps=[
                SupervisorStep(agent="writer", action="write paper draft", authorized_tools=["pdf_parser", "dpo_align"]),
                SupervisorStep(agent="critic", action="review paper", authorized_tools=["venue_db", "evidence_check"]),
            ],
        )
    )
    fake_result = Supervisor(llm=fake).run(state)
    assert [step["agent"] for step in fake_result["task_plan"]] == ["writer", "critic"]


def test_disabling_enforce_allowlist_passes_llm_plan_unchanged(monkeypatch) -> None:
    from research_assistant.config import settings
    from research_assistant.schemas import SupervisorDecision, SupervisorStep
    from research_assistant.supervisor import Supervisor

    monkeypatch.setattr(settings, "supervisor_enforce_allowlist", False)
    fake = FakeLLM(
        SupervisorDecision(
            task_type="ai_reading",
            description="AI 辅助论文阅读",
            steps=[
                SupervisorStep(agent="writer", action="write paper draft", authorized_tools=["pdf_parser", "dpo_align"]),
                SupervisorStep(agent="critic", action="review paper", authorized_tools=["venue_db", "evidence_check"]),
            ],
        )
    )

    result = Supervisor(llm=fake).run(_reading_state())

    plan = result["task_plan"]
    assert [step["agent"] for step in plan] == ["writer", "critic"]
    assert plan[0]["authorized_tools"] == ["pdf_parser", "dpo_align"]
