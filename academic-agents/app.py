"""Local Streamlit UI for the academic multi-agent workflow."""

from __future__ import annotations

import json
import os
import re
from typing import Any

import streamlit as st
from dotenv import load_dotenv

from academic_agents.config import Settings
from academic_agents.tools.document_store import DocumentStore
from academic_agents.workflow import run_workflow

load_dotenv()

APP_BUILD = "2026.07.30-hardening-v14"

st.set_page_config(
    page_title="学术多智能体工作台",
    page_icon="🧭",
    layout="wide",
)

st.markdown(
    """
    <style>
    .stApp {background: #0e1117; color: #f2f4f8;}
    header[data-testid="stHeader"] {background: rgba(14, 17, 23, .94);}
    .block-container {
        max-width: 1180px;
        padding-top: 2rem;
        padding-bottom: 3rem;
    }
    .hero {
        box-sizing: border-box;
        width: 100%;
        min-height: 138px;
        padding: 1.65rem 1.8rem;
        border: 1px solid #34405a;
        border-radius: 20px;
        background:
            radial-gradient(circle at 92% 18%, rgba(220, 53, 69, .24), transparent 25%),
            linear-gradient(135deg, #182033 0%, #151a28 100%);
        box-shadow: 0 12px 30px rgba(0, 0, 0, .26);
        margin: .25rem 0 1.35rem;
        overflow: hidden;
    }
    .hero h1 {
        margin: 0 0 .55rem;
        color: #f7f8fc;
        font-size: clamp(1.65rem, 3vw, 2.15rem);
        line-height: 1.2;
    }
    .hero p {
        max-width: 760px;
        margin: 0;
        color: #c3cada;
        line-height: 1.65;
    }
    div[data-testid="stTextArea"] textarea::placeholder {
        color: #9da8bc;
        opacity: 1;
    }
    .agent-card {
        padding: .85rem 1rem;
        border-left: 4px solid #dc3545;
        background: #181e2b;
        color: #eef1f7;
        border-radius: 8px;
        margin-bottom: .55rem;
    }
    .agent-card strong {color: #f7f8fc;}
    .muted {color: #b7c0d1; font-size: .9rem;}
    </style>
    """,
    unsafe_allow_html=True,
)


AGENT_LABELS = {
    "scout": "Scout · 信息搜集",
    "synthesis": "Synthesis · 知识综合",
    "librarian": "Librarian · 知识管家",
    "research_design": "Research Design · 研究设计",
    "code_assistant": "Code Assistant · 代码辅助",
    "writer": "Writer · 论文写作",
    "critic": "Critic · 审查决策",
}

EXAMPLE_QUERIES = {
    "paper_search": "搜索 large language model multi-agent collaboration 2023 2026 的论文",
    "research_exploration": "分析 large language model multi-agent collaboration 2023 2026 的研究趋势",
    "coding": "帮我设计一个 Python 论文去重程序",
    "paper_writing": "帮我写一段多智能体协作研究的论文引言",
    "paper_review": "审查这段论文摘要并给出修改建议",
}

PAPER_READING_EXAMPLES = {
    "上传本地 PDF": "这篇文章的研究主题与创新方法是什么？",
    "输入论文链接": (
        "https://arxiv.org/pdf/1706.03762 "
        "这篇论文为什么使用多头注意力？它与单头注意力有什么关联？"
    ),
}

WORKFLOW_TYPES = {
    "论文搜索（仅 Scout）": "paper_search",
    "科研探索（3 个智能体 + 报告）": "research_exploration",
    "论文精读（仅 Synthesis）": "paper_reading",
    "代码辅助（仅 Code Assistant）": "coding",
    "写作审查（Writer + Critic）": "paper_writing",
    "论文审查（仅 Critic）": "paper_review",
}

WORKFLOW_PATHS = {
    None: "由 Supervisor 根据问题自动识别",
    "paper_search": "Scout",
    "research_exploration": "Scout → Librarian → Research Design",
    "paper_reading": "Synthesis",
    "coding": "Code Assistant",
    "paper_writing": "Writer → Critic（必要时修改后复审）",
    "paper_review": "Critic",
}


