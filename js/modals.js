// js/modals.js - Manejo de diálogos y envíos hacia GitHub
import { state, saveConfig, clearToken, COLUMN_LABELS } from "./state.js";
import { githubRequest } from "./api.js";
import { loadKanban, renderKanban } from "./tabs/kanban.js";
import { loadDocs } from "./tabs/docs.js";

export function initModals(onAuthChanged) {
  // Modal Auth
  document.getElementById("authStatus").addEventListener("click", openAuthModal);
  document.getElementById("authModalForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const repoSlug = document.getElementById("cfgRepoSlug").value.trim();
    const token = document.getElementById("cfgUserToken").value.trim();
    saveConfig(repoSlug, token);
    document.getElementById("authModal").close();
    onAuthChanged();
  });

  document.getElementById("btnDisconnectAuth").addEventListener("click", () => {
    clearToken();
    document.getElementById("authModal").close();
    onAuthChanged();
  });

  // Modal Nueva Tarea
  document.getElementById("newIssueForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("newTitle").value.trim();
    const body = document.getElementById("newBody").value.trim();
    const column = document.getElementById("newColumn").value;

    const labels = [];
    if (COLUMN_LABELS[column]) labels.push(COLUMN_LABELS[column]);

    try {
      const nuevo = await githubRequest("/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, labels })
      });
      state.issues.unshift(nuevo);
      renderKanban();
      document.getElementById("newIssueModal").close();
      document.getElementById("newTitle").value = "";
      document.getElementById("newBody").value = "";
    } catch (err) {
      alert("Error al crear issue: " + err.message);
    }
  });

  // Modal Nuevo Doc
  document.getElementById("newDocForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    let filename = document.getElementById("newDocFilename").value.trim();
    if (!filename.endsWith(".md")) filename += ".md";

    const content = document.getElementById("newDocContent").value;
    const b64Content = btoa(unescape(encodeURIComponent(content)));

    try {
      await githubRequest(`/contents/docs/${filename}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `docs: agregar ${filename} desde Classroom Hub`,
          content: b64Content
        })
      });
      document.getElementById("newDocModal").close();
      document.getElementById("newDocFilename").value = "";
      document.getElementById("newDocContent").value = "";
      loadDocs();
    } catch (err) {
      alert("Error al guardar documento en GitHub: " + err.message);
    }
  });
}

export function openAuthModal() {
  document.getElementById("cfgRepoSlug").value = state.config.repoSlug;
  document.getElementById("cfgUserToken").value = state.config.token;
  document.getElementById("authModal").showModal();
}

export function openNewIssueModal() {
  if (!state.config.token) {
    alert("Para crear un issue en GitHub necesitás conectar tu Token.");
    openAuthModal();
    return;
  }
  document.getElementById("newIssueModal").showModal();
}

export function openNewDocModal() {
  if (!state.config.token) {
    alert("Para crear un documento en GitHub necesitás conectar tu Token.");
    openAuthModal();
    return;
  }
  document.getElementById("newDocModal").showModal();
}
