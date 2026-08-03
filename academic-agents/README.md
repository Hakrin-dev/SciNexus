# 学术多智能体工作台

这是一个面向科研场景的 Python 多智能体项目。它使用 **LangGraph** 编排
Supervisor 和 7 个专业智能体，使用 **LangChain** 统一调用 DeepSeek/OpenAI，
并通过 **Streamlit** 提供可视化操作页面。

项目目前可以完成论文搜索、科研探索、PDF 精读、代码辅助、论文写作与审查等
小闭环。它的重点不是让模型自由发挥，而是让每一步有明确职责、输入、输出和
停止条件，方便初学者理解、调试和继续扩展。

> 当前定位：可运行的学习项目和科研助手原型，适合本地演示与二次开发；还不是
> 可以直接用于正式科研结论或大规模公开服务的成熟产品。

## 项目解决什么问题

科研任务往往不是一次模型对话就能完成。例如，“分析某个研究方向”至少包含：

1. 搜索相关论文；
2. 整理论文之间的关系；
3. 基于已有证据回答问题或形成研究方案；
4. 标记证据不足和需要人工复核的部分。

本项目将这些步骤拆给不同智能体，再由 Supervisor 和 Coordinator 控制执行顺序：

```mermaid
flowchart LR
    U["用户输入"] --> S["Supervisor<br/>识别任务并制定计划"]
    S --> A["专业智能体"]
    A --> C["Coordinator<br/>保存产物并决定下一步"]
    C -->|继续| A
    C -->|完成或失败| R["统一结果"]
```

不同智能体通过同一个 `WorkflowState` 共享论文、知识图谱、研究报告、草稿和审查
意见。LangGraph 负责节点、连线、条件路由和结束条件。

## 当前支持的 6 种使用闭环

### 1. 论文搜索

```text
用户问题 → Scout → 论文列表
```

- 只运行 Scout，不额外生成报告；
- 可使用 Crossref 真实论文元数据或本地模拟数据；
- 返回标题、作者、年份、DOI、来源和引用数等信息。

### 2. 科研探索

```text
用户问题 → Scout → Librarian → Research Design → 研究报告
```

- Scout 搜索论文；
- Librarian 整理论文节点和主题关系；
- Research Design 针对用户原问题形成研究回答、证据概览和研究建议；
- 不强制把所有问题写成“趋势报告”。

### 3. 论文精读

```text
PDF 或论文链接 → Synthesis → 相关证据 → 模型回答
```

- 支持上传本地 PDF；
- 支持输入公开论文页面或直接 PDF 链接；
- 同一篇 PDF 解析一次后可连续追问；
- 回答显示证据页码、文本块编号和原文片段；
- 提取摘要/研究问题、方法、实验和局限等结构化内容。

### 4. 代码辅助

```text
编程问题 → Code Assistant → 实现步骤与测试建议
```

当前主要生成代码实施方案，不会虚构已经修改或运行了用户没有提供的代码。

### 5. 写作审查

```text
写作任务 → Writer → Critic
                    ↓
              必要时修改后复审
```

Writer 生成草稿，Critic 检查证据、逻辑和格式。复审次数由
`MAX_REVISIONS` 控制，避免无限循环。

### 6. 论文审查

```text
待审内容 → Critic → 问题清单、修改动作和审查决策
```

只运行 Critic，适合单独检查已有文本。

## 7 个智能体

| 智能体 | 文件 | 当前职责 |
|---|---|---|
| Scout | `specialists/scout.py` | 从 Crossref 或模拟源搜索论文 |
| Synthesis | `specialists/synthesis.py` | 精读 PDF、检索证据并回答问题 |
| Librarian | `specialists/librarian.py` | 整理论文节点和关系 |
| Research Design | `specialists/research_design.py` | 形成研究回答、假设和实验建议 |
| Code Assistant | `specialists/code_assistant.py` | 拆分代码任务和测试步骤 |
| Writer | `specialists/writer.py` | 根据任务与审查意见生成草稿 |
| Critic | `specialists/critic.py` | 检查事实、证据、逻辑和格式 |

这些智能体目前由 LangGraph 按预先定义的路径调用。它们不是完全自主选择任意工具
的通用 Agent。这种设计更容易观察和测试，也更适合作为初学者项目；未来可以逐步
将搜索、检索等能力注册为 LangChain Tool。

## 技术结构

