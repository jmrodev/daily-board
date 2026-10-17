// js/main.js - Orquestador y punto de entrada modular
import { state } from "./state.js";
import { loadKanban, handleDrop } from "./tabs/kanban.js";
import { loadDocs } from "./tabs/docs.js";
import { loadSprints } from "./tabs/sprints.js";
import { loadActivity } from "./tabs/activity.js";
import { initModals, openNewIssueModal, openNewDocModal } from "./modals.js";

// Inicialización de la aplicación
document.addEventListener("DOMContentLoaded", () => {
  renderAuthBadge();
  setupNavigation();
  setupDragAndDrop();
  initModals(handleAuthChanged);

  // Cargar solapa inicial
  switchTab("kanban");
});

function setupNavigation() {
  document.querySelectorAll(".nav-tab").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.getElementById("btnRefresh").addEventListener("click", () => switchTab(state.currentTab));

  document.getElementById("btnNuevaAccion").addEventListener("click", () => {
    if (state.currentTab === "kanban") openNewIssueModal();
    if (state.currentTab === "docs") openNewDocModal();
  });
}

export function switchTab(tabKey) {
  state.currentTab = tabKey;

  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === tabKey);
  });

  document.querySelectorAll(".tab-content").forEach(content => {
    content.classList.toggle("active", content.id === `tab-${tabKey}`);
  });

  const btnAccion = document.getElementById("btnNuevaAccion");
  if (tabKey === "kanban") {
    btnAccion.style.display = "inline-block";
    btnAccion.textContent = "➕ Nueva Tarea";
    loadKanban();
  } else if (tabKey === "docs") {
    btnAccion.style.display = "inline-block";
    btnAccion.textContent = "➕ Nuevo Doc";
    loadDocs();
  } else {
    btnAccion.style.display = "none";
    if (tabKey === "sprints") loadSprints();
    if (tabKey === "activity") loadActivity();
  }
}

function setupDragAndDrop() {
  const dropZones = [
    { id: "col-todo", key: "todo" },
    { id: "col-progress", key: "progress" },
    { id: "col-blocked", key: "blocked" },
    { id: "col-done", key: "done" }
  ];

  dropZones.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("dragover", (e) => e.preventDefault());
    el.addEventListener("drop", (e) => handleDrop(e, key));
  });
}

function renderAuthBadge() {
  document.getElementById("repoSubtitle").textContent = state.config.repoSlug;
  const dot = document.getElementById("authDot");
  const label = document.getElementById("authLabel");

  if (state.user && state.user.username) {
    dot.classList.add("active");
    label.innerHTML = `
      <img src="${state.user.avatarUrl}" width="16" height="16" style="border-radius: 50%; vertical-align: middle; margin-right: 4px;">
      @${state.user.username}
    `;
  } else if (state.config.token) {
    dot.classList.add("active");
    label.textContent = "Conectado";
  } else {
    dot.classList.remove("active");
    label.textContent = "Iniciar sesión";
  }
}

function handleAuthChanged() {
  renderAuthBadge();
  switchTab(state.currentTab);
}
