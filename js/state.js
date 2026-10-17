// js/state.js - Estado Global Único y Persistencia
const STORAGE_KEY = "classroom_hub_config";
const USER_KEY = "classroom_hub_user";

const defaultConfig = {
  repoSlug: "jmrodev/daily-board",
  token: ""
};

export const state = {
  config: { ...defaultConfig, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") },
  user: JSON.parse(localStorage.getItem(USER_KEY) || "null"),
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
