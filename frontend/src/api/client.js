const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const FILE_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      message = payload.detail || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function fileUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${FILE_ORIGIN}${url}`;
}

export const api = {
  listProjects: () => request("/projects"),
  createProject: (payload) => request("/projects", { method: "POST", body: JSON.stringify(payload) }),
  updateProject: (id, payload) => request(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteProject: (id) => request(`/projects/${id}`, { method: "DELETE" }),

  listShots: (projectId) => request(`/shots${projectId ? `?project_id=${projectId}` : ""}`),
  createShot: (payload) => request("/shots", { method: "POST", body: JSON.stringify(payload) }),
  updateShot: (id, payload) => request(`/shots/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  listAssets: (projectId) => request(`/assets${projectId ? `?project_id=${projectId}` : ""}`),
  uploadAsset: (formData) => request("/assets/upload", { method: "POST", body: formData }),
  updateAsset: (id, payload) => request(`/assets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  listTemplates: () => request("/prompt-templates"),
  createTemplate: (payload) => request("/prompt-templates", { method: "POST", body: JSON.stringify(payload) }),
  updateTemplate: (id, payload) => request(`/prompt-templates/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTemplate: (id) => request(`/prompt-templates/${id}`, { method: "DELETE" }),

  listTasks: (projectId) => request(`/tasks${projectId ? `?project_id=${projectId}` : ""}`),
  createImageTask: (payload) => request("/tasks/image", { method: "POST", body: JSON.stringify(payload) }),
  createVideoTask: (payload) => request("/tasks/video", { method: "POST", body: JSON.stringify(payload) }),
  retryTask: (id) => request(`/tasks/${id}/retry`, { method: "POST" }),
  cancelTask: (id) => request(`/tasks/${id}/cancel`, { method: "POST" }),
  listTaskLogs: (id) => request(`/tasks/${id}/logs`),
  listLogs: (taskId) => request(`/logs${taskId ? `?task_id=${taskId}` : ""}`),

  providers: () => request("/settings/providers"),
  runtime: () => request("/settings/runtime")
};
