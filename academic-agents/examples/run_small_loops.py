r"""一次运行三个 demo 小闭环。

在项目根目录执行：
    .\.venv\Scripts\python.exe -m examples.run_small_loops
"""

from __future__ import annotations

import json
import os
import sys

from academic_agents.workflow import run_workflow


def show(title: str, query: str) -> None:
    result = run_workflow(query, mode="demo")
    print(f"\n===== {title} =====")
    print(
        json.dumps(
            {
                "task_type": result["task_type"],
                "status": result["status"],
                "task_plan": result["task_plan"],
                "completed_agents": result["completed_agents"],
                "revision_count": result.get("revision_count", 0),
                "artifact_names": list(result.get("artifacts", {})),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    os.environ["PAPER_DATA_SOURCE"] = "mock"
    show("科研探索链", "分析多智能体近年的研究趋势")
    show("写作审查循环", "帮我写论文引言")
    show("论文精读入口", "精读这篇 PDF 并解释核心方法")
