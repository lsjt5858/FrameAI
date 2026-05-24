# FrameAI Architecture

FrameAI 第一阶段按个人内部工具设计，目标是尽快跑通 AI 视频制作闭环，而不是一次性做成商业 SaaS。

## Directory Layout

```text
backend/
  app/
    adapters/          # 外部生图/生视频平台适配层
    core/              # 配置
    routers/           # FastAPI 路由
    services/          # 存储、后台 worker 等服务
    db.py              # SQLite 初始化
    repositories.py    # 数据访问层
    schemas.py         # API 数据结构
    main.py            # FastAPI 入口
frontend/
  src/
    api/               # 前端 API client
    App.jsx            # 第一版工作台
    styles.css
data/                  # 本地 SQLite 数据库，默认不入库
storage/               # 本地素材文件，默认不入库
docs/
  ARCHITECTURE.md
```

## Backend

后端使用 FastAPI + SQLite。第一版不引入复杂 ORM，数据访问集中在 `repositories.py`，方便后续迁移到 SQLAlchemy/PostgreSQL。

当前核心表：

- `projects`
- `characters`
- `scenes`
- `shots`
- `assets`
- `prompt_templates`
- `generation_tasks`
- `api_call_logs`
- `app_settings`

所有生图和生视频请求都会先写入 `generation_tasks`，后台 worker 轮询 `pending` 任务并执行 adapter。当前内置 `mock` adapter，用来验证任务状态、素材入库、日志记录这条链路。

## Adapter Contract

业务层只调用统一 adapter，不直接依赖第三方 API 细节。

```python
generate_image(task)
generate_video(task)
get_task_status(external_task_id)
download_result(result_url)
```

接真实平台时，在 `backend/app/adapters/` 里新增独立文件，并在 `registry.py` 注册即可。

## Frontend

前端使用 React + Vite。第一版是内部工作台，不做营销页，首屏直接进入项目、分镜、素材、模板、生成和任务页面。

当前页面：

- 项目管理
- 分镜工作台
- 素材库
- 提示词模板库
- 生图/生视频任务
- 任务记录
- 本地设置

## Runtime Data

默认路径：

- SQLite: `data/frameai.sqlite3`
- 文件存储: `storage/`

可以通过环境变量覆盖：

```bash
FRAMEAI_DATABASE_PATH=data/frameai.sqlite3
FRAMEAI_STORAGE_DIR=storage
FRAMEAI_CORS_ORIGINS=http://localhost:5173
```

## Next Steps

1. 接入第一个真实生图 provider。
2. 接入第一个真实图生视频 provider。
3. 为任务增加更完整的异步轮询和失败重试策略。
4. 增加分镜与素材之间的批量绑定和结果对比。
5. 需要多人协作时再迁移 PostgreSQL、对象存储和 Redis/Celery。