def key_status(provider: str) -> tuple[str, bool]:
    key_name = "DEEPSEEK_API_KEY" if provider == "deepseek" else "OPENAI_API_KEY"
    return key_name, bool(os.getenv(key_name))


def clear_previous_result() -> None:
    st.session_state.pop("last_result", None)


def change_workflow() -> None:
    st.session_state["query"] = ""
    st.session_state["reading_messages"] = []
    clear_previous_result()


def apply_example(task_type: str) -> None:
    if task_type == "paper_reading":
        input_method = st.session_state.get(
            "reading_input_method", "上传本地 PDF"
        )
        st.session_state["query"] = PAPER_READING_EXAMPLES[input_method]
    else:
        st.session_state["query"] = EXAMPLE_QUERIES[task_type]
    clear_previous_result()


def change_reading_input_method() -> None:
    st.session_state["reading_messages"] = []
    st.session_state["query"] = ""
    clear_previous_result()


def current_example(task_type: str) -> str:
    if task_type == "paper_reading":
        input_method = st.session_state.get(
            "reading_input_method", "上传本地 PDF"
        )
        return PAPER_READING_EXAMPLES[input_method]
    return EXAMPLE_QUERIES[task_type]


def render_timeline(result: dict[str, Any]) -> None:
    st.subheader("Agent 执行时间线")
    plan = result.get("task_plan", [])
    if plan:
        st.caption("计划：" + " → ".join(AGENT_LABELS.get(item, item) for item in plan))

    history = result.get("history", [])
    if not history:
        st.info("尚无 Agent 成功完成。请查看错误信息。")
        return

    for event in history:
        agent_name = event["agent"]
        label = AGENT_LABELS.get(agent_name, agent_name)
        status = event.get("status", "SUCCESS")
        st.markdown(
            f"""
            <div class="agent-card">
              <strong>步骤 {event['step']} · {label}</strong><br>
              <span class="muted">状态：{status}</span>
            </div>
            """,
            unsafe_allow_html=True,
        )
        with st.expander(f"查看 {label} 的结构化输出"):
            st.json(event.get("summary", {}))


def render_papers(papers: list[dict[str, Any]]) -> None:
    st.markdown("#### 检索论文")
    if not papers:
        st.info("没有论文结果。")
        return
    rows = [
        {
            "年份": paper.get("year"),
            "标题": paper.get("title"),
            "作者": ", ".join(paper.get("authors", [])),
            "来源": paper.get("source"),
            "DOI": paper.get("doi"),
            "引用数": paper.get("citation_count"),
        }
        for paper in papers
    ]
    st.dataframe(rows, use_container_width=True, hide_index=True)
    st.markdown("##### 打开论文")
    for index, paper in enumerate(papers, start=1):
        if paper.get("url"):
            left, right = st.columns([5, 1])
            left.write(f"{index}. {paper['title']}")
            right.link_button("打开 DOI", paper["url"], use_container_width=True)


