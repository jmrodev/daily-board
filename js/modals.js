// js/modals.js - Manejo de diálogos, autenticación y envíos
import { state, saveConfig, clearUserSession, COLUMN_LABELS, escapeHtml } from "./state.js";
import { githubRequest } from "./api.js";
import { loadKanban, renderKanban } from "./tabs/kanban.js";
import { loadDocs } from "./tabs/docs.js";
import { loadDailies } from "./tabs/dailies.js";
import { showToast } from "./toast.js";

export function initModals(onAuthChanged) {
  // Click en botón clásico de auth arriba a la derecha
  document.getElementById("authBtn").addEventListener("click", openAuthModal);

  // Guardar Token y validar contra GitHub
  document.getElementById("authModalForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const repoSlug = document.getElementById("cfgRepoSlug").value.trim();
    const token = document.getElementById("cfgUserToken").value.trim();

    if (!token) {
      showToast("Por favor ingresá tu Token para iniciar sesión.", "warning");
      return;
    }

    try {
      // Validar el token contra GitHub /user
      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${token}`
        }
      });

      if (!userRes.ok) {
        throw new Error("El token ingresado no es válido o no tiene permisos.");
      }

      const userData = await userRes.json();
      saveConfig(repoSlug, token, userData.login, userData.avatar_url);
      document.getElementById("authModal").close();
      showToast(`¡Sesión iniciada como @${userData.login}!`, "success");
      onAuthChanged();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Botón Cerrar Sesión
  document.getElementById("btnDisconnectAuth").addEventListener("click", () => {
    clearUserSession();
    document.getElementById("authModal").close();
    showToast("Sesión cerrada correctamente", "info");
    onAuthChanged();
  });

  // Modal Nueva Tarea (Issue)
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
      showToast(`Tarea #${nuevo.number} creada en GitHub`, "success");
    } catch (err) {
      showToast("Error al crear issue: " + err.message, "error");
    }
  });

  // Modal Nuevo Doc (/docs)
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
          message: `docs: agregar ${filename} desde Project Hub`,
          content: b64Content
        })
      });
      document.getElementById("newDocModal").close();
      document.getElementById("newDocFilename").value = "";
      document.getElementById("newDocContent").value = "";
      showToast(`Documento ${filename} guardado en /docs`, "success");
      loadDocs();
    } catch (err) {
      showToast("Error al guardar documento en GitHub: " + err.message, "error");
    }
  });

  // Modal Registrar Daily (/dailies/YYYY-MM-DD/usuario.md)
  document.getElementById("newDailyForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const dateStr = document.getElementById("dailyDateInput").value;
    const qAyer = document.getElementById("dailyDone").value.trim();
    const qHoy = document.getElementById("dailyPlan").value.trim();
    const qBloqueo = document.getElementById("dailyBlocker").value.trim() || "Ninguno";

    const username = (state.user && state.user.username) ? state.user.username : "anonimo";
    const author = `@${username}`;
    const filename = `${username}.md`;
    const path = `dailies/${dateStr}/${filename}`;

    const reportContent = `# Daily Scrum · ${dateStr}
**Autor:** ${author}
**Fecha:** ${new Date().toLocaleDateString("es-AR")}

---

### 1. ¿Qué hiciste ayer?
${qAyer}

### 2. ¿Qué tenés pensado hacer hoy?
${qHoy}

### 3. ¿Tenés algún bloqueo o impedimento?
${qBloqueo}
`;

    try {
      let sha = null;
      try {
        const fileData = await githubRequest(`/contents/${path}`);
        sha = fileData.sha;
      } catch {
        // No existe todavía, se crea limpio
      }

      const b64Content = btoa(unescape(encodeURIComponent(reportContent)));

      const bodyPayload = {
        message: `daily: reporte individual de ${author} (${dateStr})`,
        content: b64Content
      };
      if (sha) bodyPayload.sha = sha;

      await githubRequest(`/contents/${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });

      document.getElementById("newDailyModal").close();
      document.getElementById("dailyDone").value = "";
      document.getElementById("dailyPlan").value = "";
      document.getElementById("dailyBlocker").value = "";
      showToast("Reporte diario guardado correctamente", "success");
      loadDailies();
    } catch (err) {
      showToast("Error al registrar daily: " + err.message, "error");
    }
  });

  // Enviar Nuevo Comentario en el Issue
  const commentForm = document.getElementById("newCommentForm");
  if (commentForm) {
    commentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.config.token) {
        showToast("Para comentar necesitás conectar tu token.", "warning");
        openAuthModal();
        return;
      }

      const issueNum = document.getElementById("commentIssueNumber").value;
      const body = document.getElementById("commentBodyInput").value.trim();
      const btn = document.getElementById("btnSendComment");
      btn.disabled = true;
      btn.textContent = "Enviando...";

      try {
        await githubRequest(`/issues/${issueNum}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body })
        });
        document.getElementById("commentBodyInput").value = "";
        showToast("Comentario enviado a GitHub", "success");
        window.openIssueComments(issueNum); // Recargar comentarios
        loadKanban(); // Actualizar contador en la tarjeta
      } catch (err) {
        showToast("Error al enviar comentario: " + err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "💬 Enviar a GitHub";
      }
    });
  }
}

