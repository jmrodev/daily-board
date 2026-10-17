// js/main.js - Orquestador y punto de entrada modular
import { state } from "./state.js";
import { loadKanban, handleDrop } from "./tabs/kanban.js";
import { loadDocs } from "./tabs/docs.js";
import { loadDailies } from "./tabs/dailies.js";
import { loadSprints } from "./tabs/sprints.js";
import { loadActivity } from "./tabs/activity.js";
import { initModals, openNewIssueModal, openNewDocModal, openNewDailyModal } from "./modals.js";
import { showToast } from "./toast.js";

// Inicialización de la aplicación
document.addEventListener("DOMContentLoaded", () => {
  renderAuthBadge();
  setupNavigation();
  setupDragAndDrop();
  initModals(handleAuthChanged);

  // Cargar solapa inicial
  switchTab("kanban");

  // Polling pasivo cada 60 segundos (solo si la ventana del navegador está visible)
  setInterval(() => {
    if (document.visibilityState === "visible") {
      // Refrescar datos en segundo plano sin interrumpir lo que el usuario esté escribiendo
      if (state.currentTab === "kanban") {
        loadKanban();
      }
    }
  }, 60000);
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

  // Filtro unificado de Usuario (Todos / Mis tareas / Sin asignar / Compañeros)
  const selectUser = document.getElementById("selectFilterUser");
  if (selectUser) {
    selectUser.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "mine" && !state.user) {
        showToast("Iniciá sesión primero para ver tus tareas.", "info");
        import("./modals.js").then(m => m.openAuthModal());
        selectUser.value = "all";
        state.filters.assignee = "all";
      } else {
        state.filters.assignee = val;
      }
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
    { colId: "col-todo", listId: "list-todo", key: "todo" },
    { colId: "col-progress", listId: "list-progress", key: "progress" },
    { colId: "col-blocked", listId: "list-blocked", key: "blocked" },
    { colId: "col-done", listId: "list-done", key: "done" }
  ];

  dropZones.forEach(({ colId, listId, key }) => {
    const colEl = document.getElementById(colId);
    const listEl = document.getElementById(listId);

    [colEl, listEl].forEach(target => {
      if (!target) return;
      target.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = key === "done" ? "none" : "move";
        if (colEl) colEl.classList.add("drag-over");
      });
      target.addEventListener("dragleave", () => {
        if (colEl) colEl.classList.remove("drag-over");
      });
      target.addEventListener("drop", (e) => {
        if (colEl) colEl.classList.remove("drag-over");
        handleDrop(e, key);
      });
    });
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