def render_artifacts(result: dict[str, Any]) -> None:
    artifacts = result.get("artifacts", {})
    st.subheader("共享产物")
    if not artifacts:
        st.info("本次执行没有生成共享产物。")
        return

    tab_names = []
    if "papers" in artifacts:
        tab_names.append("论文")
    if "knowledge_graph" in artifacts:
        tab_names.append("知识图谱")
    if "proposal" in artifacts:
        tab_names.append("研究方案")
    if "research_report" in artifacts:
        tab_names.append("研究报告")
    if "reading_notes" in artifacts:
        tab_names.append("精读笔记")
    if "draft" in artifacts:
        tab_names.append("论文草稿")
    if "review_report" in artifacts:
        tab_names.append("审查报告")
    if "code_plan" in artifacts:
        tab_names.append("代码方案")

    tabs = st.tabs(tab_names)
    for tab, name in zip(tabs, tab_names):
        with tab:
            if name == "论文":
                render_papers(artifacts["papers"])
            elif name == "知识图谱":
                graph = artifacts["knowledge_graph"]
                st.markdown("#### 节点")
                st.dataframe(graph.get("nodes", []), use_container_width=True)
                st.markdown("#### 关系")
                st.dataframe(graph.get("edges", []), use_container_width=True)
            elif name == "研究方案":
                st.json(artifacts["proposal"])
            elif name == "研究报告":
                report = artifacts["research_report"]
                st.markdown("#### 研究报告")
                st.markdown(f"**研究问题：** {report.get('question', '')}")
                st.write(report.get("evidence_summary"))
                st.markdown("##### 问题回答")
                st.markdown(report.get("answer", ""))
                with st.expander("查看结构化证据"):
                    st.markdown("##### 年度分布")
                    st.dataframe(
                        [
                            {"年份": year, "论文数": count}
                            for year, count in report.get(
                                "year_distribution", {}
                            ).items()
                        ],
                        use_container_width=True,
                        hide_index=True,
                    )
                    st.markdown("##### 主题证据")
                    st.json(report.get("topic_evidence", []))
                    st.markdown("##### 样本内高引用论文")
                    st.json(report.get("most_cited_in_sample", []))
                st.warning("；".join(report.get("limitations", [])))
            elif name == "精读笔记":
                notes = artifacts["reading_notes"]
                st.markdown("#### 正文问答")
                st.markdown(f"**问题：** {notes.get('question', '')}")
                st.markdown(notes.get("answer", ""))
                st.caption(
                    f"PDF 共 {notes.get('page_count', 0)} 页，"
                    f"{notes.get('chunk_count', 0)} 个文本块，"
                    f"提取 {notes.get('extracted_characters', 0)} 个字符"
                )
                st.caption(
                    f"检索方式：{notes.get('retrieval_method', '未提供')}；"
                    f"缓存命中：{'是' if notes.get('cache_hit') else '否'}"
                )
                if notes.get("resolved_pdf_url"):
                    st.link_button("打开原始 PDF", notes["resolved_pdf_url"])
                with st.expander("查看证据页码与原文片段"):
                    for item in notes.get("evidence_anchors", []):
                        st.markdown(
                            f"**第 {item['page']} 页 · {item['chunk_id']}**"
                        )
                        st.write(item["text"])
                with st.expander("查看结构化论文提取"):
                    analysis = notes.get("structured_analysis", {})
                    section_labels = {
                        "summary": "摘要与研究问题",
                        "methodology": "方法",
                        "experiments": "实验与结果",
                        "limitations": "局限",
                    }
                    for key, label in section_labels.items():
                        section = analysis.get(key, {})
                        st.markdown(f"##### {label}")
                        st.write(section.get("content", "未提取"))
                        for anchor in section.get("evidence", []):
                            st.caption(
                                f"证据：第 {anchor['page']} 页 · "
                                f"{anchor['chunk_id']}"
                            )
                    if analysis.get("note"):
                        st.info(analysis["note"])
                st.warning("；".join(notes.get("limitations", [])))
            elif name == "论文草稿":
                st.markdown(artifacts["draft"])
            elif name == "审查报告":
                report = artifacts["review_report"]
                decision = report.get("decision", "UNKNOWN")
                st.metric("审查决策", decision)
                st.json(report)
            elif name == "代码方案":
                st.json(artifacts["code_plan"])


