import { useEffect, useMemo, useState } from "react";
import { api, fileUrl } from "./api/client.js";

const NAV_ITEMS = [
  { id: "projects", label: "项目" },
  { id: "shots", label: "分镜" },
  { id: "assets", label: "素材" },
  { id: "templates", label: "模板" },
  { id: "generate", label: "生成" },
  { id: "tasks", label: "任务" },
  { id: "settings", label: "设置" }
];

const EMPTY_PROJECT = { name: "", description: "" };
const EMPTY_SHOT = {
  title: "",
  story: "",
  characters: "",
  image_prompt: "",
  video_prompt: "",
  notes: ""
};
const EMPTY_TEMPLATE = { name: "", category: "image", content: "", variables: "", notes: "" };

function App() {
  const [activeTab, setActiveTab] = useState("projects");
  const [projects, setProjects] = useState([]);
  const [shots, setShots] = useState([]);
  const [assets, setAssets] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [providers, setProviders] = useState([]);
  const [runtime, setRuntime] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT);
  const [editingProjectId, setEditingProjectId] = useState("");
  const [projectEditForm, setProjectEditForm] = useState(EMPTY_PROJECT);
  const [shotForm, setShotForm] = useState(EMPTY_SHOT);
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE);
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [templateEditForm, setTemplateEditForm] = useState(EMPTY_TEMPLATE);
  const [imagePrompt, setImagePrompt] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [referenceAssetId, setReferenceAssetId] = useState("");
  const [assetFile, setAssetFile] = useState(null);
  const [assetName, setAssetName] = useState("");
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
  const projectTasks = useMemo(
    () => tasks.filter((task) => !currentProjectId || task.project_id === currentProjectId),
    [tasks, currentProjectId]
  );

  async function loadAll() {
    setError("");
    const [projectData, templateData, providerData, runtimeData] = await Promise.all([
      api.listProjects(),
      api.listTemplates(),
      api.providers(),
      api.runtime()
    ]);
    setProjects(projectData);
    setTemplates(templateData);
    setProviders(providerData.providers || []);
    setRuntime(runtimeData);
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
    const [shotData, assetData, taskData] = await Promise.all([
      api.listShots(projectId),
      api.listAssets(projectId),
      api.listTasks(projectId)
    ]);
    setShots(shotData);
    setAssets(assetData);
    setTasks(taskData);
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
    }, 3000);
    return () => window.clearInterval(timer);
  }, [currentProjectId]);

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
        image_prompt: shotForm.image_prompt,
        video_prompt: shotForm.video_prompt,
        notes: shotForm.notes
      });
      setShotForm(EMPTY_SHOT);
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
      const reference_asset_ids = referenceAssetId ? [referenceAssetId] : [];
      const create = type === "image" ? api.createImageTask : api.createVideoTask;
      await create({
        project_id: currentProjectId,
        provider,
        model,
        prompt,
        params: { count: 1 },
        reference_asset_ids
      });
      if (type === "image") setImagePrompt("");
      if (type === "video") setVideoPrompt("");
      setActiveTab("tasks");
      await refreshProjectData();
    });
  }

  function applyTemplate(template, target) {
    if (target === "image") {
      setImagePrompt(template.content);
      setActiveTab("generate");
    } else {
      setVideoPrompt(template.content);
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
            <Panel title="新建分镜" subtitle="分镜是后续生图、生视频和结果筛选的主线。">
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
              </RequireProject>
            </Panel>
            <Panel title="分镜列表">
              <div className="shot-list">
                {projectShots.map((shot) => (
                  <article className="shot-item" key={shot.id}>
                    <div className="shot-number">#{shot.shot_number}</div>
                    <div>
                      <h3>{shot.title || "未命名镜头"}</h3>
                      <p>{shot.story || "未填写剧情"}</p>
                      <div className="tag-row">
                        {shot.characters.map((character) => <span className="tag" key={character}>{character}</span>)}
                        <span className="tag">{shot.status}</span>
                      </div>
                    </div>
                  </article>
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
              </RequireProject>
            </Panel>
            <Panel title="素材库">
              <AssetGrid assets={projectAssets} onSelect={(asset) => runAction(async () => {
                await api.updateAsset(asset.id, { is_selected: !asset.is_selected });
                await refreshProjectData();
              })} />
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
                      <button type="button" onClick={() => startEditTemplate(template)}>编辑</button>
                      <button className="danger" type="button" onClick={() => handleDeleteTemplate(template)}>删除</button>
                    </div>
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
                  <button className="primary" type="button" disabled={!imagePrompt} onClick={() => handleCreateTask("image")}>创建生图任务</button>
                </div>
              </RequireProject>
            </Panel>
            <Panel title="生视频任务">
              <RequireProject project={selectedProject}>
                <div className="stack">
                  <label>
                    参考素材
                    <select value={referenceAssetId} onChange={(event) => setReferenceAssetId(event.target.value)}>
                      <option value="">不使用参考素材</option>
                      {projectAssets.map((asset) => (
                        <option value={asset.id} key={asset.id}>{asset.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    视频提示词
                    <textarea value={videoPrompt} onChange={(event) => setVideoPrompt(event.target.value)} rows={8} />
                  </label>
                  <button className="primary" type="button" disabled={!videoPrompt} onClick={() => handleCreateTask("video")}>创建生视频任务</button>
                </div>
              </RequireProject>
            </Panel>
          </section>
        )}

        {activeTab === "tasks" && (
          <Panel title="任务记录" subtitle="后台 worker 会轮询 pending 任务，并将 mock 结果写回素材库。">
            <div className="task-table">
              {projectTasks.map((task) => (
                <article className="task-row" key={task.id}>
                  <div>
                    <span className={`status ${task.status}`}>{task.status}</span>
                    <strong>{task.task_type === "image" ? "生图" : "生视频"} · {task.model}</strong>
                    <p>{task.prompt}</p>
                  </div>
                  <div className="task-meta">
                    <span>尝试 {task.attempts}/{task.max_retries + 1}</span>
                    <span>结果 {task.result_asset_ids.length}</span>
                    {task.status === "failed" ? <button type="button" onClick={() => runAction(async () => {
                      await api.retryTask(task.id);
                      await refreshProjectData();
                    })}>重试</button> : null}
                  </div>
                </article>
              ))}
            </div>
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

function AssetGrid({ assets, onSelect }) {
  if (!assets.length) {
    return <div className="empty-state">暂无素材。上传参考图后会显示在这里。</div>;
  }

  return (
    <div className="asset-grid">
      {assets.map((asset) => (
        <article className="asset-item" key={asset.id}>
          <div className="asset-preview">
            {asset.mime_type.startsWith("image/") ? (
              <img src={fileUrl(asset.url)} alt={asset.name} />
            ) : (
              <div className="file-preview">{asset.asset_type}</div>
            )}
          </div>
          <div className="asset-body">
            <strong>{asset.name}</strong>
            <span>{asset.source} · {asset.asset_type}</span>
            {asset.prompt ? <p>{asset.prompt}</p> : null}
            <button type="button" onClick={() => onSelect(asset)}>
              {asset.is_selected ? "取消入选" : "标记入选"}
            </button>
          </div>
        </article>
      ))}
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

export default App;
