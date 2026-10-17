// js/main.js - Orquestador y punto de entrada modular
import { state } from "./state.js";
import { loadKanban, handleDrop } from "./tabs/kanban.js";
import { loadDocs } from "./tabs/docs.js";
import { loadDailies } from "./tabs/dailies.js";
import { loadSprints } from "./tabs/sprints.js";
import { loadActivity } from "./tabs/activity.js";
import { initModals, openNewIssueModal, openNewDocModal, openNewDailyModal } from "./modals.js";

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
    if (state.currentTab === "dailies") openNewDailyModal();
  });

  // Filtros del Tablero Kanban
  const btnMyTasks = document.getElementById("btnFilterMyTasks");
  if (btnMyTasks) {
    btnMyTasks.addEventListener("click", () => {
      if (!state.user) {
        alert("Iniciá sesión primero para ver tus tareas.");
        return;
      }
      state.filters.onlyMine = !state.filters.onlyMine;
      btnMyTasks.classList.toggle("active", state.filters.onlyMine);
      import("./tabs/kanban.js").then(m => m.renderKanban());
    });
  }

  const selectAssignee = document.getElementById("selectFilterAssignee");
  if (selectAssignee) {
    selectAssignee.addEventListener("change", (e) => {
      state.filters.assignee = e.target.value;
      import("./tabs/kanban.js").then(m => m.renderKanban());
    });
  }

  const inputSearch = document.getElementById("inputSearchTasks");
  if (inputSearch) {
    inputSearch.addEventListener("input", (e) => {
      state.filters.search = e.target.value.trim();
      import("./tabs/kanban.js").then(m => m.renderKanban());
    });
  }
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
  } else if (tabKey === "dailies") {
    btnAccion.style.display = "inline-block";
    btnAccion.textContent = "➕ Registrar mi Daily";
    loadDailies();
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
  const btn = document.getElementById("authBtn");
  const dot = document.getElementById("authDot");
  const label = document.getElementById("authLabel");

  if (state.user && state.user.username) {
    btn.classList.add("logged-in");
    dot.style.display = "inline-block";
    label.innerHTML = `
      <img src="${state.user.avatarUrl}" width="18" height="18" style="border-radius: 50%; vertical-align: middle; margin-right: 4px;">
      <strong>@${state.user.username}</strong>
    `;
    btn.title = `Conectado como @${state.user.username}. Click para opciones.`;
  } else if (state.config.token) {
    btn.classList.add("logged-in");
    dot.style.display = "inline-block";
    label.textContent = "Conectado";
    btn.title = "Token configurado. Click para opciones.";
  } else {
    btn.classList.remove("logged-in");
    dot.style.display = "none";
    label.textContent = "🔑 Iniciar sesión";
    btn.title = "Click para iniciar sesión con GitHub";
  }
}

function handleAuthChanged() {
  renderAuthBadge();
  switchTab(state.currentTab);
}
