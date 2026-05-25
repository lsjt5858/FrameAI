# FrameAI

FrameAI 是一个面向 AI 漫剧 / AI 视频生产流程的内部工作流中台，用来把项目、素材、提示词、分镜、生成任务和结果管理串成一个可复用、可追踪、可扩展的生产闭环。

`README.md` 只保留仓库入口信息；产品规划、模块设计和阶段路线统一以 `开发指南.md` 为准。

## 项目现状

当前仓库已经完成第一版 MVP 骨架，重点是先跑通项目、素材、提示词模板、生成任务和结果入库这条闭环。

- 后端：FastAPI + SQLite API 服务
- 前端：React + Vite 内部工作台
- 默认 provider：`mock`
- 本地存储：`data/` 与 `storage/`

当前已落地的核心能力：

- 项目、分镜、素材、提示词模板、生成任务、API 日志等基础数据结构
- 后台任务状态流转与本地素材落库链路
- `mock` adapter，用于验证任务队列、状态轮询和结果保存
- OpenAI 图片、DashScope Wan 视频、火山方舟图片/视频的真实 provider 接入基础

## 仓库结构

```text
backend/   FastAPI 服务、数据模型、任务 worker、provider adapters
frontend/  React + Vite 工作台
data/      本地 SQLite 数据目录
storage/   本地素材文件目录
docs/      架构说明、开发进度、provider 配置
scripts/   provider smoke test 脚本
```

## 文档索引

- `开发指南.md`：产品定位、模块设计、路线图、验收标准
- `docs/ARCHITECTURE.md`：工程结构与扩展说明
- `docs/PROGRESS.md`：开发进度与待办记录
- `docs/PROVIDERS.md`：真实 provider 配置与 smoke test

## 本地运行

### 后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

默认访问地址：

- 前端工作台：<http://localhost:5173>
- 后端 API：<http://localhost:8000>
- API 文档：<http://localhost:8000/docs>

## Provider 配置

默认使用 `mock` provider，不需要 API Key，适合本地验证完整链路。

如需接入真实 provider，优先查看 `docs/PROVIDERS.md`。常见环境变量包括：

```bash
OPENAI_API_KEY=sk-...
OPENAI_IMAGE_MODEL=gpt-image-1

DASHSCOPE_API_KEY=...
DASHSCOPE_TEXT_VIDEO_MODEL=wan2.7-t2v
DASHSCOPE_IMAGE_VIDEO_MODEL=wan2.7-i2v

VOLCENGINE_API_KEY=...
VOLCENGINE_IMAGE_MODEL=doubao-seedream-3-0-t2i-250415
VOLCENGINE_TEXT_VIDEO_MODEL=doubao-seedance-1-0-lite-t2v-250428
VOLCENGINE_IMAGE_VIDEO_MODEL=doubao-seedance-1-0-pro-250528
```

注意：图生视频或首尾帧视频通常要求外部平台可访问参考图。如果素材仍在本地 `storage/`，需要配置公网地址：

```bash
FRAMEAI_PUBLIC_STORAGE_BASE_URL=https://your-domain.example/storage
```

## 开发建议

- 产品与流程设计变更，优先更新 `开发指南.md`
- 工程结构或模块边界变化，更新 `docs/ARCHITECTURE.md`
- 进度与任务拆解变化，更新 `docs/PROGRESS.md`
- provider 参数、能力或调试方式变化，更新 `docs/PROVIDERS.md`
