# Provider Setup

FrameAI 默认使用 `mock` provider。`mock` 不需要 API Key，可以完整验证项目、分镜、任务、素材、日志和结果筛选链路。

## OpenAI Images

用途：真实生图。

环境变量：

```bash
OPENAI_API_KEY=sk-...
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_BASE_URL=https://api.openai.com/v1
```

支持能力：

- 文本生图
- 带参考图的图片编辑
- 批量生成
- 结果保存到素材库

无需安装依赖的 Key smoke test：

```bash
export OPENAI_API_KEY=sk-...
python3 scripts/smoke_openai_image.py
```

成功后会生成：

```text
storage/openai-smoke.png
```

## DashScope Wan Video

用途：真实生视频。

环境变量：

```bash
DASHSCOPE_API_KEY=...
DASHSCOPE_REGION=intl
DASHSCOPE_TEXT_VIDEO_MODEL=wan2.7-t2v
DASHSCOPE_IMAGE_VIDEO_MODEL=wan2.7-i2v
DASHSCOPE_POLL_INTERVAL_SECONDS=15
DASHSCOPE_TIMEOUT_SECONDS=600
```

支持能力：

- 文生视频
- 图生视频
- 首尾帧视频
- 异步任务提交、轮询、下载结果

图生视频和首尾帧视频需要外部平台能访问参考图。若素材在本地 `storage/`，需要提供公网地址：

```bash
FRAMEAI_PUBLIC_STORAGE_BASE_URL=https://your-domain.example/storage
```

如果没有公网地址，DashScope adapter 会明确报错，不会静默用错误参数提交。

## Volcengine Ark / Doubao

用途：真实生图和真实生视频。

环境变量：

```bash
VOLCENGINE_API_KEY=...
VOLCENGINE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VOLCENGINE_IMAGE_MODEL=doubao-seedream-3-0-t2i-250415
VOLCENGINE_TEXT_VIDEO_MODEL=doubao-seedance-1-0-lite-t2v-250428
VOLCENGINE_IMAGE_VIDEO_MODEL=doubao-seedance-1-0-pro-250528
VOLCENGINE_POLL_INTERVAL_SECONDS=15
VOLCENGINE_TIMEOUT_SECONDS=900
```

支持能力：

- Seedream 文本生图
- Seedance 文生视频
- Seedance 图生视频
- 首尾帧视频
- 异步任务提交、轮询、下载结果

说明：

- 火山方舟的 `model` 字段可能是公开模型名，也可能是控制台创建的 endpoint id。以上默认值只是启动模板，真实调试时以火山方舟控制台可调用的模型/endpoint 为准。
- 图生视频和首尾帧视频同样需要外部平台能访问参考图。若素材在本地 `storage/`，需要配置 `FRAMEAI_PUBLIC_STORAGE_BASE_URL`。
- 如需传火山平台特有参数，可以在任务参数里添加 `volcengine_extra`，adapter 会合并到请求体。

无需安装依赖的 Key smoke test：

```bash
export VOLCENGINE_API_KEY=...
python3 scripts/smoke_volcengine_image.py
```

成功后会生成：

```text
storage/volcengine-smoke.png
```
