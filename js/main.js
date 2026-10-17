// js/main.js - Orquestador y punto de entrada modular
import { state } from "./state.js";
import { loadKanban, renderKanban } from "./tabs/kanban/kanban.js";
import { handleDrop } from "./tabs/kanban/drag.js";
import { loadChannels, getActiveChannel, loadChannelMessages } from "./tabs/channels/channels.js";
import { loadDocs } from "./tabs/docs/docs.js";
import { loadDailies } from "./tabs/dailies/dailies.js";
import { loadSprints } from "./tabs/sprints/sprints.js";
import { loadActivity } from "./tabs/activity/activity.js";
import { initModals, openNewIssueModal, openNewDocModal, openNewDailyModal } from "./modals.js";
import { showToast } from "./toast.js";

// Inicialización de la aplicación
document.addEventListener("DOMContentLoaded", () => {
  renderAuthBadge();
  setupNavigation();
  setupDragAndDrop();
  setupChannelComposer();
  initModals(handleAuthChanged);

  // Cargar solapa inicial (Canales / Novedades como página principal)
  switchTab("channels");

  // Polling pasivo cada 60 segundos (solo si la ventana del navegador está visible)
  setInterval(() => {
    if (document.visibilityState === "visible") {
      // Refrescar datos en segundo plano sin interrumpir lo que el usuario esté escribiendo
      if (state.currentTab === "kanban") {
        loadKanban();
      } else if (state.currentTab === "channels") {
        loadChannelMessages(getActiveChannel());
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
    if (state.currentTab === "channels") {
      const input = document.getElementById("channelInputBody");
      if (input) input.focus();
    }
    if (state.currentTab === "docs") openNewDocModal();
    if (state.currentTab === "dailies") openNewDailyModal();
    if (state.currentTab === "sprints") import("./modals.js").then(m => m.openNewMilestoneModal());
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
      renderKanban();
    });
  }

  const inputSearch = document.getElementById("inputSearchTasks");
  if (inputSearch) {
    inputSearch.addEventListener("input", (e) => {
      state.filters.search = e.target.value.trim();
      renderKanban();
    });
  }
}

function setupChannelComposer() {
  const form = document.getElementById("channelPostForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("channelInputBody");
    const message = input.value.trim();
    if (!message) return;

    if (!state.config.token) {
      showToast("Conectá tu Token de GitHub para escribir en los canales.", "warning");
      import("./modals.js").then(m => m.openAuthModal());
      return;
    }

    const username = (state.user && state.user.username) ? state.user.username : "anonimo";
    const author = `@${username}`;
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const dateFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const fileTimestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    
    const channelId = getActiveChannel();
    const filename = `${fileTimestamp}-${username}.md`;
    const path = `canales/${channelId}/${filename}`;

    const mdContent = `**Autor:** ${author}
**Fecha:** ${dateFormatted}

---

${message}
`;

    const btnSubmit = document.getElementById("btnSendChannelMessage");
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Enviando...";

    try {
      const b64Content = btoa(unescape(encodeURIComponent(mdContent)));
      const bodyPayload = {
        message: `chat(${channelId}): mensaje de ${author}`,
        content: b64Content,
        branch: "gh-pages"
      };

      const { githubRequest } = await import("./api.js");
      await githubRequest(`/contents/${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });

      input.value = "";
      showToast("Mensaje publicado en #" + channelId, "success");
      await loadChannelMessages(channelId);
    } catch (err) {
      showToast("Error al publicar mensaje: " + err.message, "error");
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "💬 Publicar Mensaje";
    }
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
  } else if (tabKey === "channels") {
    btnAccion.style.display = "inline-block";
    btnAccion.textContent = "✍️ Escribir Mensaje";
    loadChannels();
  } else if (tabKey === "docs") {
    btnAccion.style.display = "inline-block";
    btnAccion.textContent = "➕ Nuevo Doc";
    loadDocs();
  } else if (tabKey === "dailies") {
    btnAccion.style.display = "inline-block";
    btnAccion.textContent = "➕ Registrar mi Daily";
    loadDailies();
  } else if (tabKey === "sprints") {
    btnAccion.style.display = "inline-block";
    btnAccion.textContent = "➕ Nuevo Sprint";
    loadSprints();
  } else {
    btnAccion.style.display = "none";
    if (tabKey === "activity") loadActivity();
  }
}

function setupDragAndDrop() {
  const dropZones = [
    { colId: "col-todo", key: "todo" },
    { colId: "col-progress", key: "progress" },
    { colId: "col-blocked", key: "blocked" },
    { colId: "col-done", key: "done" }
  ];

  dropZones.forEach(({ colId, key }) => {
    const colEl = document.getElementById(colId);
    if (!colEl) return;

    colEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      colEl.classList.add("drag-over");
    });

    colEl.addEventListener("dragleave", (e) => {
      // Solo quitar la clase si el puntero realmente salió de la columna
      if (!colEl.contains(e.relatedTarget)) {
        colEl.classList.remove("drag-over");
      }
    });

    colEl.addEventListener("drop", (e) => {
      e.preventDefault();
      colEl.classList.remove("drag-over");
      handleDrop(e, key);
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