with st.sidebar:
    st.header("运行配置")
    st.caption(f"页面版本：{APP_BUILD}")
    workflow_label = st.selectbox(
        "任务闭环",
        list(WORKFLOW_TYPES),
        key="workflow_type_selector",
        on_change=change_workflow,
        help="论文搜索只运行 Scout；科研探索才会生成知识图谱、研究方案和研究报告。",
    )
    selected_task_type = WORKFLOW_TYPES[workflow_label]
    st.caption(f"执行路径：{WORKFLOW_PATHS[selected_task_type]}")
    run_mode_label = st.radio(
        "运行模式",
        ["演示模式（不调用模型）", "真实模型"],
        index=1 if os.getenv("APP_MODE", "demo").lower() in {"llm", "openai"} else 0,
    )
    run_mode = "llm" if run_mode_label == "真实模型" else "demo"

    provider = st.selectbox(
        "模型提供商",
        ["deepseek", "openai"],
        index=0 if os.getenv("MODEL_PROVIDER", "openai") == "deepseek" else 1,
        disabled=run_mode == "demo",
    )
    paper_source = st.selectbox(
        "论文数据源",
        ["crossref", "mock"],
        index=0 if os.getenv("PAPER_DATA_SOURCE", "mock") == "crossref" else 1,
    )
    result_limit = st.slider(
        "论文返回数量",
        min_value=1,
        max_value=10,
        value=min(10, max(1, int(os.getenv("PAPER_RESULT_LIMIT", "5")))),
    )

    required_key, has_key = key_status(provider)
    if run_mode == "llm":
        if has_key:
            st.success(f"{required_key} 已配置")
        else:
            st.error(f"{required_key} 未配置")
    st.caption("Key 仅从本机 .env 读取，页面不会显示其内容。")

st.markdown(
    """
    <div class="hero">
      <h1>学术多智能体工作台</h1>
      <p>观察 Supervisor 如何规划任务，以及 7 个专业 Agent 如何共享论文、图谱、草稿和审查结果。</p>
    </div>
    """,
    unsafe_allow_html=True,
)

if "reading_messages" not in st.session_state:
    st.session_state["reading_messages"] = []

left, right = st.columns([3, 1])
with right:
    st.markdown("##### 当前闭环")
    st.write(workflow_label)
    st.button(
        "填入当前闭环示例",
        use_container_width=True,
        on_click=apply_example,
        args=(selected_task_type,),
    )

with left:
    reading_input_method = None
    active_paper_id = st.session_state.get("active_paper_id")
    upload_error = None
    if selected_task_type == "paper_reading":
        reading_input_method = st.radio(
            "论文输入方式",
            ["上传本地 PDF", "输入论文链接"],
            horizontal=True,
            key="reading_input_method",
            on_change=change_reading_input_method,
        )
        active_source = st.session_state.get("active_paper_source")
        active_for_method = (
            active_paper_id
            if active_source == reading_input_method
            else None
        )

        if reading_input_method == "上传本地 PDF":
            uploaded_file = st.file_uploader(
                "上传本地论文 PDF（上传一次后可连续提问）",
                type=["pdf"],
                help="文件只缓存在本项目 data/papers 目录，不会写入 API Key。",
            )
            if uploaded_file is not None:
                try:
                    with st.spinner("正在解析并缓存 PDF……"):
                        metadata, cache_hit = DocumentStore().ingest_pdf(
                            uploaded_file.getvalue(),
                            filename=uploaded_file.name,
                        )
                    if active_paper_id != metadata["paper_id"]:
                        st.session_state["active_paper_id"] = metadata["paper_id"]
                        st.session_state["active_paper_source"] = reading_input_method
                        st.session_state["reading_messages"] = []
                        st.session_state.pop("last_result", None)
                    active_paper_id = metadata["paper_id"]
                    active_for_method = metadata["paper_id"]
                    st.success(
                        f"当前论文：{metadata['filename']} · {metadata['page_count']} 页 · "
                        f"{'已读取缓存' if cache_hit else '首次解析完成'}"
                    )
                except Exception as exc:
                    upload_error = str(exc)
                    st.error(f"PDF 上传处理失败：{exc}")
            elif active_for_method:
                metadata = DocumentStore().load_metadata(active_for_method)
                st.info(
                    f"当前论文：{metadata['filename']} · 已从本地缓存加载，"
                    "可以继续提问。"
                )
        else:
            st.info(
                "请在下方同时输入论文链接和问题。首次成功加载后，"
                "后续问题不需要重复粘贴链接。"
            )
            if active_for_method:
                try:
                    metadata = DocumentStore().load_metadata(active_for_method)
                    st.success(
                        f"当前链接论文：{metadata['filename']} · "
                        f"{metadata['page_count']} 页 · 可以继续提问"
                    )
                except Exception:
                    active_for_method = None

        active_paper_id = active_for_method

        for message in st.session_state["reading_messages"]:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])

    input_placeholder = current_example(selected_task_type)
    query = st.text_area(
        "输入论文问题" if selected_task_type == "paper_reading" else "输入科研任务",
        key="query",
        height=110,
        placeholder=input_placeholder,
    )

