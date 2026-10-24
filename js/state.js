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

// Override explícito: ?repo=owner/repo
function detectRepoFromQuery() {
  if (typeof window === "undefined" || !window.location) return "";
  const repoParam = new URLSearchParams(window.location.search).get("repo");
  return repoParam && repoParam.includes("/") ? repoParam.trim() : "";
}

// Sólo `*.github.io` permite derivar el slug de la URL. En un dominio propio
// (CNAME) no hay forma de saberlo: se configura en el modal o con ?repo=.
function detectRepoFromLocation() {
  if (typeof window === "undefined" || !window.location) return "";
  const host = window.location.hostname;
  if (!host.endsWith(".github.io")) return "";
  const owner = host.split(".")[0];
  // Sitio de usuario u organización: la URL es https://owner.github.io/ y el
  // repositorio real es owner/owner.github.io.
  const repo = window.location.pathname.split("/").filter(Boolean)[0] || `${owner}.github.io`;
  return owner && repo ? `${owner}/${repo}` : "";
}

function detectCurrentRepoSlug() {
  return detectRepoFromQuery() || detectRepoFromLocation();
}

const detectedSlug = detectCurrentRepoSlug();
const querySlug = detectRepoFromQuery();
const savedConfig = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

export const state = {
  config: {
    // Un ?repo= explícito gana sobre lo guardado: es el override documentado
    // para dominios propios y para mirar otro repositorio sin pisar la config.
    repoSlug: querySlug || savedConfig.repoSlug || detectedSlug,
    token: savedConfig.token || "",
    isCustomRepo: Boolean(savedConfig.repoSlug || querySlug)
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

export function saveUserSession(token, username, avatarUrl) {
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
