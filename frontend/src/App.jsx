import { useEffect, useMemo, useState } from "react";
import { api, fileUrl } from "./api/client.js";

const NAV_ITEMS = [
  { id: "projects", label: "项目" },
  { id: "shots", label: "分镜" },
  { id: "assets", label: "素材" },
  { id: "templates", label: "模板" },
  { id: "generate", label: "生成" },
  { id: "tasks", label: "任务" },
  { id: "logs", label: "日志" },
  { id: "settings", label: "设置" }
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
const EMPTY_IMAGE_PARAMS = { aspect_ratio: "16:9", resolution: "1280x720", count: 1, max_retries: 1 };
const EMPTY_VIDEO_PARAMS = { duration: 5, motion: "medium", camera_move: "static", count: 1, max_retries: 1 };

function App() {
  const [activeTab, setActiveTab] = useState("projects");
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
  const visibleAssets = useMemo(
    () => projectAssets.filter((asset) => assetTypeFilter === "all" || asset.asset_type === assetTypeFilter),
    [projectAssets, assetTypeFilter]
  );
  const selectedAsset = useMemo(
    () => projectAssets.find((asset) => asset.id === selectedAssetId) || null,
    [projectAssets, selectedAssetId]
  );
  const projectTasks = useMemo(
    () => tasks.filter((task) => !currentProjectId || task.project_id === currentProjectId),
    [tasks, currentProjectId]
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
      const provider = providers[0]?.id || "mock";
      const model = type === "image" ? "mock-image-v1" : "mock-video-v1";
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

      const provider = providers[0]?.id || "mock";
      const model = type === "image" ? "mock-image-v1" : "mock-video-v1";
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
      setActiveTab("generate");
    } else {
      setVideoPrompt(content);
      setActiveTab("generate");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <h1>FrameAI</h1>
            <p>AI 视频制作工作流中台</p>
          </div>
        </div>
        <nav className="nav-list" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeTab === item.id ? "active" : ""}
              onClick={() => setActiveTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">当前项目</span>
            <h2>{selectedProject?.name || "未创建项目"}</h2>
          </div>
          <select
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
        </header>

        {error ? <div className="notice error">{error}</div> : null}
        {isLoading ? <div className="notice">正在连接本地后端...</div> : null}

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
                <Metric label="分镜" value={projectShots.length} />
                <Metric label="素材" value={projectAssets.length} />
                <Metric label="任务" value={projectTasks.length} />
              </div>
              <div className="list">
                {projects.map((project) => (
                  <article className={`project-item ${project.id === currentProjectId ? "selected" : ""}`} key={project.id}>
                    <button className="row-button" type="button" onClick={() => setSelectedProjectId(project.id)}>
                      <strong>{project.name}</strong>
                      <span>{project.description || "未填写说明"}</span>
                    </button>
                    <div className="project-actions">
                      <button type="button" onClick={() => startEditProject(project)}>编辑</button>
                      <button className="danger" type="button" onClick={() => handleDeleteProject(project)}>删除</button>
                    </div>
                  </article>
                ))}
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
            <Panel title="分镜列表">
              <div className="shot-list">
                {projectShots.map((shot) => (
                  <ShotCard
                    key={shot.id}
                    shot={shot}
                    assets={projectAssets}
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
            <Panel title="素材库">
              <div className="toolbar">
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
              </div>
              <AssetGrid
                assets={visibleAssets}
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
            <Panel title="模板库">
              <div className="template-list">
                {templates.map((template) => (
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
              </div>
            </Panel>
          </section>
        )}

        {activeTab === "generate" && (
          <section className="page-grid">
            <Panel title="生图任务">
              <RequireProject project={selectedProject}>
                <div className="stack">
                  <label>
                    提示词
                    <textarea value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} rows={8} />
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
                  <button className="primary" type="button" disabled={!imagePrompt} onClick={() => handleCreateTask("image")}>创建生图任务</button>
                </div>
              </RequireProject>
            </Panel>
            <Panel title="生视频任务">
              <RequireProject project={selectedProject}>
                <div className="stack">
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
                  <button className="primary" type="button" disabled={!videoPrompt} onClick={() => handleCreateTask("video")}>创建生视频任务</button>
                </div>
              </RequireProject>
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
            <Panel title="Provider">
              <div className="template-list">
                {providers.map((provider) => (
                  <article className="template-item" key={provider.id}>
                    <div className="item-heading">
                      <strong>{provider.name}</strong>
                      <span className="tag">{provider.id}</span>
                    </div>
                    <p>{provider.description}</p>
                    <p>生图模型：{provider.image_model}</p>
                    <p>生视频模型：{provider.video_model}</p>
                  </article>
                ))}
              </div>
            </Panel>
            <Panel title="本地运行路径">
              <dl className="runtime-list">
                <dt>数据库</dt>
                <dd>{runtime?.database_path}</dd>
                <dt>文件存储</dt>
                <dd>{runtime?.storage_dir}</dd>
              </dl>
            </Panel>
          </section>
        )}
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
    <article className={`shot-item shot-card ${shot.status}`}>
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

function AssetGrid({ assets, selectedAssetId, onOpen, onSelect, onReview }) {
  if (!assets.length) {
    return <div className="empty-state">暂无素材。上传参考图后会显示在这里。</div>;
  }

  return (
    <div className="asset-grid">
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
    count: clampNumber(Number(params.count), 1, 8)
  };
}

function normalizedVideoParams(params) {
  return {
    duration: clampNumber(Number(params.duration), 1, 20),
    motion: params.motion,
    camera_move: params.camera_move,
    count: clampNumber(Number(params.count), 1, 4)
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
