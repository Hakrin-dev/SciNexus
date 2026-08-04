"""
pytest 共享夹具 —— 提供 FastAPI TestClient 实例
"""
import sys
import os
from pathlib import Path

# 将项目根目录加入 sys.path，使 `server.main` 可被导入
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    """创建全局共享的 FastAPI TestClient"""
    # 测试期间禁用 AI 对话限流对测试的影响：使用空 Key 也能起服务
    os.environ.setdefault("DEEPSEEK_API_KEY", "test-key-for-ci")
    from server.main import app
    with TestClient(app) as c:
        yield c
