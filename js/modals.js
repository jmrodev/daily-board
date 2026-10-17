// js/modals.js - Manejo de diálogos, autenticación y envíos
import { state, saveConfig, clearUserSession, COLUMN_LABELS, escapeHtml } from "./state.js";
import { githubRequest } from "./api.js";
import { loadKanban, renderKanban } from "./tabs/kanban/kanban.js";
import { loadDocs } from "./tabs/docs/docs.js";
import { loadDailies } from "./tabs/dailies/dailies.js";
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
  const newIssueForm = document.getElementById("newIssueForm");
  let isCreatingIssue = false;

  newIssueForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isCreatingIssue) return;

    const title = document.getElementById("newTitle").value.trim();
    const body = document.getElementById("newBody").value.trim();
    const column = document.getElementById("newColumn").value;
    const milestoneChoice = document.getElementById("newIssueMilestone").value;

    const labels = [];
    if (COLUMN_LABELS[column]) labels.push(COLUMN_LABELS[column]);

    const payload = { title, body, labels };

    // Si eligió Sprint en curso (o un milestone específico)
    if (milestoneChoice === "current") {
      const currentSprint = (state.milestones || []).find(m => m.state === "open");
      if (currentSprint) {
        payload.milestone = currentSprint.number;
      }
    } else if (milestoneChoice !== "none") {
      const msNum = parseInt(milestoneChoice, 10);
      if (!isNaN(msNum)) payload.milestone = msNum;
    }

    const btnSubmit = document.getElementById("btnSubmitNewIssue");
    isCreatingIssue = true;
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = "Creando tarea...";
    }

    try {
      const nuevo = await githubRequest("/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      state.issues.unshift(nuevo);
      renderKanban();
      document.getElementById("newIssueModal").close();
      document.getElementById("newTitle").value = "";
      document.getElementById("newBody").value = "";
      showToast(`Tarea #${nuevo.number} creada en GitHub`, "success");
    } catch (err) {
      showToast("Error al crear issue: " + err.message, "error");
    } finally {
      isCreatingIssue = false;
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "📌 Crear Tarea";
      }
    }
  });

  // Modal Nuevo Sprint / Milestone
  // Modal Nuevo Sprint / Milestone
  const milestoneForm = document.getElementById("newMilestoneForm");
  let isCreatingMilestone = false;
  if (milestoneForm) {
    milestoneForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isCreatingMilestone) return;

      const title = document.getElementById("newMilestoneTitle").value.trim();
      const dueOn = document.getElementById("newMilestoneDue").value;
      const description = document.getElementById("newMilestoneDesc").value.trim();

      const payload = { title, description, state: "open" };
      if (dueOn) {
        // Formato ISO requerido por GitHub: YYYY-MM-DDTHH:MM:SSZ
        payload.due_on = new Date(`${dueOn}T23:59:59Z`).toISOString();
      }

      const btnSubmit = document.getElementById("btnSubmitNewMilestone");
      isCreatingMilestone = true;
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Creando Sprint...";
      }

      try {
        await githubRequest("/milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        document.getElementById("newMilestoneModal").close();
        document.getElementById("newMilestoneTitle").value = "";
        document.getElementById("newMilestoneDue").value = "";
        document.getElementById("newMilestoneDesc").value = "";
        showToast(`Sprint "${title}" creado exitosamente`, "success");
        import("./tabs/sprints/sprints.js").then(m => m.loadSprints());
        loadKanban();
      } catch (err) {
        showToast("Error al crear Sprint en GitHub: " + err.message, "error");
      } finally {
        isCreatingMilestone = false;
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = "🎯 Crear Sprint";
        }
      }
    });
  }

  // Modal Nuevo Doc (/docs)
  const docForm = document.getElementById("newDocForm");
  let isCreatingDoc = false;
  if (docForm) {
    docForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isCreatingDoc) return;

      let filename = document.getElementById("newDocFilename").value.trim();
      if (!filename.endsWith(".md")) filename += ".md";

      const content = document.getElementById("newDocContent").value;
      const b64Content = btoa(unescape(encodeURIComponent(content)));

      const btnSubmit = document.getElementById("btnSubmitNewDoc");
      isCreatingDoc = true;
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Guardando...";
      }

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
      } finally {
        isCreatingDoc = false;
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = "💾 Guardar Documento";
        }
      }
    });
  }

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
        const fileData = await githubRequest(`/contents/${path}?ref=gh-pages`);
        sha = fileData.sha;
      } catch {
        // No existe todavía, se crea limpio
      }

      const b64Content = btoa(unescape(encodeURIComponent(reportContent)));

      const bodyPayload = {
        message: `daily: reporte individual de ${author} (${dateStr})`,
        content: b64Content,
        branch: "gh-pages"
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
  const commentInput = document.getElementById("commentBodyInput");
  const btnCommentLink = document.getElementById("btnInsertCommentLink");
  const commentFileInput = document.getElementById("commentFileInput");
  const commentUploadIndicator = document.getElementById("commentUploadingIndicator");

  // Asistente para insertar enlaces en comentarios
  if (btnCommentLink && commentInput) {
    btnCommentLink.addEventListener("click", () => {
      let url = prompt("Pegá la URL del enlace (ej: https://... o dominio.com):");
      if (!url) return;
      url = url.trim();
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) && !url.startsWith("/") && !url.startsWith("#")) {
        url = `https://${url}`;
      }
      const text = prompt("Texto para mostrar del enlace (ej: Ver documentación):", "Enlace") || url;
      const mdLink = `[${text}](${url})`;
      
      const start = commentInput.selectionStart || 0;
      const end = commentInput.selectionEnd || 0;
      commentInput.value = commentInput.value.substring(0, start) + mdLink + commentInput.value.substring(end);
      commentInput.focus();
    });
  }

  // Subida de archivos adjuntos en comentarios de issues
  if (commentFileInput && commentInput) {
    commentFileInput.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!state.config.token) {
        showToast("Conectá tu Token de GitHub para subir archivos.", "warning");
        openAuthModal();
        commentFileInput.value = "";
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        showToast("El archivo es demasiado grande (máx 10 MB)", "error");
        commentFileInput.value = "";
        return;
      }

      if (commentUploadIndicator) commentUploadIndicator.style.display = "inline";

      try {
        const username = (state.user && state.user.username) ? state.user.username : "anonimo";
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const timestamp = Date.now();
        const storedFilename = `${timestamp}-${cleanName}`;
        const filePath = `adjuntos/canales/${storedFilename}`;

        const buffer = await file.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64Content = btoa(binary);

        await githubRequest(`/contents/${filePath}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `upload: adjunto ${cleanName} de @${username} en issue`,
            content: b64Content,
            branch: "gh-pages"
          })
        });

        const isImage = file.type.startsWith("image/");
        const fileUrl = `https://raw.githubusercontent.com/${state.config.repoSlug}/gh-pages/${filePath}`;

        let markdownSnippet = "";
        if (isImage) {
          markdownSnippet = `\n\n![${cleanName}](${fileUrl})\n`;
        } else {
          markdownSnippet = `\n\n📎 [Descargar ${cleanName}](${fileUrl})\n`;
        }

        commentInput.value += markdownSnippet;
        commentInput.focus();
        showToast(`Archivo "${cleanName}" adjuntado al comentario`, "success");
      } catch (err) {
        showToast("Error al subir archivo a GitHub: " + err.message, "error");
      } finally {
        if (commentUploadIndicator) commentUploadIndicator.style.display = "none";
        commentFileInput.value = "";
      }
    });
  }

  if (commentForm) {
    commentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.config.token) {
        showToast("Para comentar necesitás conectar tu token.", "warning");
        openAuthModal();
        return;
      }

      const issueNum = document.getElementById("commentIssueNumber").value;
      const body = commentInput.value.trim();
      const btn = document.getElementById("btnSendComment");
      btn.disabled = true;
      btn.textContent = "Enviando...";

      try {
        await githubRequest(`/issues/${issueNum}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body })
        });
        commentInput.value = "";
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

export async function openNewIssueModal() {
  if (!state.config.token) {
    showToast("Para crear un issue primero iniciá sesión con tu Token de GitHub.", "warning");
    openAuthModal();
    return;
  }

  // Refrescar los milestones abiertos directamente desde GitHub para tener siempre el último estado
  try {
    state.milestones = await githubRequest("/milestones?state=open");
  } catch {
    // Fallback a los existentes en memoria si falla la red
  }

  const selectMs = document.getElementById("newIssueMilestone");
  if (selectMs) {
    const openSprints = (state.milestones || []).filter(m => m.state === "open");
    let optionsHtml = "";

    if (openSprints.length > 0) {
      // El sprint en curso es el primer milestone abierto (o el que tiene due_on más próximo)
      const currentSprint = openSprints[0];
      optionsHtml += `<option value="${currentSprint.number}">🎯 ${escapeHtml(currentSprint.title)} (Sprint en curso - Por defecto)</option>`;

      if (openSprints.length > 1) {
        optionsHtml += `<optgroup label="Otros Sprints abiertos">`;
        openSprints.slice(1).forEach(m => {
          optionsHtml += `<option value="${m.number}">🎯 ${escapeHtml(m.title)}</option>`;
        });
        optionsHtml += `</optgroup>`;
      }
    } else {
      optionsHtml += `<option value="none">⚪ Sin Sprint / Backlog general (No hay sprints abiertos)</option>`;
    }

    optionsHtml += `<option value="none">⚪ Sin Sprint / Backlog general</option>`;
    selectMs.innerHTML = optionsHtml;

    // Seleccionar por defecto el número del primer sprint abierto si existe
    if (openSprints.length > 0) {
      selectMs.value = openSprints[0].number;
    } else {
      selectMs.value = "none";
    }
  }

  document.getElementById("newIssueModal").showModal();
}

export function openNewMilestoneModal() {
  if (!state.config.token) {
    showToast("Para crear un Sprint primero iniciá sesión con tu Token de GitHub.", "warning");
    openAuthModal();
    return;
  }
  document.getElementById("newMilestoneModal").showModal();
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
