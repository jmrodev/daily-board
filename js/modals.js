// js/modals.js - Manejo de diálogos, autenticación y envíos
import { state, saveConfig, clearUserSession, COLUMN_LABELS } from "./state.js";
import { githubRequest } from "./api.js";
import { iniciarLoginGitHub, cancelarLogin } from "./auth.js";
import { loadKanban, renderKanban } from "./tabs/kanban.js";
import { loadDocs } from "./tabs/docs.js";

export function initModals(onAuthChanged) {
  // Click en badge de estado de auth
  document.getElementById("authStatus").addEventListener("click", openAuthModal);

  // Botón iniciar flujo OAuth Device
  document.getElementById("btnIniciarOAuth").addEventListener("click", () => {
    const viewDefault = document.getElementById("authViewDefault");
    const viewDevice = document.getElementById("authViewDevice");

    viewDefault.style.display = "none";
    viewDevice.style.display = "block";

    iniciarLoginGitHub(
      ({ userCode, verificationUri }) => {
        document.getElementById("deviceUserCode").textContent = userCode;
        const linkBtn = document.getElementById("btnAbrirGitHubDevice");
        linkBtn.href = verificationUri;
      },
      (userProfile) => {
        viewDevice.style.display = "none";
        viewDefault.style.display = "block";
        document.getElementById("authModal").close();
        onAuthChanged();
      },
      (errMsg) => {
        alert("Error de autenticación: " + errMsg);
        viewDevice.style.display = "none";
        viewDefault.style.display = "block";
      }
    );
  });

  // Cancelar Device flow
  document.getElementById("btnCancelarDevice").addEventListener("click", () => {
    cancelarLogin();
    document.getElementById("authViewDevice").style.display = "none";
    document.getElementById("authViewDefault").style.display = "block";
  });

  // Guardar configuración manual de repo o PAT de emergencia
  document.getElementById("authModalForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const repoSlug = document.getElementById("cfgRepoSlug").value.trim();
    const manualToken = document.getElementById("cfgUserToken").value.trim();
    saveConfig(repoSlug, manualToken || undefined);
    document.getElementById("authModal").close();
    onAuthChanged();
  });

  // Botón Cerrar Sesión
  document.getElementById("btnDisconnectAuth").addEventListener("click", () => {
    clearUserSession();
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
  document.getElementById("authViewDevice").style.display = "none";
  document.getElementById("authViewDefault").style.display = "block";
  document.getElementById("authModal").showModal();
}

export function openNewIssueModal() {
  if (!state.config.token) {
    alert("Para crear un issue en GitHub primero iniciá sesión con GitHub.");
    openAuthModal();
    return;
  }
  document.getElementById("newIssueModal").showModal();
}

export function openNewDocModal() {
  if (!state.config.token) {
    alert("Para crear un documento en GitHub primero iniciá sesión con GitHub.");
    openAuthModal();
    return;
  }
  document.getElementById("newDocModal").showModal();
}