```text
Streamlit 页面
    ↓
Settings（当前会话配置）
    ↓
LangGraph Supervisor / Coordinator
    ↓
7 个专业智能体
    ├── LangChain ChatOpenAI → DeepSeek / OpenAI
    ├── Crossref → 论文元数据
    ├── httpx → PDF 与网页下载
    ├── pypdf → PDF 文字提取
    ├── BM25 + 本地 TF-IDF + RRF → 证据检索
    └── data/ → 论文和查询缓存
```

主要技术：

- Python 3.11 或更高版本；
- LangGraph：工作流编排；
- LangChain OpenAI：OpenAI 兼容模型客户端；
- Streamlit：可视化页面；
- httpx：Crossref 和论文链接请求；
- pypdf：PDF 文本提取；
- pytest：自动测试。

## 快速开始（Windows + VS Code）

### 1. 在 VS Code 打开项目

在 VS Code 中选择“文件 → 打开文件夹”，打开本项目目录，然后选择
“终端 → 新建终端”。终端提示符的路径应以项目目录结尾。

### 2. 创建虚拟环境

```powershell
py -3.11 -m venv .venv
```

如果电脑没有 `py` 命令，请安装 Python 3.11 或更新版本，并在安装时勾选
“Add Python to PATH”。

### 3. 安装依赖

不必激活虚拟环境，直接使用虚拟环境中的 Python 最稳定：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
```

`requirements.lock` 是当前测试通过的精确依赖快照。只想安装允许范围内的最新
兼容版本时，也可以使用：

```powershell
.\.venv\Scripts\python.exe -m pip install -e .
```

### 4. 启动网页

```powershell
.\.venv\Scripts\python.exe -m streamlit run app.py
```

浏览器通常会自动打开：

```text
http://localhost:8501
```

如果没有自动打开，请按住 `Ctrl` 点击 VS Code 终端中的 `Local URL`。

停止服务时，在终端按：

```text
Ctrl + C
```

## 第一次演示建议

先使用不消耗 API 费用的配置：

```text
运行模式：演示模式
论文数据源：mock
```

依次尝试：

1. 论文搜索：观察只运行 Scout；
2. 科研探索：观察 Scout → Librarian → Research Design；
3. 论文精读：上传一篇可提取文字的 PDF；
4. 写作审查：观察 Writer 与 Critic 的修改闭环。

演示模式主要用于确认路由、状态和产物结构。需要自然语言回答时，再切换到真实
模型和 Crossref。

## 配置 DeepSeek 或 OpenAI

复制 `.env.example` 并将副本命名为 `.env`：

```powershell
Copy-Item .env.example .env
```

### DeepSeek

```env
APP_MODE=llm
MODEL_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

### OpenAI

```env
APP_MODE=llm
MODEL_PROVIDER=openai
OPENAI_API_KEY=你的Key
OPENAI_MODEL=gpt-5.6-terra
```

安全检查（不会打印 Key 内容）：

```powershell
.\.venv\Scripts\python.exe -m academic_agents.check_config
```

注意：

- `.env` 已被 Git 忽略，不要主动删除这一保护；
- 不要把 API Key 发到聊天、截图、README 或 GitHub；
- `demo` 模式不会调用模型，也不会产生模型费用；
- DeepSeek 当前用于聊天回答，不提供本项目所需的官方 Embedding API；
- 页面配置按 Streamlit 会话传入工作流，不通过全局环境变量互相覆盖。

## 配置论文数据源

### 模拟数据

```env
PAPER_DATA_SOURCE=mock
```

它适合测试流程，但页面中的模拟论文不能作为真实科研证据。

### Crossref

```env
PAPER_DATA_SOURCE=crossref
PAPER_RESULT_LIMIT=5
CROSSREF_CONTACT_EMAIL=你的联系邮箱
```

Crossref 公共 API 不要求登录或 API Key。联系邮箱用于遵循公共 API 的礼貌访问
建议，不会显示在论文结果中。

查询缓存位于：

```text
data/cache/crossref/
```

网络失败时，系统会尝试不同连接方式并给出错误原因。Crossref 只提供论文元数据，
不保证每篇论文都有公开全文。

## PDF 精读如何工作

### 本地上传

选择“论文精读（仅 Synthesis）→ 上传本地 PDF”，上传后可以提问：

```text
这篇文章的研究主题与创新方法是什么？
```

### 论文链接

