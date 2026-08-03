import pytest

import academic_agents.model_gateway as gateway_module
from academic_agents.config import Settings, _safe_contact_email
from academic_agents.model_gateway import create_model


def _clear_keys(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)


def test_demo_mode_does_not_require_any_key(monkeypatch):
    _clear_keys(monkeypatch)
    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    settings = Settings.from_env(mode="demo")
    assert settings.mode == "demo"
    assert settings.model == "deepseek-v4-flash"


@pytest.mark.parametrize(
    ("provider", "key_name"),
    [
        ("openai", "OPENAI_API_KEY"),
        ("deepseek", "DEEPSEEK_API_KEY"),
    ],
)
def test_llm_mode_reports_the_correct_missing_key(monkeypatch, provider, key_name):
    _clear_keys(monkeypatch)
    monkeypatch.setenv("MODEL_PROVIDER", provider)
    with pytest.raises(RuntimeError, match=key_name):
        Settings.from_env(mode="llm")


def test_deepseek_gateway_uses_provider_configuration(monkeypatch):
    _clear_keys(monkeypatch)
    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-secret-not-real")
    monkeypatch.setenv("DEEPSEEK_MODEL", "deepseek-v4-flash")

    captured = {}

    class FakeChatModel:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr(gateway_module, "ChatOpenAI", FakeChatModel)
    settings = Settings.from_env(mode="llm")
    create_model(settings)

    assert captured["model"] == "deepseek-v4-flash"
    assert captured["base_url"] == "https://api.deepseek.com"
    assert captured["api_key"] == "test-secret-not-real"


def test_old_openai_mode_name_remains_compatible(monkeypatch):
    _clear_keys(monkeypatch)
    monkeypatch.setenv("MODEL_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-secret-not-real")
    assert Settings.from_env(mode="openai").mode == "llm"


def test_crossref_contact_email_ignores_placeholder_text():
    assert _safe_contact_email("你的邮箱") == ""
    assert _safe_contact_email("demo@example.com") == "demo@example.com"