// Función global para abrir modal de comentarios de un issue
window.openIssueComments = async function (issueNumber) {
  const issue = state.issues.find(i => i.number === parseInt(issueNumber, 10));
  const titleEl = document.getElementById("commentsModalTitle");
  const subEl = document.getElementById("commentsModalSubtitle");
  const timeline = document.getElementById("commentsTimeline");
  document.getElementById("commentIssueNumber").value = issueNumber;

  if (issue) {
    titleEl.textContent = `💬 Issue #${issue.number}: ${issue.title}`;
    subEl.textContent = `Abierto por @${issue.user.login} · ${issue.comments} comentarios`;
  }

  timeline.innerHTML = `<p class="loading">Cargando comentarios desde GitHub...</p>`;
  document.getElementById("issueCommentsModal").showModal();

  try {
    const comments = await githubRequest(`/issues/${issueNumber}/comments`);
    if (!comments.length) {
      timeline.innerHTML = `<p class="placeholder-text">Aún no hay comentarios en este issue. ¡Sé el primero en comentar!</p>`;
      return;
    }

    timeline.innerHTML = comments.map(c => `
      <div class="comment-bubble">
        <div class="comment-bubble-head">
          <img src="${c.user.avatar_url}" width="20" height="20" style="border-radius: 50%;">
          <strong>@${escapeHtml(c.user.login)}</strong>
          <span style="color: var(--text-muted); font-size: 0.75rem;">${new Date(c.created_at).toLocaleString()}</span>
        </div>
        <div class="comment-bubble-body markdown-body">
          ${window.marked ? window.marked.parse(c.body) : escapeHtml(c.body)}
        </div>
      </div>
    `).join("");
  } catch (err) {
    timeline.innerHTML = `<p style="color: var(--blocked);">Error al cargar comentarios: ${err.message}</p>`;
  }
};

export function openAuthModal() {
  document.getElementById("cfgRepoSlug").value = state.config.repoSlug;
  document.getElementById("cfgUserToken").value = state.config.token || "";
  document.getElementById("authModal").showModal();
}

export function openNewIssueModal() {
  if (!state.config.token) {
    showToast("Para crear un issue primero iniciá sesión con tu Token de GitHub.", "warning");
    openAuthModal();
    return;
  }
  document.getElementById("newIssueModal").showModal();
}

export function openNewDocModal() {
  if (!state.config.token) {
    showToast("Para crear un documento primero iniciá sesión con tu Token de GitHub.", "warning");
    openAuthModal();
    return;
  }
  document.getElementById("newDocModal").showModal();
}

export function openNewDailyModal() {
  if (!state.config.token) {
    showToast("Para registrar tu Daily primero iniciá sesión con tu Token de GitHub.", "warning");
    openAuthModal();
    return;
  }
  const hoy = new Date().toISOString().split("T")[0];
  document.getElementById("dailyDateInput").value = hoy;
  document.getElementById("newDailyModal").showModal();
}
