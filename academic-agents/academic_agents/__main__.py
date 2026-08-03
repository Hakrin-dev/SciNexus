from __future__ import annotations

import argparse
import json
import sys

from dotenv import load_dotenv

from .workflow import run_workflow


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    load_dotenv()
    parser = argparse.ArgumentParser(description="运行学术多智能体工作流")
    parser.add_argument("query", nargs="?", help="你希望智能体完成的任务")
    parser.add_argument(
        "--mode",
        choices=["demo", "llm", "openai"],
        default=None,
        help="demo 不调用模型；llm 调用 MODEL_PROVIDER 指定的模型；openai 兼容旧写法",
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="只显示任务类型、执行顺序和产物名称，适合初学者观察流程",
    )
    args = parser.parse_args()
    query = args.query or input("请输入你的科研任务：").strip()
    result = run_workflow(query, mode=args.mode)
    if args.summary:
        result = {
            "user_query": result["user_query"],
            "task_type": result["task_type"],
            "status": result["status"],
            "task_plan": result["task_plan"],
            "completed_agents": result["completed_agents"],
            "revision_count": result.get("revision_count", 0),
            "artifact_names": list(result.get("artifacts", {})),
            "error": result.get("error"),
        }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