run_clicked = st.button(
    "运行多智能体闭环",
    type="primary",
    use_container_width=True,
    disabled=run_mode == "llm" and not has_key,
)

if run_clicked:
    query_contains_url = bool(re.search(r"https?://", query))
    workflow_paper_id = (
        active_paper_id
        if selected_task_type == "paper_reading" and not query_contains_url
        else None
    )
    if not query.strip():
        st.warning("请先输入任务。")
    elif (
        selected_task_type == "paper_reading"
        and not workflow_paper_id
        and not query_contains_url
    ):
        st.warning(
            "当前输入方式还没有可用论文。请上传 PDF，或者输入论文链接和问题。"
        )
    elif selected_task_type == "paper_reading" and upload_error:
        st.warning("请先解决 PDF 上传错误。")
    else:
        workflow_settings = Settings.from_env(
            run_mode,
            model_provider=provider,
            paper_data_source=paper_source,
            paper_result_limit=result_limit,
        )
        spinner_text = (
            "正在下载并解析论文链接；连接异常时会自动切换网络通道……"
            if selected_task_type == "paper_reading" and query_contains_url
            else "Supervisor 正在规划并运行 Agent……"
        )
        with st.spinner(spinner_text):
            try:
                workflow_result = run_workflow(
                    query.strip(),
                    task_type=selected_task_type,
                    active_paper_id=workflow_paper_id,
                    conversation_history=(
                        []
                        if query_contains_url
                        else st.session_state.get("reading_messages", [])
                    ),
                    settings=workflow_settings,
                )
                workflow_result["ui_requested_task_type"] = selected_task_type
                st.session_state["last_result"] = workflow_result
                if (
                    selected_task_type == "paper_reading"
                    and workflow_result.get("status") == "success"
                ):
                    notes = workflow_result.get("artifacts", {}).get(
                        "reading_notes", {}
                    )
                    if notes.get("paper_id"):
                        previous_paper_id = st.session_state.get("active_paper_id")
                        st.session_state["active_paper_id"] = notes["paper_id"]
                        st.session_state["active_paper_source"] = (
                            reading_input_method
                        )
                        if previous_paper_id != notes["paper_id"]:
                            st.session_state["reading_messages"] = []
                    st.session_state["reading_messages"].extend(
                        [
                            {"role": "user", "content": query.strip()},
                            {
                                "role": "assistant",
                                "content": notes.get("answer", "未生成回答"),
                            },
                        ]
                    )
            except Exception as exc:
                st.session_state["last_result"] = {
                    "user_query": query,
                    "status": "failed",
                    "error": str(exc),
                    "history": [],
                    "artifacts": {},
                }

result = st.session_state.get("last_result")
if result:
    status = result.get("status")
    requested_task_type = result.get("ui_requested_task_type")
    actual_task_type = result.get("task_type")
    a, b, c = st.columns(3)
    a.metric("任务类型", actual_task_type or "未识别")
    b.metric("状态", status)
    c.metric("已完成 Agent", len(result.get("completed_agents", [])))

    if requested_task_type and requested_task_type != actual_task_type:
        st.error(
            "闭环路由不一致："
            f"页面选择 {requested_task_type}，实际执行 {actual_task_type}。"
            "请停止旧 Streamlit 进程并重新启动。"
        )
    elif requested_task_type:
        st.caption(
            f"闭环校验通过：页面选择和实际执行均为 `{actual_task_type}`。"
        )

    if status == "failed":
        st.error(result.get("error", "执行失败"))
    else:
        st.success("闭环执行完成")

    render_timeline(result)
    render_artifacts(result)

    safe_result = json.dumps(result, ensure_ascii=False, indent=2)
    st.download_button(
        "下载本次 JSON 结果",
        data=safe_result,
        file_name="academic_agents_result.json",
        mime="application/json",
    )
