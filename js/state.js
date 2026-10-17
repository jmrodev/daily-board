// js/state.js - Estado Global Único y Persistencia
const STORAGE_KEY = "classroom_hub_config";

const defaultConfig = {
  repoSlug: "jmrodev/daily-board",
  token: ""
};

export const state = {
  config: { ...defaultConfig, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") },
  currentTab: "kanban",
  issues: [],
  docs: [],
  milestones: [],
  commits: []
};

export const COLUMN_LABELS = {
  todo: "status:todo",
  progress: "status:in-progress",
  blocked: "status:blocked",
  done: "status:done"
};

export function saveConfig(repoSlug, token) {
  state.config.repoSlug = repoSlug || defaultConfig.repoSlug;
  state.config.token = token || "";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
}

export function clearToken() {
  state.config.token = "";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
}

export function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
