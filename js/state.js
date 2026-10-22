// js/state.js - Estado Global Único y Persistencia aislada por repositorio
function getStorageNamespace() {
  if (typeof window !== "undefined" && window.location) {
    const path = window.location.pathname.replace(/\/$/, "");
    return path ? `_${path.replace(/[^a-zA-Z0-9]/g, "_")}` : "";
  }
  return "";
}

const STORAGE_KEY = `project_hub_config${getStorageNamespace()}`;
const USER_KEY = `project_hub_user${getStorageNamespace()}`;

function detectCurrentRepoSlug() {
  if (typeof window !== "undefined" && window.location) {
    // 1. Soporte prioritario vía query string: ?repo=owner/repo
    const params = new URLSearchParams(window.location.search);
    const repoParam = params.get("repo");
    if (repoParam && repoParam.includes("/")) {
      return repoParam.trim();
    }

    // 2. Si corre en username.github.io/reponame/
    const host = window.location.hostname;
    if (host.endsWith(".github.io")) {
      const owner = host.split(".")[0];
      const repo = window.location.pathname.split("/").filter(Boolean)[0];
      if (owner && repo) {
        return `${owner}/${repo}`;
      }
    }
  }
  return "";
}

const detectedSlug = detectCurrentRepoSlug();
const savedConfig = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

export const state = {
  config: {
    repoSlug: savedConfig.repoSlug || detectedSlug,
    token: savedConfig.token || "",
    isCustomRepo: Boolean(savedConfig.repoSlug)
  },
  user: JSON.parse(localStorage.getItem(USER_KEY) || "null"),
  currentTab: "kanban",
  issues: [],
  pullRequests: [],
  docs: [],
  milestones: [],
  commits: [],
  filters: {
    assignee: "all",
    search: "",
    onlyMine: false
  }
};

export async function autoResolveUpstreamRepo() {
  // Si el usuario ya configuró un repo manualmente, respetamos su decisión
  if (state.config.isCustomRepo) return;

  const currentSlug = state.config.repoSlug;
  const headers = { "Accept": "application/vnd.github+json" };
  if (state.config.token) headers["Authorization"] = `Bearer ${state.config.token}`;

  try {
    const res = await fetch(`https://api.github.com/repos/${currentSlug}`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    if (data.fork && data.parent && data.parent.full_name) {
      console.log(`[AutoResolve] Fork detectado: ${currentSlug} -> Upstream: ${data.parent.full_name}`);
      state.config.repoSlug = data.parent.full_name;
      // Guardar para que quede cacheado
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
    }
  } catch (err) {
    console.warn("[AutoResolve] No se pudo verificar fork:", err);
  }
}

export const COLUMN_LABELS = {
  todo: "status:todo",
  progress: "status:in-progress",
  blocked: "status:blocked",
  done: "status:done"
};

export function saveConfig(repoSlug, token, username, avatarUrl) {
  state.config.repoSlug = repoSlug || detectedSlug;
  state.config.isCustomRepo = true;
  if (token !== undefined) state.config.token = token;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));

  if (username) {
    state.user = { username, avatarUrl };
    localStorage.setItem(USER_KEY, JSON.stringify(state.user));
  }
}

export function clearUserSession() {
  state.config.token = "";
  state.user = null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
  localStorage.removeItem(USER_KEY);
}

export function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