选择“输入论文链接”，首次输入链接和问题：

```text
https://arxiv.org/pdf/1706.03762 这篇论文为什么使用多头注意力？
```

首次成功后，后续问题不需要重复粘贴链接。输入一个新链接时，系统会切换到新论文，
不会误用上一篇论文。

### 本地缓存

PDF 根据文件内容计算 SHA-256 `paper_id`，保存在：

```text
data/papers/<paper_id>/
├── original.pdf
├── metadata.json
├── chunks.json
└── structured_summary.json
```

缓存文件使用版本号和原子写入。发现旧版本或损坏缓存时，系统会重新解析，降低程序
中断或同时写入造成的文件损坏风险。

### 当前检索方式

```text
BM25 关键词检索
        +
本地 TF-IDF 字符相似度
        ↓
RRF 排名融合
        ↓
选择相关页码与文本块
        ↓
DeepSeek/OpenAI 根据证据回答
```

当前 TF-IDF 是本地字符相似度，不是真正的语义 Embedding。它免费、快速且不需要
联网，但中文提问和英文论文之间的跨语言语义检索能力有限。网页不展示内部评分，
只展示更容易核查的页码和证据原文。

## 命令行运行

运行一个任务：

```powershell
.\.venv\Scripts\python.exe -m academic_agents "分析多智能体协作研究" --mode demo
```

只查看执行路径和产物名称：

```powershell
.\.venv\Scripts\python.exe -m academic_agents "搜索 multi-agent 论文" --mode demo --summary
```

一次运行多个示例：

```powershell
.\.venv\Scripts\python.exe -m examples.run_small_loops
```

如果使用可编辑安装，还可以执行：

```powershell
.\.venv\Scripts\academic-agents.exe "搜索 multi-agent 论文" --mode demo --summary
```

## 自动测试

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

当前共有 49 项测试，覆盖：

- Supervisor 路由；
- 6 种闭环和 7 个智能体可达性；
- Writer/Critic 停止条件；
- Streamlit 模式切换；
- Crossref 清洗、排序、缓存和重试；
- 中文查询回退；
- PDF 链接解析和内网地址拦截；
- PDF 缓存和混合检索；
- DeepSeek/OpenAI 模型客户端配置。

这些测试以单元测试和模拟网络为主，不等同于真实网络、真实 API 和大量 PDF 的
端到端压力测试。

## 项目目录

```text
.
├── app.py                         # Streamlit 页面入口
├── academic_agents/
│   ├── workflow.py                # LangGraph 节点、连线和停止条件
│   ├── supervisor.py              # 任务识别和执行计划
│   ├── state.py                   # 工作流共享状态
│   ├── config.py                  # 配置读取与校验
│   ├── model_gateway.py           # DeepSeek/OpenAI 模型客户端
│   ├── agents.py                  # 7 个智能体注册表
│   ├── specialists/               # 每个智能体的实现
│   └── tools/
│       ├── paper_search.py         # Crossref 与模拟论文源
│       ├── paper_reader.py         # 安全下载和 PDF 文本提取
│       ├── document_store.py       # PDF 缓存
│       └── hybrid_retriever.py     # BM25、TF-IDF 和 RRF
├── examples/                      # 最小闭环示例
├── tests/                         # 自动测试
├── .streamlit/config.toml         # Streamlit 深色主题
├── .env.example                   # 环境变量模板
├── pyproject.toml                 # 正式项目与依赖配置
├── requirements.lock              # 精确依赖快照
└── requirements.txt               # 简洁依赖列表
```

建议初次阅读代码时按以下顺序：

1. `academic_agents/state.py`
2. `academic_agents/supervisor.py`
3. `academic_agents/agents.py`
4. `academic_agents/specialists/`
5. `academic_agents/workflow.py`
6. `academic_agents/tools/`
7. `app.py`
8. `tests/`

## 当前已经做好的工程保护

- API Key 只从本机环境读取，不进入工作流结果；
- Streamlit 会话配置显式传入，不修改进程级模型配置；
- PDF 限制为 30 MB，并检查 `%PDF` 文件头；
- 论文 URL 拒绝 localhost、内网 IP、账号密码和危险重定向；
- PDF 缓存带版本号并采用原子写入；
- Crossref 请求有超时、重试和本地缓存；
- Writer/Critic 循环有最大次数；
- PDF 回答要求基于检索证据并标注页码；
- 模拟论文明确标记为不可作为科研证据。

