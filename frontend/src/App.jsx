import { useEffect, useMemo, useState } from "react";
import { api, fileUrl } from "./api/client.js";

const NAV_GROUPS = ["工作台", "素材", "生成", "系统"];
const NAV_ITEMS = [
  { id: "overview", label: "总览", hint: "生产概览", group: "工作台" },
  { id: "guide", label: "生产向导", hint: "下一步", group: "工作台" },
  { id: "projects", label: "项目列表", hint: "创建 / 筛选", group: "工作台" },
  { id: "project-detail", label: "项目详情", hint: "进度 / 近期", group: "工作台" },
  { id: "development", label: "剧本开发", hint: "人物 / 拆镜", group: "工作台" },
  { id: "shots", label: "分镜工作台", hint: "镜头 / 结果", group: "工作台" },
  { id: "assets", label: "素材库", hint: "筛选 / 评审", group: "素材" },
  { id: "templates", label: "提示词模板", hint: "变量套用", group: "素材" },
  { id: "image-gen", label: "生图中心", hint: "模型 / 比例", group: "生成" },
  { id: "video-gen", label: "生视频中心", hint: "首尾帧 / 运动", group: "生成" },
  { id: "tasks", label: "任务记录", hint: "队列 / 重跑", group: "系统" },
  { id: "logs", label: "成本日志", hint: "调用统计", group: "系统" },
  { id: "settings", label: "设置", hint: "Provider", group: "系统" }
];

const EMPTY_PROJECT = { name: "", description: "" };
const EMPTY_SHOT = {
  title: "",
  story: "",
  characters: "",
  reference_asset_ids: [],
  image_prompt: "",
  video_prompt: "",
  status: "draft",
  notes: ""
};
const EMPTY_TEMPLATE = { name: "", category: "image", content: "", variables: "", notes: "" };
const EMPTY_IMAGE_PARAMS = {
  aspect_ratio: "16:9",
  resolution: "1280x720",
  count: 1,
  max_retries: 1,
  guidance: 7,
  negative_prompt: ""
};
const EMPTY_VIDEO_PARAMS = {
  duration: 5,
  motion: "medium",
  camera_move: "static",
  count: 1,
  max_retries: 1,
  seed: ""
};

const DEFAULT_DEVELOPMENT_WORKSPACE = {
  logline: "",
  genre: "",
  targetPlatform: "抖音 / B站",
  audience: "",
  worldview: "",
  visualStyle: "",
  episodeTitle: "EP01",
  episodeScript: "场景一：夜晚，主角站在城市天台，远处霓虹闪烁。\n主角：今晚必须拿到那份数据。\n动作：她拉紧外套，转身冲向楼梯。\n\n场景二：地下市场，人群拥挤，道具摊灯光忽明忽暗。\n配角：你来晚了。\n动作：主角停下脚步，发现目标已经出现。",
  characters: [
    { name: "主角", role: "主人公", voice: "冷静、克制、关键时刻直接", visual: "年轻女性，短发，深色外套，眼神锐利" },
    { name: "配角", role: "情报提供者", voice: "话少，带一点讽刺", visual: "戴帽子，旧夹克，随身终端" }
  ],
  props: [
    { name: "数据卡", type: "关键道具", visual: "透明芯片，蓝色微光", usage: "推动任务线索" }
  ],
  scenes: [
    { name: "城市天台", time: "夜晚", mood: "冷、紧张", visual: "霓虹、雨水、远景高楼" },
    { name: "地下市场", time: "夜晚", mood: "嘈杂、危险", visual: "摊位、蒸汽管道、混乱人群" }
  ],
  shotDrafts: [],
  checklist: {
    topic: false,
    bible: false,
    script: false,
    visual: false,
    prompts: false,
    storage: false,
    pilot: false
  },
  qualityChecks: {
    naming: false,
    faceHands: false,
    characterConsistency: false,
    dialogueProof: false,
    audioSync: false,
    platformSpec: false,
    mobilePreview: false
  },
  publishPlan: {
    platform: "抖音 / B站",
    schedule: "",
    titleA: "",
    titleB: "",
    coverBrief: "",
    metrics: "播放量、完播率、互动率、评论高频词"
  }
};

const DEVELOPMENT_CHECKLIST = [
  ["topic", "确定故事类型、目标平台和受众画像"],
  ["bible", "完成人物圣经、关系和语言风格"],
  ["script", "完成单集剧本并标注场景/动作/对白"],
  ["visual", "锁定视觉圣经、角色和场景参考"],
  ["prompts", "建立角色/场景/镜头提示词公式"],
  ["storage", "建立命名规范和素材存储规则"],
  ["pilot", "至少跑通第一集：剧本 -> 分镜 -> 出图 -> 审核"]
];

const QUALITY_CHECKLIST = [
  ["naming", "文件命名规范：EP01_S02_F003_v2"],
  ["faceHands", "手、脸、细节异常检查"],
  ["characterConsistency", "角色一致性与人物圣经对照"],
  ["dialogueProof", "对白、字幕和错别字校对"],
  ["audioSync", "配音、音效和画面对位"],
  ["platformSpec", "平台规格：比例、时长、画质、字幕安全区"],
  ["mobilePreview", "手机端预览通过"]
];

const CAPABILITY_GAPS = [
  { name: "剧本开发", status: "已补充", detail: "故事定位、人物圣经、场景道具、单集剧本和拆镜草稿" },
  { name: "提示词公式沉淀", status: "本轮补充", detail: "人物/场景/镜头公式可保存到模板库" },
  { name: "批量出图流水线", status: "本轮补充", detail: "可对已有分镜批量创建生图或生视频任务" },
  { name: "质检交付", status: "本轮补充", detail: "交付检查、发布计划和复盘指标进入剧本开发台" },
  { name: "后端结构化存储", status: "待做", detail: "人物、场景、道具、剧本目前仍是浏览器本地工作区" },
  { name: "音频与发布数据", status: "待做", detail: "AI配音、字幕、平台发布和真实数据回收尚未接后端" }
];

const GUIDE_STEP_DEFINITIONS = [
  { key: "project", title: "创建项目", tab: "projects", summary: "先建一个项目容器，后续剧本、分镜、素材和任务都挂在这里。", output: "项目名称、项目说明" },
  { key: "script", title: "故事定位与单集剧本", tab: "development", view: "script", summary: "写一句话卖点、世界观和第一集脚本。", output: "故事定位、世界观、单集剧本" },
  { key: "bible", title: "人物圣经与视觉圣经", tab: "development", view: "bible", summary: "锁定人物语言风格、外形关键词、场景和道具。", output: "人物卡、场景库、道具库" },
  { key: "drafts", title: "拆镜并导入分镜", tab: "development", view: "shots", summary: "把单集剧本拆成镜头草稿，再导入分镜工作台。", output: "分镜列表、镜头提示词" },
  { key: "templates", title: "沉淀提示词模板", tab: "development", view: "bible", summary: "把人物、场景、生图、生视频公式保存为可复用模板。", output: "人物/场景/镜头模板" },
  { key: "image", title: "批量生图", tab: "shots", summary: "按分镜表逐格创建生图任务，获得候选图。", output: "分镜候选图素材" },
  { key: "review", title: "素材评审与入选", tab: "assets", summary: "筛选候选图，标记喜欢/入选/废弃。", output: "入选图、评审记录" },
  { key: "video", title: "批量生视频", tab: "shots", summary: "用入选图和视频提示词批量创建视频任务。", output: "分镜视频素材" },
  { key: "delivery", title: "质检发布", tab: "development", view: "delivery", summary: "做命名、手脸、字幕、平台规格和发布计划检查。", output: "质检清单、发布计划" }
];

