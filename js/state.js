// js/state.js - Estado Global Único y Persistencia aislada por repositorio
function getStorageNamespace() {
  if (typeof window !== "undefined" && window.location) {
    const path = window.location.pathname.replace(/\/$/, "");
    return path ? `_${path.replace(/[^a-zA-Z0-9]/g, "_")}` : "";
  }
  return "";
}

const STORAGE_KEY = `classroom_hub_config${getStorageNamespace()}`;
const USER_KEY = `classroom_hub_user${getStorageNamespace()}`;

function detectCurrentRepoSlug() {
  if (typeof window !== "undefined" && window.location) {
    const host = window.location.hostname;
    // Si corre en username.github.io/reponame/
    if (host.endsWith(".github.io")) {
      const owner = host.split(".")[0];
      const repo = window.location.pathname.split("/").filter(Boolean)[0];
      if (owner && repo) {
        return `${owner}/${repo}`;
      }
    }
  }
  return "jmrodev/daily-board";
}

const detectedSlug = detectCurrentRepoSlug();
const savedConfig = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

export const state = {
  config: {
    repoSlug: savedConfig.repoSlug || detectedSlug,
    token: savedConfig.token || ""
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

export const COLUMN_LABELS = {
  todo: "status:todo",
  progress: "status:in-progress",
  blocked: "status:blocked",
  done: "status:done"
};

export function saveConfig(repoSlug, token, username, avatarUrl) {
  state.config.repoSlug = repoSlug || defaultConfig.repoSlug;
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