## 当前局限

### 检索与 PDF

- 没有真正的多语言 Embedding，跨语言语义检索较弱；
- 扫描图片版 PDF 没有 OCR；
- 表格、公式、图片和复杂双栏排版提取效果有限；
- 只读取公开可下载的 PDF，不绕过登录、订阅或付费限制；
- PDF 下载仍会将响应读入内存后检查大小，不适合不受信任的大规模公开服务。

### 论文数据

- Crossref 是元数据服务，不是完整学术搜索引擎；
- 论文摘要、引用数和 DOI 可能缺失或滞后；
- 当前知识图谱是项目内部的轻量节点关系，不是真实共引网络；
- 没有接入 Semantic Scholar、OpenAlex、arXiv API 或出版社全文接口。

### 多智能体

- Supervisor 主要使用规则路由，不是模型自主规划；
- 工具由代码预先绑定给智能体，还没有注册为可自主选择的 LangChain Tool；
- Writer、Critic、Research Design 的演示模式输出是模板化结果；
- 缺少任务级持久化、用户账户和长期记忆。

### 工程化

- `app.py` 仍然较大，页面状态与渲染逻辑需要继续拆分；
- 缺少结构化日志、运行追踪和管理员监控；
- 缺少 Ruff、类型检查和覆盖率门槛；
- 没有数据库、任务队列和并发限流；
- 当前更适合单机本地使用，不建议未经加固直接暴露到公网。

## 改进路线

### P0：先提高检索质量

1. 接入本地多语言 Embedding，例如 BGE-M3；
2. 缓存每个 PDF 文本块的向量；
3. 保留 BM25，与 Embedding 通过 RRF 融合；
4. 建立中英文问题—证据页码测试集；
5. 比较 TF-IDF 与 Embedding 的召回效果。

推荐结构：

```text
BM25 关键词检索 + BGE-M3 语义检索
                ↓
             RRF 融合
                ↓
       DeepSeek/OpenAI 证据回答
```

### P1：增强 PDF 能力

1. 为扫描 PDF 增加 OCR；
2. 增加表格和图片提取；
3. 优化标题、章节和跨页切块；
4. 对下载内容使用流式大小限制；
5. 增加更多真实 PDF 回归测试。

### P2：提高代码可维护性

1. 将 `app.py` 拆分为页面、组件、状态和渲染模块；
2. 使用 Pydantic 或更细的 `TypedDict` 定义产物结构；
3. 增加 `logging.exception()` 和本地日志文件；
4. 加入 Ruff、Pyright/Mypy、pytest-cov 和 pre-commit；
5. 缓存模型客户端和已编译的 LangGraph。

### P3：扩展数据与知识管理

1. 接入 OpenAlex、Semantic Scholar 或 arXiv；
2. 用 SQLite/PostgreSQL 保存论文和用户项目；
3. 建立真正的引用、共引和主题关系；
4. 增加文献去重、标签、收藏和导出；
5. 支持 BibTeX、RIS 和 Markdown 报告导出。

### P4：从确定性工作流升级为工具型 Agent

1. 将论文搜索、PDF 检索等封装为 LangChain Tool；
2. 为每个 Tool 定义严格输入输出结构；
3. 允许 Supervisor 在受控范围内动态选择工具；
4. 保留最大步骤数、费用上限和人工确认节点；
5. 使用 LangSmith 或自建追踪记录每次决策。

### P5：准备公开部署

1. 增加身份认证和用户数据隔离；
2. 增加请求限流、任务队列和并发控制；
3. 将文件缓存迁移到对象存储；
4. 增加数据库备份和隐私策略；
5. 进行 SSRF、文件上传、依赖和压力安全测试。

## 参与开发时的基本原则

- 新功能先明确输入、输出和失败方式；
- 每个智能体只承担一个清晰职责；
- 不把模拟数据包装成真实科研证据；
- 模型生成的结论必须能够追溯到论文或明确标记“证据不足”；
- 修改路由、缓存或闭环时同步增加自动测试；
- 不提交 `.env`、API Key、用户 PDF 和运行缓存。

## 免责声明

本项目用于学习、研究辅助和原型验证。Crossref 元数据、PDF 自动提取结果和模型回答
都可能不完整或存在错误。正式写作、引用、实验设计和投稿决策前，请打开原论文并由
研究者人工复核。