function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [projects, setProjects] = useState([]);
  const [shots, setShots] = useState([]);
  const [assets, setAssets] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [providers, setProviders] = useState([]);
  const [runtime, setRuntime] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT);
  const [editingProjectId, setEditingProjectId] = useState("");
  const [projectEditForm, setProjectEditForm] = useState(EMPTY_PROJECT);
  const [shotForm, setShotForm] = useState(EMPTY_SHOT);
  const [editingShotId, setEditingShotId] = useState("");
  const [shotEditForm, setShotEditForm] = useState(EMPTY_SHOT);
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE);
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [templateEditForm, setTemplateEditForm] = useState(EMPTY_TEMPLATE);
  const [templateApplyId, setTemplateApplyId] = useState("");
  const [templateVariableValues, setTemplateVariableValues] = useState({});
  const [imagePrompt, setImagePrompt] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [imageParams, setImageParams] = useState(EMPTY_IMAGE_PARAMS);
  const [videoParams, setVideoParams] = useState(EMPTY_VIDEO_PARAMS);
  const [imageProviderId, setImageProviderId] = useState("mock");
  const [videoProviderId, setVideoProviderId] = useState("mock");
  const [referenceAssetId, setReferenceAssetId] = useState("");
  const [endFrameAssetId, setEndFrameAssetId] = useState("");
  const [assetFile, setAssetFile] = useState(null);
  const [assetName, setAssetName] = useState("");
  const [assetTypeFilter, setAssetTypeFilter] = useState("all");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [taskLogs, setTaskLogs] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState("all");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetReviewFilter, setAssetReviewFilter] = useState("all");
  const [assetView, setAssetView] = useState("grid");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState("all");
  const [selectedShotId, setSelectedShotId] = useState("");
  const [shotPanel, setShotPanel] = useState("detail");
  const [showImageAdvanced, setShowImageAdvanced] = useState(false);
  const [showVideoAdvanced, setShowVideoAdvanced] = useState(false);
  const [developmentWorkspace, setDevelopmentWorkspace] = useState(loadDevelopmentWorkspace);
  const [developmentView, setDevelopmentView] = useState("script");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || projects[0],
    [projects, selectedProjectId]
  );
  const currentProjectId = selectedProject?.id || "";
  const projectShots = useMemo(
    () => shots.filter((shot) => !currentProjectId || shot.project_id === currentProjectId),
    [shots, currentProjectId]
  );
  const projectAssets = useMemo(
    () => assets.filter((asset) => !currentProjectId || asset.project_id === currentProjectId),
    [assets, currentProjectId]
  );
  const visibleProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesSearch = !query
        || project.name.toLowerCase().includes(query)
        || (project.description || "").toLowerCase().includes(query);
      const matchesStatus = projectStatusFilter === "all" || project.status === projectStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, projectSearch, projectStatusFilter]);
  const visibleAssets = useMemo(
    () => {
      const query = assetSearch.trim().toLowerCase();
      return projectAssets.filter((asset) => {
        const matchesType = assetTypeFilter === "all" || asset.asset_type === assetTypeFilter;
        const matchesReview = assetReviewFilter === "all" || asset.review_status === assetReviewFilter;
        const matchesSearch = !query
          || asset.name.toLowerCase().includes(query)
          || (asset.prompt || "").toLowerCase().includes(query)
          || (asset.model || "").toLowerCase().includes(query);
        return matchesType && matchesReview && matchesSearch;
      });
    },
    [projectAssets, assetTypeFilter, assetReviewFilter, assetSearch]
  );
  const selectedAsset = useMemo(
    () => projectAssets.find((asset) => asset.id === selectedAssetId) || null,
    [projectAssets, selectedAssetId]
  );
  const projectTasks = useMemo(
    () => tasks.filter((task) => !currentProjectId || task.project_id === currentProjectId),
    [tasks, currentProjectId]
  );
  const selectedShot = useMemo(
    () => projectShots.find((shot) => shot.id === selectedShotId) || projectShots[0] || null,
    [projectShots, selectedShotId]
  );
  const filteredTemplates = useMemo(
    () => templates.filter((template) => (
      templateCategoryFilter === "all" || template.category === templateCategoryFilter
    )),
    [templates, templateCategoryFilter]
  );
  const selectedTask = useMemo(
    () => projectTasks.find((task) => task.id === selectedTaskId) || projectTasks[0] || null,
    [projectTasks, selectedTaskId]
  );
  const projectLogs = useMemo(() => {
    const taskIds = new Set(projectTasks.map((task) => task.id));
    return logs.filter((log) => !log.task_id || taskIds.has(log.task_id));
  }, [logs, projectTasks]);
  const imageAssets = useMemo(
    () => projectAssets.filter((asset) => asset.asset_type === "image"),
    [projectAssets]
  );
  const imageProviders = useMemo(
    () => providers.filter((provider) => ["image", "image_video"].includes(provider.kind)),
    [providers]
  );
  const videoProviders = useMemo(
    () => providers.filter((provider) => ["video", "image_video"].includes(provider.kind)),
    [providers]
  );
  const runningTasks = useMemo(
    () => projectTasks.filter((task) => ["pending", "running"].includes(task.status)),
    [projectTasks]
  );
  const selectedAssetsCount = useMemo(
    () => projectAssets.filter((asset) => asset.is_selected).length,
    [projectAssets]
  );
  const guideSteps = useMemo(
    () => buildGuideSteps({
      projects,
      selectedProject,
      projectShots,
      projectAssets,
      projectTasks,
      templates,
      selectedAssetsCount,
      developmentWorkspace
    }),
    [
      projects,
      selectedProject,
      projectShots,
      projectAssets,
      projectTasks,
      templates,
      selectedAssetsCount,
      developmentWorkspace
    ]
  );
  const currentGuideStep = useMemo(
    () => guideSteps.find((step) => step.status === "current") || guideSteps[guideSteps.length - 1],
    [guideSteps]
  );

  function navigateToGuideStep(step) {
    if (!step) return;
    if (step.view) setDevelopmentView(step.view);
    setActiveTab(step.tab);
  }

  async function loadAll() {
    setError("");
    const [projectData, templateData, providerData, runtimeData, logData] = await Promise.all([
      api.listProjects(),
      api.listTemplates(),
      api.providers(),
      api.runtime(),
      api.listLogs()
    ]);
    setProjects(projectData);
    setTemplates(templateData);
    setProviders(providerData.providers || []);
    setRuntime(runtimeData);
    setLogs(logData);
    const nextProjectId = selectedProjectId || projectData[0]?.id || "";
    if (nextProjectId) {
      setSelectedProjectId(nextProjectId);
      const [shotData, assetData, taskData] = await Promise.all([
        api.listShots(nextProjectId),
        api.listAssets(nextProjectId),
        api.listTasks(nextProjectId)
      ]);
      setShots(shotData);
      setAssets(assetData);
      setTasks(taskData);
    } else {
      setShots([]);
      setAssets([]);
      setTasks([]);
    }
  }

  async function refreshProjectData(projectId = currentProjectId) {
    if (!projectId) return;
    const [shotData, assetData, taskData, logData] = await Promise.all([
      api.listShots(projectId),
      api.listAssets(projectId),
      api.listTasks(projectId),
      api.listLogs()
    ]);
    setShots(shotData);
    setAssets(assetData);
    setTasks(taskData);
    setLogs(logData);
  }

  async function runAction(action) {
    try {
      setError("");
      await action();
    } catch (err) {
      setError(err.message || "操作失败");
    }
  }

  useEffect(() => {
    loadAll()
      .catch((err) => setError(err.message || "后端连接失败"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!currentProjectId) return undefined;
    refreshProjectData(currentProjectId).catch(() => undefined);
    const timer = window.setInterval(() => {
      api.listTasks(currentProjectId).then(setTasks).catch(() => undefined);
      api.listAssets(currentProjectId).then(setAssets).catch(() => undefined);
      api.listLogs().then(setLogs).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [currentProjectId]);

  useEffect(() => {
    if (!selectedTask) {
      setTaskLogs([]);
      return undefined;
    }

    api.listTaskLogs(selectedTask.id).then(setTaskLogs).catch(() => setTaskLogs([]));
    return undefined;
  }, [selectedTask?.id]);

  useEffect(() => {
    if (!projectShots.length) {
      setSelectedShotId("");
      return;
    }
    if (!projectShots.some((shot) => shot.id === selectedShotId)) {
      setSelectedShotId(projectShots[0].id);
    }
  }, [projectShots, selectedShotId]);

  useEffect(() => {
    saveDevelopmentWorkspace(developmentWorkspace);
  }, [developmentWorkspace]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeTab]);

  function updateDevelopmentField(field, value) {
    setDevelopmentWorkspace((workspace) => ({ ...workspace, [field]: value }));
  }

  function updateDevelopmentListItem(listName, index, field, value) {
    setDevelopmentWorkspace((workspace) => ({
      ...workspace,
      [listName]: workspace[listName].map((item, itemIndex) => (
        itemIndex === index ? { ...item, [field]: value } : item
      ))
    }));
  }

  function addDevelopmentListItem(listName, item) {
    setDevelopmentWorkspace((workspace) => ({
      ...workspace,
      [listName]: [...workspace[listName], item]
    }));
  }

  function removeDevelopmentListItem(listName, index) {
    setDevelopmentWorkspace((workspace) => ({
      ...workspace,
      [listName]: workspace[listName].filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  function handleBuildShotDrafts() {
    setDevelopmentWorkspace((workspace) => ({
      ...workspace,
      shotDrafts: buildShotDraftsFromScript(workspace)
    }));
    setDevelopmentView("shots");
  }

  async function handleImportShotDrafts() {
    if (!currentProjectId) {
      setError("请先创建或选择一个项目，再导入分镜。");
      return;
    }

    const drafts = developmentWorkspace.shotDrafts.length
      ? developmentWorkspace.shotDrafts
      : buildShotDraftsFromScript(developmentWorkspace);

    await runAction(async () => {
      for (const draft of drafts) {
        await api.createShot({
          project_id: currentProjectId,
          title: draft.title,
          story: draft.story,
          characters: draft.characters,
          reference_asset_ids: [],
          image_prompt: draft.image_prompt,
          video_prompt: draft.video_prompt,
          status: "draft",
          notes: [
            draft.scene ? `场景：${draft.scene}` : "",
            draft.dialogue ? `对白：${draft.dialogue}` : "",
            draft.props.length ? `道具：${draft.props.join("、")}` : ""
          ].filter(Boolean).join("\n")
        });
      }
      setDevelopmentWorkspace((workspace) => ({ ...workspace, shotDrafts: drafts }));
      await refreshProjectData();
      setActiveTab("shots");
    });
  }

  async function handleSaveDevelopmentTemplates() {
    const templatesToCreate = buildDevelopmentPromptTemplates(developmentWorkspace);
    await runAction(async () => {
      const createdTemplates = [];
      for (const template of templatesToCreate) {
        createdTemplates.push(await api.createTemplate(template));
      }
      setTemplates([...createdTemplates, ...templates]);
      setDevelopmentWorkspace((workspace) => ({
        ...workspace,
        checklist: { ...workspace.checklist, prompts: true }
      }));
      setActiveTab("templates");
    });
  }

  function updateQualityCheck(key, checked) {
    setDevelopmentWorkspace((workspace) => ({
      ...workspace,
      qualityChecks: { ...workspace.qualityChecks, [key]: checked }
    }));
  }

  function updatePublishPlan(field, value) {
    setDevelopmentWorkspace((workspace) => ({
      ...workspace,
      publishPlan: { ...workspace.publishPlan, [field]: value }
    }));
  }

  async function handleCreateBatchShotTasks(type) {
    if (!currentProjectId) {
      setError("请先创建或选择一个项目。");
      return;
    }

    const targetShots = projectShots.filter((shot) => {
      const prompt = type === "image" ? shot.image_prompt || shot.story : shot.video_prompt || shot.story;
      return prompt.trim();
    });

    if (!targetShots.length) {
      setError(type === "image" ? "当前项目没有可用于生图的分镜提示词。" : "当前项目没有可用于生视频的分镜提示词。");
      return;
    }

    await runAction(async () => {
      const providerInfo = type === "image"
        ? imageProviders.find((provider) => provider.id === imageProviderId) || imageProviders[0]
        : videoProviders.find((provider) => provider.id === videoProviderId) || videoProviders[0];
      const provider = providerInfo?.id || "mock";
      const model = type === "image"
        ? providerInfo?.image_model || "mock-image-v1"
        : providerInfo?.video_model || "mock-video-v1";
      const params = type === "image" ? normalizedImageParams(imageParams) : normalizedVideoParams(videoParams);
      const max_retries = type === "image" ? Number(imageParams.max_retries) : Number(videoParams.max_retries);
      const create = type === "image" ? api.createImageTask : api.createVideoTask;

      for (const shot of targetShots) {
        const prompt = type === "image" ? shot.image_prompt || shot.story : shot.video_prompt || shot.story;
        const reference_asset_ids = type === "image"
          ? shot.reference_asset_ids
          : [shot.selected_image_asset_id || shot.reference_asset_ids[0]].filter(Boolean);
        await create({
          project_id: currentProjectId,
          shot_id: shot.id,
          provider,
          model,
          prompt,
          params,
          reference_asset_ids,
          max_retries: clampNumber(max_retries, 0, 5)
        });
      }

      setActiveTab("tasks");
      await refreshProjectData();
    });
  }

  async function handleCreateProject(event) {
    event.preventDefault();
    await runAction(async () => {
      const project = await api.createProject(projectForm);
      setProjectForm(EMPTY_PROJECT);
      setProjects([project, ...projects]);
      setSelectedProjectId(project.id);
      setActiveTab("shots");
    });
  }

  function startEditProject(project) {
    setEditingProjectId(project.id);
    setProjectEditForm({
      name: project.name,
      description: project.description || ""
    });
  }

  function cancelEditProject() {
    setEditingProjectId("");
    setProjectEditForm(EMPTY_PROJECT);
  }

  async function handleUpdateProject(event) {
    event.preventDefault();
    if (!editingProjectId) return;

    await runAction(async () => {
      const updatedProject = await api.updateProject(editingProjectId, projectEditForm);
      setProjects((items) => items.map((item) => (item.id === updatedProject.id ? updatedProject : item)));
      cancelEditProject();
    });
  }

  async function handleDeleteProject(project) {
    const confirmed = window.confirm(`确认删除项目“${project.name}”？项目下的分镜会一起删除。`);
    if (!confirmed) return;

    await runAction(async () => {
      await api.deleteProject(project.id);
      const nextProjects = projects.filter((item) => item.id !== project.id);
      setProjects(nextProjects);
      if (editingProjectId === project.id) {
        cancelEditProject();
      }
      if (currentProjectId === project.id) {
        const nextProjectId = nextProjects[0]?.id || "";
        setSelectedProjectId(nextProjectId);
        if (!nextProjectId) {
          setShots([]);
          setAssets([]);
          setTasks([]);
        }
      }
    });
  }

  async function handleCreateShot(event) {
    event.preventDefault();
    if (!currentProjectId) return;
    await runAction(async () => {
      await api.createShot({
        project_id: currentProjectId,
        title: shotForm.title,
        story: shotForm.story,
        characters: splitList(shotForm.characters),
        reference_asset_ids: shotForm.reference_asset_ids,
        image_prompt: shotForm.image_prompt,
        video_prompt: shotForm.video_prompt,
        status: shotForm.status,
        notes: shotForm.notes
      });
      setShotForm(EMPTY_SHOT);
      await refreshProjectData();
    });
  }

  function startEditShot(shot) {
    setEditingShotId(shot.id);
    setShotEditForm({
      title: shot.title,
      story: shot.story,
      characters: shot.characters.join(", "),
      reference_asset_ids: shot.reference_asset_ids,
      image_prompt: shot.image_prompt,
      video_prompt: shot.video_prompt,
      status: shot.status,
      notes: shot.notes || ""
    });
  }

  function cancelEditShot() {
    setEditingShotId("");
    setShotEditForm(EMPTY_SHOT);
  }

  async function handleUpdateShot(event) {
    event.preventDefault();
    if (!editingShotId) return;

    await runAction(async () => {
      await api.updateShot(editingShotId, {
        title: shotEditForm.title,
        story: shotEditForm.story,
        characters: splitList(shotEditForm.characters),
        reference_asset_ids: shotEditForm.reference_asset_ids,
        image_prompt: shotEditForm.image_prompt,
        video_prompt: shotEditForm.video_prompt,
        status: shotEditForm.status,
        notes: shotEditForm.notes
      });
      cancelEditShot();
      await refreshProjectData();
    });
  }

  async function handleUploadAsset(event) {
    event.preventDefault();
    if (!assetFile || !currentProjectId) return;
    await runAction(async () => {
      const formData = new FormData();
      formData.append("file", assetFile);
      formData.append("project_id", currentProjectId);
      if (assetName) formData.append("name", assetName);
      await api.uploadAsset(formData);
      setAssetFile(null);
      setAssetName("");
      event.target.reset();
      await refreshProjectData();
    });
  }

  async function handleCreateTemplate(event) {
    event.preventDefault();
    await runAction(async () => {
      const template = await api.createTemplate({
        name: templateForm.name,
        category: templateForm.category,
        content: templateForm.content,
        variables: splitList(templateForm.variables),
        notes: templateForm.notes
      });
      setTemplates([template, ...templates]);
      setTemplateForm(EMPTY_TEMPLATE);
    });
  }

  function startEditTemplate(template) {
    setEditingTemplateId(template.id);
    setTemplateEditForm({
      name: template.name,
      category: template.category,
      content: template.content,
      variables: template.variables.join(", "),
      notes: template.notes || ""
    });
  }

  function cancelEditTemplate() {
    setEditingTemplateId("");
    setTemplateEditForm(EMPTY_TEMPLATE);
  }

  async function handleUpdateTemplate(event) {
    event.preventDefault();
    if (!editingTemplateId) return;

    await runAction(async () => {
      const updatedTemplate = await api.updateTemplate(editingTemplateId, {
        name: templateEditForm.name,
        category: templateEditForm.category,
        content: templateEditForm.content,
        variables: splitList(templateEditForm.variables),
        notes: templateEditForm.notes
      });
      setTemplates((items) => items.map((item) => (item.id === updatedTemplate.id ? updatedTemplate : item)));
      cancelEditTemplate();
    });
  }

  async function handleDeleteTemplate(template) {
    const confirmed = window.confirm(`确认删除模板“${template.name}”？`);
    if (!confirmed) return;

    await runAction(async () => {
      await api.deleteTemplate(template.id);
      setTemplates((items) => items.filter((item) => item.id !== template.id));
      if (editingTemplateId === template.id) {
        cancelEditTemplate();
      }
    });
  }

  async function handleCreateTask(type) {
    if (!currentProjectId) return;
    await runAction(async () => {
      const prompt = type === "image" ? imagePrompt : videoPrompt;
      const providerInfo = type === "image"
        ? imageProviders.find((provider) => provider.id === imageProviderId) || imageProviders[0]
        : videoProviders.find((provider) => provider.id === videoProviderId) || videoProviders[0];
      const provider = providerInfo?.id || "mock";
      const model = type === "image"
        ? providerInfo?.image_model || "mock-image-v1"
        : providerInfo?.video_model || "mock-video-v1";
      const reference_asset_ids = type === "video"
        ? [referenceAssetId, endFrameAssetId].filter(Boolean)
        : [referenceAssetId].filter(Boolean);
      const params = type === "image" ? normalizedImageParams(imageParams) : normalizedVideoParams(videoParams);
      if (type === "video" && endFrameAssetId) {
        params.mode = "first_last_frame";
      }
      const max_retries = type === "image" ? Number(imageParams.max_retries) : Number(videoParams.max_retries);
      const create = type === "image" ? api.createImageTask : api.createVideoTask;
      await create({
        project_id: currentProjectId,
        provider,
        model,
        prompt,
        params,
        reference_asset_ids,
        max_retries: clampNumber(max_retries, 0, 5)
      });
      if (type === "image") setImagePrompt("");
      if (type === "video") setVideoPrompt("");
      setActiveTab("tasks");
      await refreshProjectData();
    });
  }

  async function handleCreateShotTask(shot, type) {
    await runAction(async () => {
      const prompt = type === "image" ? shot.image_prompt || shot.story : shot.video_prompt || shot.story;
      if (!prompt.trim()) {
        throw new Error(type === "image" ? "请先填写分镜生图提示词。" : "请先填写分镜生视频提示词。");
      }

      const providerInfo = type === "image"
        ? imageProviders.find((provider) => provider.id === imageProviderId) || imageProviders[0]
        : videoProviders.find((provider) => provider.id === videoProviderId) || videoProviders[0];
      const provider = providerInfo?.id || "mock";
      const model = type === "image"
        ? providerInfo?.image_model || "mock-image-v1"
        : providerInfo?.video_model || "mock-video-v1";
      const reference_asset_ids = type === "image"
        ? shot.reference_asset_ids
        : [shot.selected_image_asset_id || shot.reference_asset_ids[0]].filter(Boolean);
      const params = type === "image" ? normalizedImageParams(imageParams) : normalizedVideoParams(videoParams);
      const max_retries = type === "image" ? Number(imageParams.max_retries) : Number(videoParams.max_retries);
      const create = type === "image" ? api.createImageTask : api.createVideoTask;

      await create({
        project_id: currentProjectId,
        shot_id: shot.id,
        provider,
        model,
        prompt,
        params,
        reference_asset_ids,
        max_retries: clampNumber(max_retries, 0, 5)
      });
      setActiveTab("tasks");
      await refreshProjectData();
    });
  }

  async function handleSelectShotAsset(shot, asset, target) {
    await runAction(async () => {
      const payload = target === "image"
        ? { selected_image_asset_id: asset.id, status: "image_selected" }
        : { selected_video_asset_id: asset.id, status: "approved" };
      await api.updateShot(shot.id, payload);
      await api.updateAsset(asset.id, { is_selected: true });
      await refreshProjectData();
    });
  }

  async function handleSetShotStatus(shot, status) {
    await runAction(async () => {
      await api.updateShot(shot.id, { status });
      await refreshProjectData();
    });
  }

  async function handleRerunTask(task) {
    await runAction(async () => {
      const create = task.task_type === "image" ? api.createImageTask : api.createVideoTask;
      const createdTask = await create({
        project_id: task.project_id,
        shot_id: task.shot_id,
        provider: task.provider,
        model: task.model,
        prompt: task.prompt,
        params: task.params,
        reference_asset_ids: task.reference_asset_ids,
        max_retries: task.max_retries
      });
      setSelectedTaskId(createdTask.id);
      setActiveTab("tasks");
      await refreshProjectData();
    });
  }

  async function handleSaveTaskAsTemplate(task) {
    await runAction(async () => {
      const template = await api.createTemplate({
        name: `${task.task_type === "image" ? "生图" : "生视频"}任务模板`,
        category: task.task_type,
        content: task.prompt,
        variables: [],
        notes: `由任务 ${task.id} 保存，provider=${task.provider}, model=${task.model}`
      });
      setTemplates([template, ...templates]);
      setActiveTab("templates");
    });
  }

  function startApplyTemplate(template) {
    const variables = getTemplateVariables(template);
    setTemplateApplyId(template.id);
    setTemplateVariableValues(Object.fromEntries(variables.map((variable) => [variable, ""])));
  }

  function applyTemplate(template, target, values = {}) {
    const content = renderTemplate(template.content, values);
    if (target === "image") {
      setImagePrompt(content);
      setActiveTab("image-gen");
    } else {
      setVideoPrompt(content);
      setActiveTab("video-gen");
    }
  }

  return (
    <div className="console-shell">
      <aside className="console-sidebar">
        <div className="brand brand-console">
          <div className="brand-mark brand-mark-console">F</div>
          <div>
            <h1>FrameAI</h1>
            <p>Production Console</p>
          </div>
        </div>

        <nav className="nav-list nav-console" aria-label="主导航">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group}>
              <div className="sidebar-section-label">{group}</div>
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={activeTab === item.id ? "active nav-item-console" : "nav-item-console"}
                  onClick={() => setActiveTab(item.id)}
                >
                  <span>{item.label}</span>
                  {item.hint ? <small>{item.hint}</small> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer-card">
          <span className="sidebar-footer-label">Provider</span>
          <strong>{providers.length || 0} 已加载</strong>
          <p>{runtime?.storage_dir ? "本地工作流已连接" : "等待运行环境"}</p>
          <button type="button" onClick={() => setActiveTab("settings")}>查看设置</button>
        </div>
      </aside>

      <main className="console-main">
        <header className="console-topbar">
          <div className="topbar-search">
            <input
              value=""
              readOnly
              aria-label="搜索占位"
              placeholder="搜索项目、分镜、素材、任务..."
            />
            <span>CMD+K</span>
          </div>

          <div className="topbar-actions">
            <div className="topbar-project">
              <span className="eyebrow">当前项目</span>
              <h2>{selectedProject?.name || "未创建项目"}</h2>
            </div>
            <select
              className="project-switcher"
              value={currentProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              aria-label="选择项目"
            >
              {projects.length === 0 ? <option value="">暂无项目</option> : null}
              {projects.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button className="guide-next-button" type="button" onClick={() => navigateToGuideStep(currentGuideStep)}>
              下一步：{currentGuideStep?.title || "查看向导"}
            </button>
            <button className="ghost" type="button" onClick={() => setActiveTab("tasks")}>
              任务队列
            </button>
            <button className="primary" type="button" onClick={() => setActiveTab("image-gen")}>
              快速生成
            </button>
          </div>
        </header>

        <section className="console-content">
        {error ? <div className="notice error">{error}</div> : null}
        {isLoading ? <div className="notice">正在连接本地后端...</div> : null}

        {activeTab === "overview" && (
          <OverviewPage
            project={selectedProject}
            projects={projects}
            shots={projectShots}
            assets={projectAssets}
            tasks={projectTasks}
            logs={projectLogs}
            runningTasks={runningTasks}
            selectedAssetsCount={selectedAssetsCount}
            guideSteps={guideSteps}
            currentStep={currentGuideStep}
            onOpenProjects={() => setActiveTab("projects")}
            onOpenShots={() => setActiveTab("shots")}
            onOpenGenerate={() => setActiveTab("image-gen")}
            onOpenTasks={() => setActiveTab("tasks")}
            onOpenGuide={() => setActiveTab("guide")}
          />
        )}

        {activeTab === "guide" && (
          <GuidePage
            steps={guideSteps}
            currentStep={currentGuideStep}
            onNavigate={navigateToGuideStep}
          />
        )}

        {activeTab === "project-detail" && (
          <ProjectDetailPage
            project={selectedProject}
            shots={projectShots}
            assets={projectAssets}
            tasks={projectTasks}
            logs={projectLogs}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === "development" && (
          <DevelopmentPage
            workspace={developmentWorkspace}
            view={developmentView}
            project={selectedProject}
            onViewChange={setDevelopmentView}
            onFieldChange={updateDevelopmentField}
            onListItemChange={updateDevelopmentListItem}
            onAddListItem={addDevelopmentListItem}
            onRemoveListItem={removeDevelopmentListItem}
            onChecklistChange={(key, checked) => {
              setDevelopmentWorkspace((workspace) => ({
                ...workspace,
                checklist: { ...workspace.checklist, [key]: checked }
              }));
            }}
            onBuildShotDrafts={handleBuildShotDrafts}
            onImportShotDrafts={handleImportShotDrafts}
            onSavePromptTemplates={handleSaveDevelopmentTemplates}
            onQualityCheckChange={updateQualityCheck}
            onPublishPlanChange={updatePublishPlan}
          />
        )}

        {activeTab === "projects" && (
          <section className="page-grid">
            <Panel title="新建项目" subtitle="每个视频或漫剧一个项目，后续素材、分镜和生成任务都挂在项目下。">
              <form className="stack" onSubmit={handleCreateProject}>
                <label>
                  项目名称
                  <input value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} required />
                </label>
                <label>
                  项目说明
                  <textarea value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} rows={4} />
                </label>
                <button className="primary" type="submit">创建项目</button>
              </form>

              {editingProjectId ? (
                <form className="stack edit-form" onSubmit={handleUpdateProject}>
                  <div className="panel-heading compact-heading">
                    <h2>编辑项目</h2>
                    <p>修改当前项目名称、说明和工作状态。</p>
                  </div>
                  <label>
                    项目名称
                    <input
                      value={projectEditForm.name}
                      onChange={(event) => setProjectEditForm({ ...projectEditForm, name: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    项目说明
                    <textarea
                      value={projectEditForm.description}
                      onChange={(event) => setProjectEditForm({ ...projectEditForm, description: event.target.value })}
                      rows={4}
                    />
                  </label>
                  <div className="button-row">
                    <button className="primary" type="submit">保存修改</button>
                    <button type="button" onClick={cancelEditProject}>取消</button>
                  </div>
                </form>
              ) : null}
            </Panel>
            <Panel title="项目列表">
              <div className="metric-grid">
                <Metric label="项目" value={projects.length} />
                <Metric label="进行中" value={projects.filter((project) => project.status === "active").length} />
                <Metric label="分镜" value={projectShots.length} />
                <Metric label="素材" value={projectAssets.length} />
                <Metric label="任务" value={projectTasks.length} />
              </div>
              <div className="search-filter-bar">
                <label>
                  搜索项目
                  <input
                    value={projectSearch}
                    onChange={(event) => setProjectSearch(event.target.value)}
                    placeholder="项目名称、说明"
                  />
                </label>
                <label>
                  状态
                  <select value={projectStatusFilter} onChange={(event) => setProjectStatusFilter(event.target.value)}>
                    <option value="all">全部状态</option>
                    <option value="active">进行中</option>
                    <option value="paused">已暂停</option>
                    <option value="completed">已完成</option>
                  </select>
                </label>
              </div>
              <div className="list">
                {visibleProjects.map((project) => (
                  <article className={`project-item ${project.id === currentProjectId ? "selected" : ""}`} key={project.id}>
                    <button className="row-button" type="button" onClick={() => setSelectedProjectId(project.id)}>
                      <strong>{project.name}</strong>
                      <span>{project.description || "未填写说明"}</span>
                      <span className={`status ${project.status}`}>{project.status}</span>
                    </button>
                    <div className="project-actions">
                      <button type="button" onClick={() => {
                        setSelectedProjectId(project.id);
                        setActiveTab("project-detail");
                      }}>详情</button>
                      <button type="button" onClick={() => startEditProject(project)}>编辑</button>
                      <button className="danger" type="button" onClick={() => handleDeleteProject(project)}>删除</button>
                    </div>
                  </article>
                ))}
                {!visibleProjects.length ? <div className="empty-state">没有匹配的项目。</div> : null}
              </div>
            </Panel>
          </section>
        )}

        {activeTab === "shots" && (
          <section className="page-grid wide-left">
            <Panel title="分镜编辑" subtitle="分镜是后续生图、生视频和结果筛选的主线。">
              <RequireProject project={selectedProject}>
                <form className="stack" onSubmit={handleCreateShot}>
                  <label>
                    镜头标题
                    <input value={shotForm.title} onChange={(event) => setShotForm({ ...shotForm, title: event.target.value })} />
                  </label>
                  <label>
                    剧情描述
                    <textarea value={shotForm.story} onChange={(event) => setShotForm({ ...shotForm, story: event.target.value })} rows={4} />
                  </label>
                  <label>
                    角色
                    <input value={shotForm.characters} onChange={(event) => setShotForm({ ...shotForm, characters: event.target.value })} placeholder="多个角色用逗号分隔" />
                  </label>
                  <ReferenceAssetPicker
                    assets={imageAssets}
                    selectedIds={shotForm.reference_asset_ids}
                    onChange={(reference_asset_ids) => setShotForm({ ...shotForm, reference_asset_ids })}
                  />
                  <label>
                    生图提示词
                    <textarea value={shotForm.image_prompt} onChange={(event) => setShotForm({ ...shotForm, image_prompt: event.target.value })} rows={4} />
                  </label>
                  <label>
                    生视频提示词
                    <textarea value={shotForm.video_prompt} onChange={(event) => setShotForm({ ...shotForm, video_prompt: event.target.value })} rows={4} />
                  </label>
                  <button className="primary" type="submit">保存分镜</button>
                </form>

                {editingShotId ? (
                  <form className="stack edit-form" onSubmit={handleUpdateShot}>
                    <div className="panel-heading compact-heading">
                      <h2>编辑分镜</h2>
                      <p>调整剧情、参考素材、提示词和当前状态。</p>
                    </div>
                    <label>
                      镜头标题
                      <input value={shotEditForm.title} onChange={(event) => setShotEditForm({ ...shotEditForm, title: event.target.value })} />
                    </label>
                    <label>
                      剧情描述
                      <textarea value={shotEditForm.story} onChange={(event) => setShotEditForm({ ...shotEditForm, story: event.target.value })} rows={4} />
                    </label>
                    <label>
                      角色
                      <input value={shotEditForm.characters} onChange={(event) => setShotEditForm({ ...shotEditForm, characters: event.target.value })} placeholder="多个角色用逗号分隔" />
                    </label>
                    <ReferenceAssetPicker
                      assets={imageAssets}
                      selectedIds={shotEditForm.reference_asset_ids}
                      onChange={(reference_asset_ids) => setShotEditForm({ ...shotEditForm, reference_asset_ids })}
                    />
                    <label>
                      生图提示词
                      <textarea value={shotEditForm.image_prompt} onChange={(event) => setShotEditForm({ ...shotEditForm, image_prompt: event.target.value })} rows={4} />
                    </label>
                    <label>
                      生视频提示词
                      <textarea value={shotEditForm.video_prompt} onChange={(event) => setShotEditForm({ ...shotEditForm, video_prompt: event.target.value })} rows={4} />
                    </label>
                    <label>
                      状态
                      <select value={shotEditForm.status} onChange={(event) => setShotEditForm({ ...shotEditForm, status: event.target.value })}>
                        <option value="draft">草稿</option>
                        <option value="image_selected">已选图</option>
                        <option value="approved">已通过</option>
                        <option value="rejected">已废弃</option>
                      </select>
                    </label>
                    <label>
                      备注
                      <textarea value={shotEditForm.notes} onChange={(event) => setShotEditForm({ ...shotEditForm, notes: event.target.value })} rows={3} />
                    </label>
                    <div className="button-row">
                      <button className="primary" type="submit">保存修改</button>
                      <button type="button" onClick={cancelEditShot}>取消</button>
                    </div>
                  </form>
                ) : null}
              </RequireProject>
            </Panel>
            <Panel title="分镜工作台" subtitle="左侧维护分镜，右侧聚焦当前镜头、提示词和生成结果。">
              <RequireProject project={selectedProject}>
                <div className="batch-action-bar">
                  <div>
                    <strong>批量生产</strong>
                    <p>按当前分镜提示词批量创建任务，适合 SOP 里的“按分镜表逐格出图”。</p>
                  </div>
                  <div className="button-row">
                    <button type="button" onClick={() => handleCreateBatchShotTasks("image")}>批量生图</button>
                    <button type="button" onClick={() => handleCreateBatchShotTasks("video")}>批量生视频</button>
                  </div>
                </div>
                <ShotFocus
                  shot={selectedShot}
                  assets={projectAssets}
                  panel={shotPanel}
                  onPanelChange={setShotPanel}
                  onCreateImage={() => selectedShot ? handleCreateShotTask(selectedShot, "image") : undefined}
                  onCreateVideo={() => selectedShot ? handleCreateShotTask(selectedShot, "video") : undefined}
                  onSetStatus={(status) => selectedShot ? handleSetShotStatus(selectedShot, status) : undefined}
                  onSelectImage={(asset) => selectedShot ? handleSelectShotAsset(selectedShot, asset, "image") : undefined}
                  onSelectVideo={(asset) => selectedShot ? handleSelectShotAsset(selectedShot, asset, "video") : undefined}
                />
              </RequireProject>
              <div className="shot-list">
                {projectShots.map((shot) => (
                  <ShotCard
                    key={shot.id}
                    shot={shot}
                    assets={projectAssets}
                    isSelected={shot.id === selectedShot?.id}
                    onOpen={() => setSelectedShotId(shot.id)}
                    onEdit={startEditShot}
                    onCreateImage={() => handleCreateShotTask(shot, "image")}
                    onCreateVideo={() => handleCreateShotTask(shot, "video")}
                    onSelectImage={(asset) => handleSelectShotAsset(shot, asset, "image")}
                    onSelectVideo={(asset) => handleSelectShotAsset(shot, asset, "video")}
                    onSetStatus={(status) => handleSetShotStatus(shot, status)}
                  />
                ))}
              </div>
            </Panel>
          </section>
        )}

        {activeTab === "assets" && (
          <section className="page-grid">
            <Panel title="上传素材" subtitle="角色图、场景图、参考图和成片都先进入素材库。">
              <RequireProject project={selectedProject}>
                <form className="stack" onSubmit={handleUploadAsset}>
                  <label>
                    素材名称
                    <input value={assetName} onChange={(event) => setAssetName(event.target.value)} placeholder="默认使用文件名" />
                  </label>
                  <label>
                    文件
                    <input type="file" onChange={(event) => setAssetFile(event.target.files?.[0] || null)} required />
                  </label>
                  <button className="primary" type="submit">上传素材</button>
                </form>
                <AssetDetail asset={selectedAsset} assets={projectAssets} tasks={projectTasks} onRerunTask={handleRerunTask} />
              </RequireProject>
            </Panel>
            <Panel title="素材库" subtitle="按类型、评审状态和关键词筛选素材，可切换网格或列表视图。">
              <div className="toolbar asset-toolbar">
                <label>
                  搜索素材
                  <input
                    value={assetSearch}
                    onChange={(event) => setAssetSearch(event.target.value)}
                    placeholder="素材名称、提示词、模型"
                  />
                </label>
                <label>
                  素材类型
                  <select value={assetTypeFilter} onChange={(event) => setAssetTypeFilter(event.target.value)}>
                    <option value="all">全部</option>
                    <option value="image">图片</option>
                    <option value="video">视频</option>
                    <option value="audio">音频</option>
                    <option value="document">文档</option>
                    <option value="other">其他</option>
                  </select>
                </label>
                <label>
                  评审状态
                  <select value={assetReviewFilter} onChange={(event) => setAssetReviewFilter(event.target.value)}>
                    <option value="all">全部评审</option>
                    <option value="unreviewed">未评审</option>
                    <option value="liked">喜欢</option>
                    <option value="disliked">不喜欢</option>
                    <option value="discarded">废弃</option>
                  </select>
                </label>
                <div className="segmented-control" aria-label="素材视图">
                  <button
                    className={assetView === "grid" ? "active" : ""}
                    type="button"
                    onClick={() => setAssetView("grid")}
                  >
                    网格
                  </button>
                  <button
                    className={assetView === "list" ? "active" : ""}
                    type="button"
                    onClick={() => setAssetView("list")}
                  >
                    列表
                  </button>
                </div>
              </div>
              <AssetGrid
                assets={visibleAssets}
                view={assetView}
                selectedAssetId={selectedAssetId}
                onOpen={(asset) => setSelectedAssetId(asset.id)}
                onSelect={(asset) => runAction(async () => {
                  await api.updateAsset(asset.id, { is_selected: !asset.is_selected });
                  await refreshProjectData();
                })}
                onReview={(asset, review_status) => runAction(async () => {
                  await api.updateAsset(asset.id, {
                    review_status,
                    is_selected: review_status === "liked" ? true : asset.is_selected
                  });
                  await refreshProjectData();
                })}
              />
            </Panel>
          </section>
        )}

        {activeTab === "templates" && (
          <section className="page-grid">
            <Panel title="新增提示词模板">
              <form className="stack" onSubmit={handleCreateTemplate}>
                <label>
                  模板名称
                  <input value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} required />
                </label>
                <label>
                  分类
                  <select value={templateForm.category} onChange={(event) => setTemplateForm({ ...templateForm, category: event.target.value })}>
                    <option value="image">生图</option>
                    <option value="video">生视频</option>
                    <option value="character">角色</option>
                    <option value="scene">场景</option>
                    <option value="general">通用</option>
                  </select>
                </label>
                <label>
                  模板内容
                  <textarea value={templateForm.content} onChange={(event) => setTemplateForm({ ...templateForm, content: event.target.value })} rows={6} required />
                </label>
                <label>
                  变量
                  <input value={templateForm.variables} onChange={(event) => setTemplateForm({ ...templateForm, variables: event.target.value })} placeholder="character_name, style" />
                </label>
                <button className="primary" type="submit">保存模板</button>
              </form>

              {editingTemplateId ? (
                <form className="stack edit-form" onSubmit={handleUpdateTemplate}>
                  <div className="panel-heading compact-heading">
                    <h2>编辑模板</h2>
                    <p>更新模板内容后，后续套用会使用新的提示词。</p>
                  </div>
                  <label>
                    模板名称
                    <input
                      value={templateEditForm.name}
                      onChange={(event) => setTemplateEditForm({ ...templateEditForm, name: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    分类
                    <select
                      value={templateEditForm.category}
                      onChange={(event) => setTemplateEditForm({ ...templateEditForm, category: event.target.value })}
                    >
                      <option value="image">生图</option>
                      <option value="video">生视频</option>
                      <option value="character">角色</option>
                      <option value="scene">场景</option>
                      <option value="general">通用</option>
                    </select>
                  </label>
                  <label>
                    模板内容
                    <textarea
                      value={templateEditForm.content}
                      onChange={(event) => setTemplateEditForm({ ...templateEditForm, content: event.target.value })}
                      rows={6}
                      required
                    />
                  </label>
                  <label>
                    变量
                    <input
                      value={templateEditForm.variables}
                      onChange={(event) => setTemplateEditForm({ ...templateEditForm, variables: event.target.value })}
                      placeholder="character_name, style"
                    />
                  </label>
                  <div className="button-row">
                    <button className="primary" type="submit">保存修改</button>
                    <button type="button" onClick={cancelEditTemplate}>取消</button>
                  </div>
                </form>
              ) : null}
            </Panel>
            <Panel title="模板库" subtitle="原型里的模板分类和变量填写保留在这里，可直接套到生图或生视频中心。">
              <div className="segmented-control template-filter" aria-label="模板分类">
                {[
                  ["all", "全部"],
                  ["image", "生图"],
                  ["video", "视频"],
                  ["character", "角色"],
                  ["scene", "场景"],
                  ["general", "通用"]
                ].map(([value, label]) => (
                  <button
                    className={templateCategoryFilter === value ? "active" : ""}
                    type="button"
                    key={value}
                    onClick={() => setTemplateCategoryFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="template-list">
                {filteredTemplates.map((template) => (
                  <article className="template-item" key={template.id}>
                    <div className="item-heading">
                      <strong>{template.name}</strong>
                      <span className="tag">{template.category}</span>
                    </div>
                    <p>{template.content}</p>
                    <div className="button-row">
                      <button type="button" onClick={() => applyTemplate(template, "image")}>套到生图</button>
                      <button type="button" onClick={() => applyTemplate(template, "video")}>套到视频</button>
                      <button type="button" onClick={() => startApplyTemplate(template)}>填写变量</button>
                      <button type="button" onClick={() => startEditTemplate(template)}>编辑</button>
                      <button className="danger" type="button" onClick={() => handleDeleteTemplate(template)}>删除</button>
                    </div>
                    {templateApplyId === template.id ? (
                      <div className="variable-editor">
                        {getTemplateVariables(template).length ? (
                          getTemplateVariables(template).map((variable) => (
                            <label key={variable}>
                              {variable}
                              <input
                                value={templateVariableValues[variable] || ""}
                                onChange={(event) => setTemplateVariableValues({
                                  ...templateVariableValues,
                                  [variable]: event.target.value
                                })}
                              />
                            </label>
                          ))
                        ) : (
                          <p>这个模板没有变量。</p>
                        )}
                        <pre>{renderTemplate(template.content, templateVariableValues)}</pre>
                        <div className="button-row">
                          <button type="button" onClick={() => applyTemplate(template, "image", templateVariableValues)}>套到生图</button>
                          <button type="button" onClick={() => applyTemplate(template, "video", templateVariableValues)}>套到视频</button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
                {!filteredTemplates.length ? <div className="empty-state">这个分类下还没有模板。</div> : null}
              </div>
            </Panel>
          </section>
        )}

        {activeTab === "image-gen" && (
          <section className="generation-layout">
            <Panel title="生图中心" subtitle="选择模型、画幅、参考图和高级参数，生成结果会自动进入当前项目素材库。">
              <RequireProject project={selectedProject}>
                <div className="stack">
                  <label>
                    Provider
                    <select value={imageProviderId} onChange={(event) => setImageProviderId(event.target.value)}>
                      {imageProviders.map((provider) => (
                        <option value={provider.id} key={provider.id}>
                          {provider.name}{provider.configured ? "" : "（未配置）"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    提示词
                    <textarea value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} rows={8} />
                  </label>
                  <label>
                    参考图
                    <select value={referenceAssetId} onChange={(event) => setReferenceAssetId(event.target.value)}>
                      <option value="">不使用参考图</option>
                      {imageAssets.map((asset) => (
                        <option value={asset.id} key={asset.id}>{asset.name}</option>
                      ))}
                    </select>
                  </label>
                  <div className="field-grid">
                    <label>
                      数量
                      <input type="number" min="1" max="8" value={imageParams.count} onChange={(event) => setImageParams({ ...imageParams, count: event.target.value })} />
                    </label>
                    <label>
                      比例
                      <select value={imageParams.aspect_ratio} onChange={(event) => setImageParams({ ...imageParams, aspect_ratio: event.target.value })}>
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16</option>
                        <option value="1:1">1:1</option>
                        <option value="4:3">4:3</option>
                      </select>
                    </label>
                    <label>
                      清晰度
                      <select value={imageParams.resolution} onChange={(event) => setImageParams({ ...imageParams, resolution: event.target.value })}>
                        <option value="1280x720">1280x720</option>
                        <option value="1920x1080">1920x1080</option>
                        <option value="1024x1024">1024x1024</option>
                      </select>
                    </label>
                    <label>
                      重试
                      <input type="number" min="0" max="5" value={imageParams.max_retries} onChange={(event) => setImageParams({ ...imageParams, max_retries: event.target.value })} />
                    </label>
                  </div>
                  <button className="inline-disclosure" type="button" onClick={() => setShowImageAdvanced(!showImageAdvanced)}>
                    {showImageAdvanced ? "收起高级参数" : "展开高级参数"}
                  </button>
                  {showImageAdvanced ? (
                    <div className="field-grid">
                      <label>
                        引导强度
                        <input type="number" min="1" max="20" value={imageParams.guidance} onChange={(event) => setImageParams({ ...imageParams, guidance: event.target.value })} />
                      </label>
                      <label>
                        负向提示词
                        <input value={imageParams.negative_prompt} onChange={(event) => setImageParams({ ...imageParams, negative_prompt: event.target.value })} placeholder="blurry, low quality" />
                      </label>
                    </div>
                  ) : null}
                  <button className="primary" type="button" disabled={!imagePrompt} onClick={() => handleCreateTask("image")}>创建生图任务</button>
                </div>
              </RequireProject>
            </Panel>
            <Panel title="图片结果与模板">
              <GenerationSidePanel
                type="image"
                assets={projectAssets}
                tasks={projectTasks}
                templates={templates}
                onUseTemplate={(template) => applyTemplate(template, "image")}
                onOpenTasks={() => setActiveTab("tasks")}
              />
            </Panel>
          </section>
        )}

        {activeTab === "video-gen" && (
          <section className="generation-layout">
            <Panel title="生视频中心" subtitle="支持文生视频、图生视频和首尾帧视频，参数会保存进任务记录。">
              <RequireProject project={selectedProject}>
                <div className="stack">
                  <label>
                    Provider
                    <select value={videoProviderId} onChange={(event) => setVideoProviderId(event.target.value)}>
                      {videoProviders.map((provider) => (
                        <option value={provider.id} key={provider.id}>
                          {provider.name}{provider.configured ? "" : "（未配置）"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    起始帧素材
                    <select value={referenceAssetId} onChange={(event) => setReferenceAssetId(event.target.value)}>
                      <option value="">不使用起始帧</option>
                      {imageAssets.map((asset) => (
                        <option value={asset.id} key={asset.id}>{asset.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    结束帧素材
                    <select value={endFrameAssetId} onChange={(event) => setEndFrameAssetId(event.target.value)}>
                      <option value="">不使用结束帧</option>
                      {imageAssets.map((asset) => (
                        <option value={asset.id} key={asset.id}>{asset.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    视频提示词
                    <textarea value={videoPrompt} onChange={(event) => setVideoPrompt(event.target.value)} rows={8} />
                  </label>
                  <div className="field-grid">
                    <label>
                      数量
                      <input type="number" min="1" max="4" value={videoParams.count} onChange={(event) => setVideoParams({ ...videoParams, count: event.target.value })} />
                    </label>
                    <label>
                      时长
                      <input type="number" min="1" max="20" value={videoParams.duration} onChange={(event) => setVideoParams({ ...videoParams, duration: event.target.value })} />
                    </label>
                    <label>
                      运动幅度
                      <select value={videoParams.motion} onChange={(event) => setVideoParams({ ...videoParams, motion: event.target.value })}>
                        <option value="low">低</option>
                        <option value="medium">中</option>
                        <option value="high">高</option>
                      </select>
                    </label>
                    <label>
                      镜头运动
                      <select value={videoParams.camera_move} onChange={(event) => setVideoParams({ ...videoParams, camera_move: event.target.value })}>
                        <option value="static">固定</option>
                        <option value="push_in">推进</option>
                        <option value="pull_out">拉远</option>
                        <option value="pan_left">左摇</option>
                        <option value="pan_right">右摇</option>
                      </select>
                    </label>
                    <label>
                      重试
                      <input type="number" min="0" max="5" value={videoParams.max_retries} onChange={(event) => setVideoParams({ ...videoParams, max_retries: event.target.value })} />
                    </label>
                  </div>
                  <button className="inline-disclosure" type="button" onClick={() => setShowVideoAdvanced(!showVideoAdvanced)}>
                    {showVideoAdvanced ? "收起高级参数" : "展开高级参数"}
                  </button>
                  {showVideoAdvanced ? (
                    <div className="field-grid">
                      <label>
                        随机种子
                        <input value={videoParams.seed} onChange={(event) => setVideoParams({ ...videoParams, seed: event.target.value })} placeholder="可留空" />
                      </label>
                      <label>
                        生成模式
                        <select
                          value={endFrameAssetId ? "first_last_frame" : referenceAssetId ? "image_to_video" : "text_to_video"}
                          onChange={(event) => {
                            if (event.target.value === "text_to_video") {
                              setReferenceAssetId("");
                              setEndFrameAssetId("");
                            }
                          }}
                        >
                          <option value="text_to_video">文生视频</option>
                          <option value="image_to_video">图生视频</option>
                          <option value="first_last_frame">首尾帧视频</option>
                        </select>
                      </label>
                    </div>
                  ) : null}
                  <button className="primary" type="button" disabled={!videoPrompt} onClick={() => handleCreateTask("video")}>创建生视频任务</button>
                </div>
              </RequireProject>
            </Panel>
            <Panel title="视频队列与结果">
              <GenerationSidePanel
                type="video"
                assets={projectAssets}
                tasks={projectTasks}
                templates={templates}
                onUseTemplate={(template) => applyTemplate(template, "video")}
                onOpenTasks={() => setActiveTab("tasks")}
              />
            </Panel>
          </section>
        )}

        {activeTab === "tasks" && (
          <section className="page-grid">
            <Panel title="任务记录" subtitle="后台 worker 会轮询 pending 任务，并将 mock 结果写回素材库。">
              <div className="task-table">
                {projectTasks.map((task) => (
                  <article className={`task-row ${task.id === selectedTask?.id ? "selected" : ""}`} key={task.id}>
                    <div>
                      <span className={`status ${task.status}`}>{task.status}</span>
                      <strong>{task.task_type === "image" ? "生图" : "生视频"} · {task.model}</strong>
                      <p>{task.prompt}</p>
                    </div>
                    <div className="task-meta">
                      <span>尝试 {task.attempts}/{task.max_retries + 1}</span>
                      <span>结果 {task.result_asset_ids.length}</span>
                      <button type="button" onClick={() => setSelectedTaskId(task.id)}>详情</button>
                      {["pending", "running"].includes(task.status) ? (
                        <button className="danger" type="button" onClick={() => runAction(async () => {
                          await api.cancelTask(task.id);
                          await refreshProjectData();
                        })}>取消</button>
                      ) : null}
                      {task.status === "failed" ? <button type="button" onClick={() => runAction(async () => {
                        await api.retryTask(task.id);
                        await refreshProjectData();
                      })}>重试</button> : null}
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
            <Panel title="任务详情">
              <TaskDetail
                task={selectedTask}
                logs={taskLogs}
                assets={projectAssets}
                onRerunTask={handleRerunTask}
                onSaveTemplate={handleSaveTaskAsTemplate}
              />
            </Panel>
          </section>
        )}

        {activeTab === "logs" && (
          <Panel title="成本和日志" subtitle="先按本地任务和 API 调用日志做基础统计，真实成本接平台后再替换估算。">
            <LogDashboard tasks={projectTasks} logs={projectLogs} />
          </Panel>
        )}

        {activeTab === "settings" && (
          <section className="page-grid">
            <Panel title="Provider" subtitle="集中查看图片、视频供应商配置状态。">
              <div className="template-list">
                {providers.map((provider) => (
                  <article className="template-item" key={provider.id}>
                    <div className="item-heading">
                      <strong>{provider.name}</strong>
                      <span className={`tag ${provider.configured ? "" : "warning-tag"}`}>{provider.configured ? "已配置" : "未配置"}</span>
                    </div>
                    <p>{provider.description}</p>
                    <p>生图模型：{provider.image_model}</p>
                    <p>生视频模型：{provider.video_model}</p>
                  </article>
                ))}
                {!providers.length ? <div className="empty-state">还没有加载到 Provider。</div> : null}
              </div>
            </Panel>
            <Panel title="默认设置与运行路径">
              <div className="stack">
                <dl className="runtime-list">
                  <dt>数据库</dt>
                  <dd>{runtime?.database_path}</dd>
                  <dt>文件存储</dt>
                  <dd>{runtime?.storage_dir}</dd>
                </dl>
                <div className="field-grid">
                  <label>
                    默认图片比例
                    <input value={imageParams.aspect_ratio} readOnly />
                  </label>
                  <label>
                    默认视频时长
                    <input value={`${videoParams.duration}s`} readOnly />
                  </label>
                  <label>
                    图片重试
                    <input value={imageParams.max_retries} readOnly />
                  </label>
                  <label>
                    视频重试
                    <input value={videoParams.max_retries} readOnly />
                  </label>
                </div>
                <div className="notice compact-notice">额度与成本控制已接入日志统计视图；真实预算阈值可在后端 Provider 配置完善后启用。</div>
              </div>
            </Panel>
          </section>
        )}
        </section>
      </main>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function OverviewPage({
  project,
  projects,
  shots,
  assets,
  tasks,
  logs,
  runningTasks,
  selectedAssetsCount,
  guideSteps,
  currentStep,
  onOpenProjects,
  onOpenShots,
  onOpenGenerate,
  onOpenTasks,
  onOpenGuide
}) {
  const latestProjects = projects.slice(0, 3);
  const latestTasks = tasks.slice(0, 4);
  const latestLogs = logs.slice(0, 4);
  const successCount = tasks.filter((task) => task.status === "succeeded").length;
  const failedCount = tasks.filter((task) => task.status === "failed").length;

  return (
    <section className="overview-stack">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">FrameAI Overview</span>
          <h2>{project?.name || "欢迎进入 FrameAI"}</h2>
          <p>
            这是你的 AI 视频生产控制台。用一个首页总览项目、分镜、素材和任务状态，
            然后通过工作台继续推进生图、生视频和结果筛选。
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary" type="button" onClick={onOpenProjects}>新建或切换项目</button>
          <button className="ghost" type="button" onClick={onOpenGuide}>查看生产向导</button>
          <button className="ghost" type="button" onClick={onOpenGenerate}>进入生成中心</button>
        </div>
      </section>

      <section className="metric-strip">
        <Metric label="项目总数" value={projects.length} />
        <Metric label="当前分镜" value={shots.length} />
        <Metric label="素材规模" value={assets.length} />
        <Metric label="运行中任务" value={runningTasks.length} />
        <Metric label="已入选素材" value={selectedAssetsCount} />
        <Metric label="成功任务" value={successCount} />
      </section>

      <GuideSummary steps={guideSteps} currentStep={currentStep} onOpenGuide={onOpenGuide} />

      <section className="workflow-strip" aria-label="制作流程">
        {[
          ["项目", projects.length],
          ["分镜", shots.length],
          ["提示词", "模板"],
          ["生图", tasks.filter((task) => task.task_type === "image").length],
          ["生视频", tasks.filter((task) => task.task_type === "video").length],
          ["评审入库", selectedAssetsCount]
        ].map(([label, value]) => (
          <div className="workflow-step" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className="overview-grid">
        <Panel title="当前项目" subtitle="把今天要推进的内容先聚焦在一个项目上。">
          <div className="overview-card-block">
            <div className="overview-project-head">
              <div>
                <strong>{project?.name || "暂无项目"}</strong>
                <p>{project?.description || "创建一个项目后，分镜、素材、任务都会挂在这里。"}</p>
              </div>
              <span className="status running">{project ? "active" : "idle"}</span>
            </div>
            <div className="quick-action-grid">
              <button type="button" onClick={onOpenShots}>进入分镜工作台</button>
              <button type="button" onClick={onOpenGenerate}>创建生成任务</button>
              <button type="button" onClick={onOpenTasks}>查看任务队列</button>
              <button type="button" onClick={onOpenProjects}>管理项目</button>
            </div>
          </div>
        </Panel>

        <Panel title="活跃队列" subtitle="优先关注正在运行和待处理的任务。">
          <div className="overview-list">
            {runningTasks.length ? (
              runningTasks.slice(0, 4).map((task) => (
                <article className="overview-list-item" key={task.id}>
                  <div>
                    <strong>{task.task_type === "image" ? "生图" : "生视频"} · {task.model}</strong>
                    <p>{task.prompt}</p>
                  </div>
                  <span className={`status ${task.status}`}>{task.status}</span>
                </article>
              ))
            ) : (
              <div className="empty-state">当前没有运行中的任务，可以从生成中心发起新的任务。</div>
            )}
          </div>
        </Panel>
      </section>

      <section className="overview-grid">
        <Panel title="最近项目" subtitle="快速回到最近在推进的工作。">
          <div className="project-overview-grid">
            {latestProjects.length ? latestProjects.map((item) => (
              <article className="project-overview-card" key={item.id}>
                <div className="project-overview-meta">
                  <span className="tag">Project</span>
                  <strong>{item.name}</strong>
                </div>
                <p>{item.description || "未填写项目说明"}</p>
              </article>
            )) : <div className="empty-state">还没有项目，先创建一个试试。</div>}
          </div>
        </Panel>

        <Panel title="最近任务与日志" subtitle="从结果和日志快速判断今天的系统状态。">
          <div className="overview-feed">
            {latestTasks.length ? latestTasks.map((task) => (
              <article className="overview-feed-item" key={task.id}>
                <span className={`status ${task.status}`}>{task.status}</span>
                <div>
                  <strong>{task.task_type === "image" ? "生图任务" : "生视频任务"}</strong>
                  <p>{task.model}</p>
                </div>
              </article>
            )) : null}
            {latestLogs.length ? latestLogs.map((log) => (
              <article className="overview-feed-item" key={log.id}>
                <span className={`status ${log.status}`}>{log.status}</span>
                <div>
                  <strong>{log.model || "调用日志"}</strong>
                  <p>{log.endpoint}</p>
                </div>
              </article>
            )) : null}
            {!latestTasks.length && !latestLogs.length ? (
              <div className="empty-state">还没有任务和日志记录。</div>
            ) : null}
            {failedCount ? <div className="notice error compact-notice">当前有 {failedCount} 个失败任务，建议进入任务页查看原因。</div> : null}
          </div>
        </Panel>
      </section>
    </section>
  );
}

function GuideSummary({ steps, currentStep, onOpenGuide }) {
  const completed = steps.filter((step) => step.status === "done").length;
  const progress = steps.length ? Math.round((completed / steps.length) * 100) : 0;

  return (
    <section className="guide-summary">
      <div>
        <span className="eyebrow">Production Guide</span>
        <h3>当前建议：{currentStep?.title || "完成生产闭环"}</h3>
        <p>{currentStep?.summary || "所有关键环节已经跑通，可以进入复盘和下一集迭代。"}</p>
      </div>
      <div className="guide-summary-side">
        <div className="guide-progress-label">
          <span>流程进度</span>
          <strong>{completed} / {steps.length}</strong>
        </div>
        <div className="guide-progress" aria-label="生产向导进度">
          <span style={{ width: `${progress}%` }} />
        </div>
        <button className="primary" type="button" onClick={onOpenGuide}>打开向导</button>
      </div>
    </section>
  );
}

function GuidePage({ steps, currentStep, onNavigate }) {
  const completed = steps.filter((step) => step.status === "done").length;
  const progress = steps.length ? Math.round((completed / steps.length) * 100) : 0;

  return (
    <section className="overview-stack guide-page">
      <section className="hero-panel guide-hero">
        <div className="hero-copy">
          <span className="eyebrow">Production Guide</span>
          <h2>AI 视频制作生产向导</h2>
          <p>
            从项目、剧本、人物、拆镜到生图、生视频和发布质检，按当前数据自动标记下一步，
            让每次打开平台都知道该推进哪个环节。
          </p>
        </div>
        <div className="guide-hero-current">
          <span className={`status ${currentStep?.status || "todo"}`}>
            {getGuideStatusLabel(currentStep?.status)}
          </span>
          <strong>{currentStep?.title || "生产闭环已完成"}</strong>
          <p>{currentStep?.output || "继续复盘表现，准备下一集。"}</p>
          {currentStep ? (
            <button className="primary" type="button" onClick={() => onNavigate(currentStep)}>
              进入当前步骤
            </button>
          ) : null}
        </div>
      </section>

      <section className="guide-progress-panel">
        <div className="item-heading">
          <div>
            <strong>整条链路进度</strong>
            <p>已完成 {completed} 个关键环节，剩余 {Math.max(steps.length - completed, 0)} 个环节。</p>
          </div>
          <strong>{progress}%</strong>
        </div>
        <div className="guide-progress" aria-label="整条链路进度">
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      <section className="guide-grid">
        {steps.map((step, index) => (
          <article className={`guide-card ${step.status}`} key={step.key}>
            <div className="guide-status-row">
              <span className="guide-step-index">{String(index + 1).padStart(2, "0")}</span>
              <span className={`status ${step.status}`}>{getGuideStatusLabel(step.status)}</span>
            </div>
            <h3>{step.title}</h3>
            <p>{step.summary}</p>
            <dl className="guide-output">
              <dt>产出</dt>
              <dd>{step.output}</dd>
            </dl>
            <button
              className={step.status === "current" ? "primary" : "ghost"}
              type="button"
              onClick={() => onNavigate(step)}
            >
              {step.status === "done" ? "查看结果" : "去处理"}
            </button>
          </article>
        ))}
      </section>
    </section>
  );
}

function ProjectDetailPage({ project, shots, assets, tasks, logs, onNavigate }) {
  if (!project) {
    return <div className="empty-state">请先创建一个项目。</div>;
  }

  const approvedShots = shots.filter((shot) => ["approved", "image_selected"].includes(shot.status)).length;
  const progress = shots.length ? Math.round((approvedShots / shots.length) * 100) : 0;
  const imageTasks = tasks.filter((task) => task.task_type === "image").length;
  const videoTasks = tasks.filter((task) => task.task_type === "video").length;
  const failedTasks = tasks.filter((task) => task.status === "failed").length;
  const recentAssets = assets.slice(0, 5);
  const recentLogs = logs.slice(0, 6);

  return (
    <section className="overview-stack">
      <section className="project-detail-hero">
        <div>
          <span className="eyebrow">Project Detail</span>
          <h2>{project.name}</h2>
          <p>{project.description || "未填写项目说明"}</p>
          <div className="tag-row">
            <span className={`status ${project.status}`}>{project.status}</span>
            <span className="tag">更新于 {project.updated_at}</span>
          </div>
        </div>
        <div className="hero-actions">
          <button className="primary" type="button" onClick={() => onNavigate("shots")}>进入分镜工作台</button>
          <button type="button" onClick={() => onNavigate("assets")}>查看素材库</button>
        </div>
      </section>

      <section className="metric-strip">
        <Metric label="分镜" value={shots.length} />
        <Metric label="已推进" value={approvedShots} />
        <Metric label="素材" value={assets.length} />
        <Metric label="任务" value={tasks.length} />
        <Metric label="生图任务" value={imageTasks} />
        <Metric label="生视频任务" value={videoTasks} />
      </section>

      <section className="panel progress-panel">
        <div className="item-heading">
          <div>
            <strong>分镜完成进度</strong>
            <p>{approvedShots} / {shots.length} 个镜头已完成图像或通过审核</p>
          </div>
          <strong>{progress}%</strong>
        </div>
        <div className="progress-bar" aria-label="分镜完成进度">
          <span style={{ width: `${progress}%` }} />
        </div>
        {failedTasks ? <div className="notice error compact-notice">当前有 {failedTasks} 个失败任务需要处理。</div> : null}
      </section>

      <section className="overview-grid">
        <Panel title="近期分镜" subtitle="从项目详情可以直接回到具体镜头。">
          <div className="overview-list">
            {shots.slice(0, 6).map((shot) => (
              <article className="overview-list-item" key={shot.id}>
                <div>
                  <strong>#{shot.shot_number} {shot.title || "未命名镜头"}</strong>
                  <p>{shot.story || "未填写剧情"}</p>
                </div>
                <span className={`status ${shot.status}`}>{shot.status}</span>
              </article>
            ))}
            {!shots.length ? <div className="empty-state">还没有分镜。</div> : null}
          </div>
        </Panel>

        <Panel title="近期素材" subtitle="展示最近生成或上传的素材。">
          <div className="overview-list">
            {recentAssets.map((asset) => (
              <article className="overview-list-item" key={asset.id}>
                <div>
                  <strong>{asset.name}</strong>
                  <p>{asset.asset_type} · {asset.source} · {asset.model || "未记录模型"}</p>
                </div>
                <span className={`status ${asset.review_status}`}>{reviewLabel(asset.review_status)}</span>
              </article>
            ))}
            {!recentAssets.length ? <div className="empty-state">还没有素材。</div> : null}
          </div>
        </Panel>
      </section>

      <Panel title="操作记录" subtitle="最近调用日志和任务状态。">
        <div className="log-list">
          {recentLogs.map((log) => (
            <article className="log-item" key={log.id}>
              <span className={`status ${log.status}`}>{log.status}</span>
              <strong>{log.model || "调用日志"}</strong>
              <span>{log.duration_ms}ms</span>
              <p>{log.endpoint}</p>
            </article>
          ))}
          {!recentLogs.length ? <div className="empty-state">暂无操作记录。</div> : null}
        </div>
      </Panel>
    </section>
  );
}

function DevelopmentPage({
  workspace,
  view,
  project,
  onViewChange,
  onFieldChange,
  onListItemChange,
  onAddListItem,
  onRemoveListItem,
  onChecklistChange,
  onBuildShotDrafts,
  onImportShotDrafts,
  onSavePromptTemplates,
  onQualityCheckChange,
  onPublishPlanChange
}) {
  const doneCount = DEVELOPMENT_CHECKLIST.filter(([key]) => workspace.checklist[key]).length;
  const qualityDoneCount = QUALITY_CHECKLIST.filter(([key]) => workspace.qualityChecks[key]).length;
  const phaseCards = [
    ["01", "故事策划", "选题、受众、世界观和人物圣经"],
    ["02", "视觉圣经", "风格、角色、场景、道具和提示词公式"],
    ["03", "剧本拆镜", "单集脚本拆成镜头、对白、动作和情绪"],
    ["04", "生产质检", "批量出图、筛图、一致性、修复和排版"],
    ["05", "发布复盘", "平台适配、数据追踪和 SOP 迭代"]
  ];

  return (
    <section className="development-page">
      <section className="project-detail-hero development-hero">
        <div>
          <span className="eyebrow">AI Manga SOP</span>
          <h2>剧本开发台</h2>
          <p>
            把 SOP 里的前置创作环节收进平台：先写故事和人物，再沉淀视觉圣经，
            最后把单集脚本拆成可执行分镜。
          </p>
          <div className="tag-row">
            <span className="tag">当前项目：{project?.name || "未选择"}</span>
            <span className="tag">清单 {doneCount}/{DEVELOPMENT_CHECKLIST.length}</span>
          </div>
        </div>
        <div className="hero-actions">
          <button className="primary" type="button" onClick={onBuildShotDrafts}>拆成镜头草稿</button>
          <button type="button" onClick={onImportShotDrafts}>导入分镜工作台</button>
          <button type="button" onClick={onSavePromptTemplates}>沉淀提示词模板</button>
        </div>
      </section>

      <section className="workflow-strip development-flow" aria-label="AI漫剧制作阶段">
        {phaseCards.map(([num, title, desc]) => (
          <div className="workflow-step" key={num}>
            <span>PHASE {num}</span>
            <strong>{title}</strong>
            <p>{desc}</p>
          </div>
        ))}
      </section>

      <div className="segmented-control development-tabs" aria-label="剧本开发视图">
        {[
          ["script", "故事与剧本"],
          ["bible", "人物圣经"],
          ["assets", "场景道具"],
          ["shots", "拆镜草稿"],
          ["delivery", "质检发布"],
          ["gaps", "能力缺口"],
          ["checklist", "SOP清单"]
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={view === value ? "active" : ""}
            onClick={() => onViewChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "script" && (
        <section className="page-grid wide-left">
          <Panel title="故事定位" subtitle="对应 SOP 的选题定位、世界观和剧本结构设计。">
            <div className="stack">
              <label>
                一句话卖点
                <input value={workspace.logline} onChange={(event) => onFieldChange("logline", event.target.value)} placeholder="一句话说清楚主角、冲突和看点" />
              </label>
              <div className="field-grid">
                <label>
                  类型题材
                  <input value={workspace.genre} onChange={(event) => onFieldChange("genre", event.target.value)} placeholder="赛博朋克 / 古风 / 都市..." />
                </label>
                <label>
                  目标平台
                  <input value={workspace.targetPlatform} onChange={(event) => onFieldChange("targetPlatform", event.target.value)} />
                </label>
              </div>
              <label>
                目标受众
                <input value={workspace.audience} onChange={(event) => onFieldChange("audience", event.target.value)} placeholder="年龄、口味、爽点、消费习惯" />
              </label>
              <label>
                世界观设定
                <textarea value={workspace.worldview} onChange={(event) => onFieldChange("worldview", event.target.value)} rows={6} placeholder="时代、规则、势力、主要矛盾" />
              </label>
              <label>
                视觉风格关键词
                <textarea value={workspace.visualStyle} onChange={(event) => onFieldChange("visualStyle", event.target.value)} rows={4} placeholder="色调、线条、渲染方式、参考风格" />
              </label>
            </div>
          </Panel>

          <Panel title="单集剧本" subtitle="按场景、对白、动作和情绪写，后续可以自动拆成镜头草稿。">
            <div className="stack">
              <label>
                集数标题
                <input value={workspace.episodeTitle} onChange={(event) => onFieldChange("episodeTitle", event.target.value)} />
              </label>
              <label>
                剧本脚本
                <textarea value={workspace.episodeScript} onChange={(event) => onFieldChange("episodeScript", event.target.value)} rows={15} />
              </label>
              <div className="button-row">
                <button className="primary" type="button" onClick={onBuildShotDrafts}>拆成镜头草稿</button>
                <button type="button" onClick={onImportShotDrafts}>导入分镜</button>
              </div>
            </div>
          </Panel>
        </section>
      )}

      {view === "bible" && (
        <Panel title="人物圣经" subtitle="锁定角色语言风格和视觉关键词，减少后续剧本与出图漂移。">
          <div className="development-card-grid">
            {workspace.characters.map((character, index) => (
              <article className="development-edit-card" key={`${character.name}-${index}`}>
                <div className="item-heading">
                  <strong>人物 {index + 1}</strong>
                  <button className="danger" type="button" onClick={() => onRemoveListItem("characters", index)}>删除</button>
                </div>
                <label>
                  名称
                  <input value={character.name} onChange={(event) => onListItemChange("characters", index, "name", event.target.value)} />
                </label>
                <label>
                  角色定位
                  <input value={character.role} onChange={(event) => onListItemChange("characters", index, "role", event.target.value)} />
                </label>
                <label>
                  语言风格
                  <textarea value={character.voice} onChange={(event) => onListItemChange("characters", index, "voice", event.target.value)} rows={3} />
                </label>
                <label>
                  视觉关键词
                  <textarea value={character.visual} onChange={(event) => onListItemChange("characters", index, "visual", event.target.value)} rows={3} />
                </label>
              </article>
            ))}
          </div>
          <div className="button-row">
            <button type="button" onClick={() => onAddListItem("characters", { name: "新人物", role: "", voice: "", visual: "" })}>新增人物</button>
            <button type="button" onClick={onSavePromptTemplates}>保存人物公式到模板库</button>
          </div>
        </Panel>
      )}

      {view === "assets" && (
        <section className="overview-grid">
          <Panel title="场景库" subtitle="对应 SOP 的场景资产库，按地点、时间和情绪沉淀。">
            <EditableDevelopmentList
              type="scenes"
              items={workspace.scenes}
              fields={[
                ["name", "场景名称"],
                ["time", "时间"],
                ["mood", "情绪"],
                ["visual", "视觉描述"]
              ]}
              onChange={onListItemChange}
              onAdd={() => onAddListItem("scenes", { name: "新场景", time: "", mood: "", visual: "" })}
              onRemove={onRemoveListItem}
            />
            <button type="button" onClick={onSavePromptTemplates}>保存场景公式到模板库</button>
          </Panel>
          <Panel title="道具库" subtitle="关键道具会进入分镜备注和提示词，帮助镜头连续。">
            <EditableDevelopmentList
              type="props"
              items={workspace.props}
              fields={[
                ["name", "道具名称"],
                ["type", "类型"],
                ["visual", "视觉描述"],
                ["usage", "剧情用途"]
              ]}
              onChange={onListItemChange}
              onAdd={() => onAddListItem("props", { name: "新道具", type: "", visual: "", usage: "" })}
              onRemove={onRemoveListItem}
            />
          </Panel>
        </section>
      )}

      {view === "shots" && (
        <Panel title="拆镜草稿" subtitle="由单集脚本按场景、对白、动作初步拆出，可导入真实分镜继续出图。">
          <div className="button-row">
            <button className="primary" type="button" onClick={onBuildShotDrafts}>重新拆镜</button>
            <button type="button" onClick={onImportShotDrafts}>导入分镜工作台</button>
          </div>
          <div className="development-shot-grid">
            {workspace.shotDrafts.map((draft) => (
              <article className="shot-item shot-card" key={draft.id}>
                <div className="shot-number">#{draft.number}</div>
                <div className="shot-content">
                  <div className="item-heading">
                    <h3>{draft.title}</h3>
                    <span className="tag">{draft.camera}</span>
                  </div>
                  <p>{draft.story}</p>
                  <div className="tag-row">
                    {draft.scene ? <span className="tag">{draft.scene}</span> : null}
                    {draft.characters.map((name) => <span className="tag" key={name}>{name}</span>)}
                    {draft.props.map((name) => <span className="tag" key={name}>道具：{name}</span>)}
                  </div>
                  <div className="detail-block">
                    <strong>生图提示词</strong>
                    <p>{draft.image_prompt}</p>
                  </div>
                  <div className="detail-block">
                    <strong>视频提示词</strong>
                    <p>{draft.video_prompt}</p>
                  </div>
                </div>
              </article>
            ))}
            {!workspace.shotDrafts.length ? <div className="empty-state">还没有镜头草稿，先从单集剧本拆镜。</div> : null}
          </div>
        </Panel>
      )}

      {view === "delivery" && (
        <section className="overview-grid">
          <Panel title="质检交付" subtitle="承接 SOP 的角色一致性、字幕、平台规格和多端预览检查。">
            <div className="metric-grid">
              <Metric label="质检完成" value={`${qualityDoneCount}/${QUALITY_CHECKLIST.length}`} />
              <Metric label="清单完成" value={`${doneCount}/${DEVELOPMENT_CHECKLIST.length}`} />
              <Metric label="草稿镜头" value={workspace.shotDrafts.length} />
            </div>
            <div className="development-checklist">
              {QUALITY_CHECKLIST.map(([key, label]) => (
                <label className="checkline" key={key}>
                  <input
                    type="checkbox"
                    checked={Boolean(workspace.qualityChecks[key])}
                    onChange={(event) => onQualityCheckChange(key, event.target.checked)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </Panel>

          <Panel title="发布计划" subtitle="先把平台适配和复盘指标写下来，后续可接发布和数据回收。">
            <div className="stack">
              <div className="field-grid">
                <label>
                  发布平台
                  <input value={workspace.publishPlan.platform} onChange={(event) => onPublishPlanChange("platform", event.target.value)} />
                </label>
                <label>
                  发布时间
                  <input value={workspace.publishPlan.schedule} onChange={(event) => onPublishPlanChange("schedule", event.target.value)} placeholder="每周六 20:00" />
                </label>
              </div>
              <label>
                标题 A
                <input value={workspace.publishPlan.titleA} onChange={(event) => onPublishPlanChange("titleA", event.target.value)} placeholder="强冲突标题" />
              </label>
              <label>
                标题 B
                <input value={workspace.publishPlan.titleB} onChange={(event) => onPublishPlanChange("titleB", event.target.value)} placeholder="悬念/情绪标题" />
              </label>
              <label>
                封面说明
                <textarea value={workspace.publishPlan.coverBrief} onChange={(event) => onPublishPlanChange("coverBrief", event.target.value)} rows={4} placeholder="主视觉、人物表情、标题文案、安全区" />
              </label>
              <label>
                复盘指标
                <textarea value={workspace.publishPlan.metrics} onChange={(event) => onPublishPlanChange("metrics", event.target.value)} rows={3} />
              </label>
            </div>
          </Panel>
        </section>
      )}

      {view === "gaps" && (
        <Panel title="当前能力缺口" subtitle="按 SOP 对照平台能力，标记哪些已经可操作、哪些还需要后端或外部工具接入。">
          <div className="capability-grid">
            {CAPABILITY_GAPS.map((item) => (
              <article className="capability-card" key={item.name}>
                <div className="item-heading">
                  <strong>{item.name}</strong>
                  <span className={`status ${item.status === "待做" ? "failed" : item.status === "本轮补充" ? "running" : "succeeded"}`}>{item.status}</span>
                </div>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </Panel>
      )}

      {view === "checklist" && (
        <Panel title="SOP 清单" subtitle="把 SOP 中第一个项目前的关键准备变成可勾选状态。">
          <div className="development-checklist">
            {DEVELOPMENT_CHECKLIST.map(([key, label]) => (
              <label className="checkline" key={key}>
                <input
                  type="checkbox"
                  checked={Boolean(workspace.checklist[key])}
                  onChange={(event) => onChecklistChange(key, event.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </Panel>
      )}
    </section>
  );
}

function EditableDevelopmentList({ type, items, fields, onChange, onAdd, onRemove }) {
  return (
    <div className="stack">
      {items.map((item, index) => (
        <article className="development-edit-card" key={`${type}-${index}`}>
          <div className="item-heading">
            <strong>{item.name || `条目 ${index + 1}`}</strong>
            <button className="danger" type="button" onClick={() => onRemove(type, index)}>删除</button>
          </div>
          {fields.map(([field, label]) => (
            <label key={field}>
              {label}
              {field === "visual" || field === "usage" ? (
                <textarea value={item[field]} onChange={(event) => onChange(type, index, field, event.target.value)} rows={3} />
              ) : (
                <input value={item[field]} onChange={(event) => onChange(type, index, field, event.target.value)} />
              )}
            </label>
          ))}
        </article>
      ))}
      <button type="button" onClick={onAdd}>新增</button>
    </div>
  );
}

function ShotFocus({
  shot,
  assets,
  panel,
  onPanelChange,
  onCreateImage,
  onCreateVideo,
  onSetStatus,
  onSelectImage,
  onSelectVideo
}) {
  if (!shot) {
    return <div className="empty-state">创建分镜后，这里会显示当前镜头的提示词和生成结果。</div>;
  }

  const imageResults = assets.filter((asset) => asset.shot_id === shot.id && asset.asset_type === "image");
  const videoResults = assets.filter((asset) => asset.shot_id === shot.id && asset.asset_type === "video");
  const referenceAssets = assets.filter((asset) => shot.reference_asset_ids.includes(asset.id));

  return (
    <section className="shot-focus">
      <div className="item-heading">
        <div>
          <span className="eyebrow">Shot #{shot.shot_number}</span>
          <h3>{shot.title || "未命名镜头"}</h3>
        </div>
        <span className={`status ${shot.status}`}>{shot.status}</span>
      </div>
      <div className="segmented-control" aria-label="分镜面板">
        <button className={panel === "detail" ? "active" : ""} type="button" onClick={() => onPanelChange("detail")}>分镜详情</button>
        <button className={panel === "generate" ? "active" : ""} type="button" onClick={() => onPanelChange("generate")}>生成结果</button>
      </div>
      {panel === "detail" ? (
        <div className="detail-block">
          <strong>剧情描述</strong>
          <p>{shot.story || "未填写剧情"}</p>
          <div className="field-grid">
            <div className="detail-card">
              <strong>角色</strong>
              <p>{shot.characters.length ? shot.characters.join("、") : "未指定"}</p>
            </div>
            <div className="detail-card">
              <strong>参考素材</strong>
              <p>{referenceAssets.length ? referenceAssets.map((asset) => asset.name).join("、") : "暂无参考素材"}</p>
            </div>
          </div>
          <div className="detail-block">
            <strong>生图提示词</strong>
            <p>{shot.image_prompt || "未填写生图提示词"}</p>
          </div>
          <div className="detail-block">
            <strong>生视频提示词</strong>
            <p>{shot.video_prompt || "未填写生视频提示词"}</p>
          </div>
        </div>
      ) : (
        <div className="detail-block">
          <ShotResultGrid
            title="生图结果"
            assets={imageResults}
            selectedId={shot.selected_image_asset_id}
            emptyText="还没有分镜生图结果。"
            onSelect={onSelectImage}
          />
          <ShotResultGrid
            title="生视频结果"
            assets={videoResults}
            selectedId={shot.selected_video_asset_id}
            emptyText="还没有分镜生视频结果。"
            onSelect={onSelectVideo}
          />
        </div>
      )}
      <div className="button-row">
        <button type="button" onClick={onCreateImage}>一键生图</button>
        <button type="button" onClick={onCreateVideo}>入选图生视频</button>
        <button type="button" onClick={() => onSetStatus("approved")}>标记通过</button>
        <button className="danger" type="button" onClick={() => onSetStatus("rejected")}>废弃</button>
      </div>
    </section>
  );
}

function GenerationSidePanel({ type, assets, tasks, templates, onUseTemplate, onOpenTasks }) {
  const scopedAssets = assets.filter((asset) => asset.asset_type === type).slice(0, 6);
  const scopedTasks = tasks.filter((task) => task.task_type === type).slice(0, 5);
  const scopedTemplates = templates.filter((template) => template.category === type).slice(0, 4);

  return (
    <div className="generation-side">
      <div className="metric-grid">
        <Metric label="结果素材" value={assets.filter((asset) => asset.asset_type === type).length} />
        <Metric label="任务数" value={tasks.filter((task) => task.task_type === type).length} />
        <Metric label="模板" value={templates.filter((template) => template.category === type).length} />
      </div>
      <div className="detail-block">
        <strong>最近任务</strong>
        <div className="overview-list">
          {scopedTasks.map((task) => (
            <article className="overview-list-item" key={task.id}>
              <div>
                <strong>{task.model}</strong>
                <p>{task.prompt}</p>
              </div>
              <span className={`status ${task.status}`}>{task.status}</span>
            </article>
          ))}
          {!scopedTasks.length ? <div className="empty-state">还没有相关任务。</div> : null}
        </div>
      </div>
      <div className="detail-block">
        <strong>最近结果</strong>
        <div className="result-grid">
          {scopedAssets.map((asset) => (
            <div className="result-tile" key={asset.id}>
              {asset.mime_type.startsWith("image/") ? (
                <img src={fileUrl(asset.url)} alt={asset.name} />
              ) : (
                <span>{asset.name}</span>
              )}
            </div>
          ))}
        </div>
        {!scopedAssets.length ? <p>暂无结果素材。</p> : null}
      </div>
      <div className="detail-block">
        <strong>可用模板</strong>
        <div className="template-chip-list">
          {scopedTemplates.map((template) => (
            <button type="button" key={template.id} onClick={() => onUseTemplate(template)}>{template.name}</button>
          ))}
          {!scopedTemplates.length ? <p>暂无模板。</p> : null}
        </div>
      </div>
      <button type="button" onClick={onOpenTasks}>查看完整任务记录</button>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RequireProject({ project, children }) {
  if (!project) {
    return <div className="empty-state">请先创建一个项目。</div>;
  }
  return children;
}

function ReferenceAssetPicker({ assets, selectedIds, onChange }) {
  function toggle(assetId) {
    if (selectedIds.includes(assetId)) {
      onChange(selectedIds.filter((id) => id !== assetId));
    } else {
      onChange([...selectedIds, assetId]);
    }
  }

  return (
    <fieldset className="checkbox-field">
      <legend>参考图</legend>
      {assets.length ? (
        <div className="checkbox-grid">
          {assets.map((asset) => (
            <label key={asset.id}>
              <input
                type="checkbox"
                checked={selectedIds.includes(asset.id)}
                onChange={() => toggle(asset.id)}
              />
              <span>{asset.name}</span>
            </label>
          ))}
        </div>
      ) : (
        <p>素材库还没有图片素材。</p>
      )}
    </fieldset>
  );
}

function ShotCard({
  shot,
  assets,
  isSelected,
  onOpen,
  onEdit,
  onCreateImage,
  onCreateVideo,
  onSelectImage,
  onSelectVideo,
  onSetStatus
}) {
  const referenceAssets = assets.filter((asset) => shot.reference_asset_ids.includes(asset.id));
  const imageResults = assets.filter((asset) => asset.shot_id === shot.id && asset.asset_type === "image");
  const videoResults = assets.filter((asset) => asset.shot_id === shot.id && asset.asset_type === "video");

  return (
    <article className={`shot-item shot-card ${shot.status} ${isSelected ? "selected" : ""}`}>
      <div className="shot-number">#{shot.shot_number}</div>
      <div className="shot-content">
        <div className="item-heading">
          <h3>{shot.title || "未命名镜头"}</h3>
          <span className={`status ${shot.status}`}>{shot.status}</span>
        </div>
        <p>{shot.story || "未填写剧情"}</p>
        <div className="tag-row">
          {shot.characters.map((character) => <span className="tag" key={character}>{character}</span>)}
          {referenceAssets.map((asset) => <span className="tag" key={asset.id}>参考：{asset.name}</span>)}
        </div>

        <div className="button-row">
          <button type="button" onClick={onOpen}>聚焦详情</button>
          <button type="button" onClick={() => onEdit(shot)}>编辑</button>
          <button type="button" onClick={onCreateImage}>一键生图</button>
          <button type="button" disabled={!shot.selected_image_asset_id && !shot.reference_asset_ids.length} onClick={onCreateVideo}>入选图生视频</button>
          <button type="button" onClick={() => onSetStatus("approved")}>标记通过</button>
          <button className="danger" type="button" onClick={() => onSetStatus("rejected")}>废弃</button>
        </div>

        <ShotResultGrid
          title="生图结果"
          assets={imageResults}
          selectedId={shot.selected_image_asset_id}
          emptyText="还没有分镜生图结果。"
          onSelect={onSelectImage}
        />
        <ShotResultGrid
          title="生视频结果"
          assets={videoResults}
          selectedId={shot.selected_video_asset_id}
          emptyText="还没有分镜生视频结果。"
          onSelect={onSelectVideo}
        />

        {shot.notes ? <p className="shot-notes">{shot.notes}</p> : null}
      </div>
    </article>
  );
}

function ShotResultGrid({ title, assets, selectedId, emptyText, onSelect }) {
  return (
    <section className="result-block">
      <div className="result-heading">
        <strong>{title}</strong>
        <span>{assets.length}</span>
      </div>
      {assets.length ? (
        <div className="result-grid">
          {assets.map((asset) => (
            <button
              className={`result-tile ${asset.id === selectedId ? "selected" : ""}`}
              key={asset.id}
              type="button"
              onClick={() => onSelect(asset)}
            >
              {asset.mime_type.startsWith("image/") ? (
                <img src={fileUrl(asset.url)} alt={asset.name} />
              ) : (
                <span>{asset.name}</span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <p className="muted-text">{emptyText}</p>
      )}
    </section>
  );
}

function AssetGrid({ assets, view, selectedAssetId, onOpen, onSelect, onReview }) {
  if (!assets.length) {
    return <div className="empty-state">暂无素材。上传参考图后会显示在这里。</div>;
  }

  return (
    <div className={`asset-grid ${view === "list" ? "list-view" : ""}`}>
      {assets.map((asset) => (
        <article className={`asset-item ${asset.id === selectedAssetId ? "selected" : ""}`} key={asset.id}>
          <div className="asset-preview">
            {asset.mime_type.startsWith("image/") ? (
              <img src={fileUrl(asset.url)} alt={asset.name} />
            ) : (
              <div className="file-preview">{asset.asset_type}</div>
            )}
          </div>
          <div className="asset-body">
            <strong>{asset.name}</strong>
            <span>{asset.source} · {asset.asset_type} · {reviewLabel(asset.review_status)}</span>
            {asset.prompt ? <p>{asset.prompt}</p> : null}
            <div className="button-row">
              <button type="button" onClick={() => onOpen(asset)}>详情</button>
              <button type="button" onClick={() => onSelect(asset)}>
                {asset.is_selected ? "取消入选" : "标记入选"}
              </button>
              <button type="button" onClick={() => onReview(asset, "liked")}>喜欢</button>
              <button type="button" onClick={() => onReview(asset, "disliked")}>不喜欢</button>
              <button className="danger" type="button" onClick={() => onReview(asset, "discarded")}>废弃</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function AssetDetail({ asset, assets, tasks, onRerunTask }) {
  if (!asset) {
    return <div className="empty-state detail-empty">选择一个素材后查看来源、参数和上游参考。</div>;
  }

  const upstreamAssets = assets.filter((item) => asset.upstream_asset_ids.includes(item.id));
  const sourceTask = tasks.find((task) => task.id === asset.task_id);

  return (
    <section className="asset-detail" aria-label="素材详情">
      <div className="item-heading">
        <h3>{asset.name}</h3>
        {asset.is_selected ? <span className="tag">已入选</span> : null}
      </div>
      <dl className="metadata-list">
        <dt>类型</dt>
        <dd>{asset.asset_type}</dd>
        <dt>评审</dt>
        <dd>{reviewLabel(asset.review_status)}</dd>
        <dt>来源</dt>
        <dd>{asset.source}</dd>
        <dt>平台</dt>
        <dd>{asset.provider || "未记录"}</dd>
        <dt>模型</dt>
        <dd>{asset.model || "未记录"}</dd>
        <dt>文件</dt>
        <dd>{asset.file_path}</dd>
      </dl>

      {asset.prompt ? (
        <div className="detail-block">
          <strong>提示词</strong>
          <p>{asset.prompt}</p>
        </div>
      ) : null}

      <div className="detail-block">
        <strong>参数</strong>
        <pre>{JSON.stringify(asset.params || {}, null, 2)}</pre>
      </div>

      <div className="detail-block">
        <strong>上游参考</strong>
        {upstreamAssets.length ? (
          <div className="tag-row">
            {upstreamAssets.map((item) => <span className="tag" key={item.id}>{item.name}</span>)}
          </div>
        ) : (
          <p>无上游参考素材</p>
        )}
      </div>

      {sourceTask ? (
        <div className="detail-block">
          <strong>生成任务</strong>
          <p>{sourceTask.task_type === "image" ? "生图" : "生视频"} · {sourceTask.status} · {sourceTask.model}</p>
          <div className="button-row">
            <button type="button" onClick={() => onRerunTask(sourceTask)}>复制参数重跑</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TaskDetail({ task, logs, assets, onRerunTask, onSaveTemplate }) {
  if (!task) {
    return <div className="empty-state">暂无任务。创建生图或生视频任务后会显示在这里。</div>;
  }

  const resultAssets = assets.filter((asset) => task.result_asset_ids.includes(asset.id));
  const referenceAssets = assets.filter((asset) => task.reference_asset_ids.includes(asset.id));

  return (
    <section className="task-detail" aria-label="任务详情">
      <dl className="metadata-list">
        <dt>类型</dt>
        <dd>{task.task_type === "image" ? "生图" : "生视频"}</dd>
        <dt>状态</dt>
        <dd><span className={`status ${task.status}`}>{task.status}</span></dd>
        <dt>平台</dt>
        <dd>{task.provider}</dd>
        <dt>模型</dt>
        <dd>{task.model}</dd>
        <dt>耗费</dt>
        <dd>{task.estimated_cost}</dd>
      </dl>

      <div className="button-row">
        <button type="button" onClick={() => onRerunTask(task)}>复制参数重跑</button>
        {task.status === "succeeded" ? (
          <button type="button" onClick={() => onSaveTemplate(task)}>保存为模板</button>
        ) : null}
      </div>

      <div className="detail-block">
        <strong>提示词</strong>
        <p>{task.prompt}</p>
      </div>

      <div className="detail-block">
        <strong>参数</strong>
        <pre>{JSON.stringify(task.params || {}, null, 2)}</pre>
      </div>

      <div className="detail-block">
        <strong>参考素材</strong>
        {referenceAssets.length ? (
          <div className="tag-row">
            {referenceAssets.map((asset) => <span className="tag" key={asset.id}>{asset.name}</span>)}
          </div>
        ) : (
          <p>无参考素材</p>
        )}
      </div>

      <div className="detail-block">
        <strong>生成结果</strong>
        {resultAssets.length ? (
          <div className="tag-row">
            {resultAssets.map((asset) => <span className="tag" key={asset.id}>{asset.name}</span>)}
          </div>
        ) : (
          <p>暂无结果素材</p>
        )}
      </div>

      {task.error_message ? (
        <div className="notice error compact-notice">{task.error_message}</div>
      ) : null}

      <div className="detail-block">
        <strong>调用日志</strong>
        {logs.length ? (
          <div className="log-list">
            {logs.map((log) => (
              <article className="log-item" key={log.id}>
                <span className={`status ${log.status}`}>{log.status}</span>
                <strong>{log.endpoint}</strong>
                <span>{log.duration_ms}ms</span>
                {log.error_message ? <p>{log.error_message}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <p>暂无调用日志</p>
        )}
      </div>
    </section>
  );
}

function LogDashboard({ tasks, logs }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter((log) => log.started_at.slice(0, 10) === todayKey);
  const succeeded = tasks.filter((task) => task.status === "succeeded").length;
  const failed = tasks.filter((task) => task.status === "failed").length;
  const successRate = tasks.length ? Math.round((succeeded / tasks.length) * 100) : 0;
  const estimatedCost = logs.reduce((total, log) => total + Number(log.estimated_cost || 0), 0);
  const modelStats = countBy(tasks, "model");
  const mostUsedModel = modelStats[0]?.name || "暂无";

  return (
    <div className="dashboard">
      <div className="metric-grid">
        <Metric label="今日调用" value={todayLogs.length} />
        <Metric label="本项目任务" value={tasks.length} />
        <Metric label="成功率" value={`${successRate}%`} />
        <Metric label="失败任务" value={failed} />
      </div>
      <div className="metric-grid">
        <Metric label="最常用模型" value={mostUsedModel} />
        <Metric label="预估消耗" value={estimatedCost.toFixed(2)} />
        <Metric label="日志总数" value={logs.length} />
        <Metric label="成功任务" value={succeeded} />
      </div>
      <div className="log-list">
        {logs.map((log) => (
          <article className="log-item" key={log.id}>
            <span className={`status ${log.status}`}>{log.status}</span>
            <strong>{log.model}</strong>
            <span>{log.duration_ms}ms</span>
            <p>{log.endpoint}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function loadDevelopmentWorkspace() {
  if (typeof window === "undefined") return DEFAULT_DEVELOPMENT_WORKSPACE;
  try {
    const saved = window.localStorage.getItem("frameai.developmentWorkspace");
    if (!saved) return DEFAULT_DEVELOPMENT_WORKSPACE;
    return mergeDevelopmentWorkspace(JSON.parse(saved));
  } catch {
    return DEFAULT_DEVELOPMENT_WORKSPACE;
  }
}

function saveDevelopmentWorkspace(workspace) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("frameai.developmentWorkspace", JSON.stringify(workspace));
}

function mergeDevelopmentWorkspace(saved) {
  return {
    ...DEFAULT_DEVELOPMENT_WORKSPACE,
    ...saved,
    characters: Array.isArray(saved.characters) ? saved.characters : DEFAULT_DEVELOPMENT_WORKSPACE.characters,
    props: Array.isArray(saved.props) ? saved.props : DEFAULT_DEVELOPMENT_WORKSPACE.props,
    scenes: Array.isArray(saved.scenes) ? saved.scenes : DEFAULT_DEVELOPMENT_WORKSPACE.scenes,
    shotDrafts: Array.isArray(saved.shotDrafts) ? saved.shotDrafts : [],
    checklist: {
      ...DEFAULT_DEVELOPMENT_WORKSPACE.checklist,
      ...(saved.checklist || {})
    },
    qualityChecks: {
      ...DEFAULT_DEVELOPMENT_WORKSPACE.qualityChecks,
      ...(saved.qualityChecks || {})
    },
    publishPlan: {
      ...DEFAULT_DEVELOPMENT_WORKSPACE.publishPlan,
      ...(saved.publishPlan || {})
    }
  };
}

function buildDevelopmentPromptTemplates(workspace) {
  const characterSummary = workspace.characters
    .map((character) => `${character.name}：${character.role}；语言=${character.voice}；视觉=${character.visual}`)
    .join("\n");
  const sceneSummary = workspace.scenes
    .map((scene) => `${scene.name}：${scene.time}；${scene.mood}；${scene.visual}`)
    .join("\n");
  const propSummary = workspace.props
    .map((prop) => `${prop.name}：${prop.type}；${prop.visual}；用途=${prop.usage}`)
    .join("\n");

  return [
    {
      name: "人物一致性公式",
      category: "character",
      content: [
        "风格：{{visual_style}}",
        "人物圣经：",
        characterSummary || "{{character_bible}}",
        "当前人物：{{character_name}}",
        "表情：{{expression}}，动作：{{action}}，服装：{{costume}}",
        "要求：保持脸型、发型、服装、气质一致。"
      ].join("\n"),
      variables: ["visual_style", "character_name", "expression", "action", "costume"],
      notes: "由剧本开发台生成"
    },
    {
      name: "场景资产公式",
      category: "scene",
      content: [
        "视觉风格：{{visual_style}}",
        "场景库：",
        sceneSummary || "{{scene_bible}}",
        "当前场景：{{scene_name}}，时间：{{time}}，天气/氛围：{{mood}}",
        "镜头重点：{{focus}}"
      ].join("\n"),
      variables: ["visual_style", "scene_name", "time", "mood", "focus"],
      notes: "由剧本开发台生成"
    },
    {
      name: "漫剧分镜生图公式",
      category: "image",
      content: [
        "项目卖点：{{logline}}",
        "视觉风格：{{visual_style}}",
        "人物：{{characters}}",
        "场景：{{scene}}",
        "道具：{{props}}",
        "镜头类型：{{camera}}",
        "剧情动作：{{story}}",
        "道具库参考：",
        propSummary || "{{prop_bible}}",
        "要求：漫画分镜，构图清晰，角色一致，细节稳定。"
      ].join("\n"),
      variables: ["logline", "visual_style", "characters", "scene", "props", "camera", "story"],
      notes: "由剧本开发台生成"
    },
    {
      name: "漫剧分镜生视频公式",
      category: "video",
      content: [
        "镜头类型：{{camera}}",
        "剧情动作：{{story}}",
        "对白节奏：{{dialogue}}",
        "情绪：{{mood}}",
        "镜头运动：{{camera_move}}",
        "要求：动作连贯、角色一致、节奏适合短剧。"
      ].join("\n"),
      variables: ["camera", "story", "dialogue", "mood", "camera_move"],
      notes: "由剧本开发台生成"
    }
  ];
}

function buildShotDraftsFromScript(workspace) {
  const rawScript = workspace.episodeScript || "";
  if (!rawScript.trim()) return [];

  let blocks = rawScript
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length <= 1) {
    const lines = rawScript.split(/\n/).map((line) => line.trim()).filter(Boolean);
    blocks = [];
    for (let index = 0; index < lines.length; index += 3) {
      blocks.push(lines.slice(index, index + 3).join("\n"));
    }
  }

  const cameras = ["远景", "中景", "近景", "特写", "跟拍", "俯拍"];
  return blocks.map((block, index) => {
    const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
    const scene = findMention(workspace.scenes, block);
    const props = findMentions(workspace.props, block);
    const characters = findMentions(workspace.characters, block);
    const dialogue = lines
      .filter((line) => /[:：]/.test(line) && !/^场景|^scene/i.test(line))
      .join(" / ");
    const story = lines
      .map((line) => line.replace(/^场景[一二三四五六七八九十\d]*[:：]?/i, "").trim())
      .join(" ");
    const camera = cameras[index % cameras.length];
    const characterVisual = workspace.characters
      .filter((character) => characters.includes(character.name))
      .map((character) => character.visual)
      .filter(Boolean)
      .join("；");
    const sceneVisual = scene?.visual || "";
    const propVisual = workspace.props
      .filter((prop) => props.includes(prop.name))
      .map((prop) => prop.visual)
      .filter(Boolean)
      .join("；");

    return {
      id: `draft-${index + 1}`,
      number: index + 1,
      title: `${workspace.episodeTitle || "EP"} · 镜头 ${index + 1}`,
      story,
      scene: scene?.name || "",
      props,
      characters,
      dialogue,
      camera,
      image_prompt: [
        workspace.visualStyle,
        `${camera}构图`,
        sceneVisual,
        characterVisual,
        propVisual,
        story
      ].filter(Boolean).join("，"),
      video_prompt: [
        `${camera}镜头运动`,
        dialogue ? `对白节奏：${dialogue}` : "",
        scene?.mood ? `情绪：${scene.mood}` : "",
        "保持角色一致性，动作连贯"
      ].filter(Boolean).join("，")
    };
  });
}

function findMention(items, text) {
  return items.find((item) => item.name && text.includes(item.name)) || null;
}

function findMentions(items, text) {
  return items
    .filter((item) => item.name && text.includes(item.name))
    .map((item) => item.name);
}

function buildGuideSteps({
  projects,
  selectedProject,
  projectShots,
  projectAssets,
  projectTasks,
  templates,
  selectedAssetsCount,
  developmentWorkspace
}) {
  const hasProject = Boolean(selectedProject || projects.length);
  const hasStoryInput = developmentWorkspace.checklist.topic
    || developmentWorkspace.checklist.script
    || hasChangedText(developmentWorkspace.logline, DEFAULT_DEVELOPMENT_WORKSPACE.logline)
    || hasChangedText(developmentWorkspace.worldview, DEFAULT_DEVELOPMENT_WORKSPACE.worldview)
    || hasChangedText(developmentWorkspace.episodeScript, DEFAULT_DEVELOPMENT_WORKSPACE.episodeScript);
  const hasBible = developmentWorkspace.checklist.bible
    || developmentWorkspace.checklist.visual
    || hasChangedText(developmentWorkspace.visualStyle, DEFAULT_DEVELOPMENT_WORKSPACE.visualStyle)
    || hasChangedList(developmentWorkspace.characters, DEFAULT_DEVELOPMENT_WORKSPACE.characters)
    || hasChangedList(developmentWorkspace.scenes, DEFAULT_DEVELOPMENT_WORKSPACE.scenes)
    || hasChangedList(developmentWorkspace.props, DEFAULT_DEVELOPMENT_WORKSPACE.props);
  const hasDrafts = developmentWorkspace.shotDrafts.length > 0 || projectShots.length > 0;
  const hasTemplates = developmentWorkspace.checklist.prompts || templates.some(isDevelopmentTemplate);
  const hasImageOutput = projectTasks.some((task) => task.task_type === "image")
    || projectAssets.some((asset) => asset.asset_type === "image");
  const hasReviewedAssets = selectedAssetsCount > 0
    || projectAssets.some((asset) => asset.is_selected || asset.review_status === "liked")
    || projectShots.some((shot) => Boolean(shot.selected_image_asset_id));
  const hasVideoOutput = projectTasks.some((task) => task.task_type === "video")
    || projectAssets.some((asset) => asset.asset_type === "video");
  const hasDeliveryChecks = QUALITY_CHECKLIST.every(([key]) => developmentWorkspace.qualityChecks[key]);
  const completionMap = {
    project: hasProject,
    script: hasProject && hasStoryInput,
    bible: hasProject && hasBible,
    drafts: hasProject && hasDrafts,
    templates: hasProject && hasTemplates,
    image: hasProject && hasImageOutput,
    review: hasProject && hasReviewedAssets,
    video: hasProject && hasVideoOutput,
    delivery: hasProject && hasDeliveryChecks
  };
  const firstOpenIndex = GUIDE_STEP_DEFINITIONS.findIndex((step) => !completionMap[step.key]);

  return GUIDE_STEP_DEFINITIONS.map((step, index) => ({
    ...step,
    done: Boolean(completionMap[step.key]),
    status: completionMap[step.key] ? "done" : index === firstOpenIndex ? "current" : "todo"
  }));
}

function hasChangedText(value, defaultValue) {
  const trimmed = String(value || "").trim();
  return Boolean(trimmed) && trimmed !== String(defaultValue || "").trim();
}

function hasChangedList(value, defaultValue) {
  return JSON.stringify(value || []) !== JSON.stringify(defaultValue || []);
}

function isDevelopmentTemplate(template) {
  return template.notes === "由剧本开发台生成"
    || ["人物一致性公式", "场景资产公式", "漫剧分镜生图公式", "漫剧分镜生视频公式"].includes(template.name);
}

function getGuideStatusLabel(status) {
  const labels = {
    done: "已完成",
    current: "当前步骤",
    todo: "待处理"
  };
  return labels[status] || "待处理";
}

function splitList(value) {
  if (!value) return [];
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizedImageParams(params) {
  return {
    aspect_ratio: params.aspect_ratio,
    resolution: params.resolution,
    count: clampNumber(Number(params.count), 1, 8),
    guidance: clampNumber(Number(params.guidance), 1, 20),
    negative_prompt: params.negative_prompt || undefined
  };
}

function normalizedVideoParams(params) {
  return {
    duration: clampNumber(Number(params.duration), 1, 20),
    motion: params.motion,
    camera_move: params.camera_move,
    count: clampNumber(Number(params.count), 1, 4),
    seed: params.seed || undefined
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(value, max));
}

function countBy(items, field) {
  const counts = new Map();
  for (const item of items) {
    const value = item[field] || "unknown";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count);
}

function reviewLabel(status) {
  const labels = {
    unreviewed: "未评审",
    liked: "喜欢",
    disliked: "不喜欢",
    discarded: "废弃"
  };
  return labels[status] || status || "未评审";
}

function getTemplateVariables(template) {
  const declared = template.variables || [];
  const detected = [...template.content.matchAll(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g)].map((match) => match[1]);
  return [...new Set([...declared, ...detected])];
}

function renderTemplate(content, values) {
  return content.replace(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g, (match, key) => {
    const value = values[key];
    return value ? value : match;
  });
}

export default App;
