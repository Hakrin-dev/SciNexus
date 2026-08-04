# 研枢后端服务

基于 FastAPI 的研枢科研平台后端，提供论文检索、AI 对话、期刊管理、文献库、统计等 RESTful API。

## 环境要求

- Python >= 3.10

## 安装依赖

```bash
pip install -r requirements.txt
```

## 启动服务

```bash
python main.py
```

服务启动后：
- API 地址：`http://localhost:8000`
- Swagger 文档：`http://localhost:8000/docs`

## 目录结构

```
server/
├── main.py             # FastAPI 主程序（路由、限流、异常处理、SSE）
├── requirements.txt    # Python 依赖清单
└── data/
    └── mock_data.py    # 模拟数据层（论文、期刊、对话、文献库、通知）
```

## 主要接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/papers` | 论文列表（分页/筛选/排序） |
| POST | `/api/search` | AI 语义搜索（限流 10次/分钟） |
| POST | `/api/chat` | AI 对话（限流 30次/分钟） |
| POST | `/api/chat/stream` | AI 对话（SSE 流式返回） |
| GET | `/api/journals` | 期刊/会议列表 |
| GET | `/api/library` | 个人文献库 |
| GET | `/api/notifications` | 通知列表 |
| GET | `/api/stats` | 平台统计 |
