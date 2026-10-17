// js/tabs/kanban.js - Lógica aislada del Tablero Kanban
import { state, COLUMN_LABELS, escapeHtml } from "../state.js";
import { githubRequest } from "../api.js";
import { showToast } from "../toast.js";

let draggedCard = null;

export function classifyColumn(issue) {
  // 1. Si está cerrado en GitHub, es Done (PR fusionado o completado)
  if (issue.state === "closed") return "done";

  // 2. Si tiene un Pull Request abierto vinculado, va automáticamente a En Curso
  const issueRef = `#${issue.number}`;
  const hasOpenPR = (state.pullRequests || []).some(pr =>
    pr.state === "open" && ((pr.body || "").includes(issueRef) || (pr.title || "").includes(issueRef))
  );
  if (hasOpenPR) return "progress";

  // 3. Revisión por etiquetas estándar
  const labelNames = (issue.labels || []).map(l => (typeof l === "string" ? l : l.name).toLowerCase());
  if (labelNames.includes(COLUMN_LABELS.blocked)) return "blocked";
  if (labelNames.includes(COLUMN_LABELS.progress)) return "progress";
  if (labelNames.includes(COLUMN_LABELS.done)) return "done";
  return "todo";
}

export async function loadKanban() {
  try {
    // Cargar issues y pull requests en paralelo
    const [issues, pulls] = await Promise.all([
      githubRequest("/issues?state=all&per_page=100"),
      githubRequest("/pulls?state=all&per_page=100").catch(() => [])
    ]);

    state.issues = issues;
    state.pullRequests = pulls;
    state.prReviews = state.prReviews || {};

    // Renderizado inmediato: la UI jamás se traba esperando reviews
    updateAssigneeFilterOptions();
    renderKanban();

    // Obtener reviews de los PRs abiertos progresivamente en segundo plano
    const openPulls = (pulls || []).filter(pr => pr.state === "open");
    if (openPulls.length > 0) {
      Promise.all(
        openPulls.map(async pr => {
          try {
            const reviews = await githubRequest(`/pulls/${pr.number}/reviews`);
            const latestByUser = {};
            (reviews || []).forEach(r => {
              if (r.user && r.user.login) {
                latestByUser[r.user.login] = {
                  state: r.state,
                  avatarUrl: r.user.avatar_url
                };
              }
            });
            const approvedReviewers = Object.entries(latestByUser)
              .filter(([_, data]) => data.state === "APPROVED")
              .map(([login, data]) => ({ login, avatarUrl: data.avatarUrl }));

            state.prReviews[pr.number] = {
              approvedCount: approvedReviewers.length,
              totalRequired: 2,
              reviewers: approvedReviewers
            };
          } catch {
            state.prReviews[pr.number] = { approvedCount: 0, totalRequired: 2, reviewers: [] };
          }
        })
      ).then(() => {
        renderKanban(); // Actualiza solo los badges cuando lleguen las reviews
      });
    }
  } catch (err) {
    console.error("Error al cargar Kanban:", err);
  }
}

function updateAssigneeFilterOptions() {
  const select = document.getElementById("selectFilterUser");
  if (!select) return;

  // Extraer usuarios únicos asignados
  const assignees = new Set();
  state.issues.forEach(i => {
    if (i.assignee) assignees.add(i.assignee.login);
    (i.assignees || []).forEach(a => assignees.add(a.login));
  });

  const currentVal = select.value || "all";
  const myUser = state.user ? `@${state.user.username}` : "";

  select.innerHTML = `
    <option value="all">👥 Todos los miembros</option>
    <option value="mine">👤 Mis tareas ${myUser ? `(${myUser})` : ""}</option>
    <option value="unassigned">⚪ Sin asignar</option>
    <optgroup label="Compañeros">
      ${Array.from(assignees).sort().map(user => `<option value="${escapeHtml(user)}">@${escapeHtml(user)}</option>`).join("")}
    </optgroup>
  `;
  select.value = currentVal;
}

export function renderKanban() {
  const columns = {
    todo: document.getElementById("list-todo"),
    progress: document.getElementById("list-progress"),
    blocked: document.getElementById("list-blocked"),
    done: document.getElementById("list-done")
  };

  Object.values(columns).forEach(col => { if (col) col.innerHTML = ""; });
  const counts = { todo: 0, progress: 0, blocked: 0, done: 0 };

  const currentUser = state.user ? state.user.username : null;
  const filterAssignee = state.filters.assignee;
  const filterSearch = (state.filters.search || "").toLowerCase();
  const onlyMine = state.filters.onlyMine;

  state.issues.forEach(issue => {
    if (issue.pull_request) return; // Filtrar PRs

    const colKey = classifyColumn(issue);
    counts[colKey]++;

    // Aplicar Filtro de Usuario
    if (filterAssignee === "mine") {
      if (currentUser) {
        const isAssignedToMe = issue.assignee?.login === currentUser ||
          (issue.assignees || []).some(a => a.login === currentUser);
        if (!isAssignedToMe) return;
      }
    } else if (filterAssignee === "unassigned") {
      if (issue.assignee) return;
    } else if (filterAssignee && filterAssignee !== "all") {
      const hasAssignee = issue.assignee?.login === filterAssignee ||
        (issue.assignees || []).some(a => a.login === filterAssignee);
      if (!hasAssignee) return;
    }

    if (filterSearch) {
      const matchesTitle = issue.title.toLowerCase().includes(filterSearch);
      const matchesNumber = issue.number.toString().includes(filterSearch);
      if (!matchesTitle && !matchesNumber) return;
    }

    // Buscar Pull Requests vinculados que mencionen #numero
    const issueRef = `#${issue.number}`;
    const linkedPR = state.pullRequests.find(pr =>
      (pr.body || "").includes(issueRef) || (pr.title || "").includes(issueRef)
    );

    const card = document.createElement("div");
    card.className = "task-card";
    // Si la tarjeta ya está en Listo (cerrada), no se arrastra
    card.draggable = Boolean(state.config.token) && colKey !== "done";
    card.dataset.number = issue.number;

    if (state.config.token && colKey !== "done") {
      card.addEventListener("dragstart", onDragStart);
      card.addEventListener("dragend", onDragEnd);
    }

    const labelsHtml = (issue.labels || [])
      .filter(l => !Object.values(COLUMN_LABELS).includes(l.name))
      .map(l => `<span class="label-pill" style="background-color: #${l.color || '30363d'}22; border: 1px solid #${l.color || '30363d'}">${escapeHtml(l.name)}</span>`)
      .join("");

    let prBadgeHtml = "";
    if (linkedPR) {
      const isMerged = linkedPR.merged_at || linkedPR.state === "closed";
      let prStateLabel = isMerged ? "✓ Aceptado / Merged" : "⏳ En revisión";
      const prClass = isMerged ? "merged" : "open";
      let reviewersHtml = "";

      if (!isMerged && state.prReviews && state.prReviews[linkedPR.number]) {
        const { approvedCount, totalRequired, reviewers } = state.prReviews[linkedPR.number];
        prStateLabel = `⏳ ${approvedCount}/${totalRequired} aprobados`;

        if (reviewers && reviewers.length > 0) {
          const names = reviewers.map(r => `@${escapeHtml(r.login)}`).join(", ");
          reviewersHtml = `
            <div class="pr-reviewers-list" title="Revisores que aprobaron este PR">
              ${reviewers.map(r => `<img src="${r.avatarUrl}" width="16" height="16" class="reviewer-avatar" alt="${r.login}">`).join("")}
              <span>${names}</span>
            </div>
          `;
        }
      }

      prBadgeHtml = `
        <div class="pr-badge-container">
          <a href="${linkedPR.html_url}" target="_blank" rel="noopener" class="pr-badge ${prClass}" title="Ver Pull Request #${linkedPR.number} en GitHub">
            🔀 PR #${linkedPR.number} (${prStateLabel})
          </a>
          ${reviewersHtml}
        </div>
      `;
    }

    // Información de devolución en la columna Listo
    let acceptedByHtml = "";
    if (colKey === "done") {
      if (linkedPR && linkedPR.merged_by) {
        acceptedByHtml = `<div class="accepted-by-badge">👑 Aceptado por @${escapeHtml(linkedPR.merged_by.login)}</div>`;
      } else if (issue.closed_by) {
        acceptedByHtml = `<div class="accepted-by-badge">👑 Aceptado por @${escapeHtml(issue.closed_by.login)}</div>`;
      } else {
        acceptedByHtml = `<div class="accepted-by-badge">🎉 Tarea completada</div>`;
      }
    }

    const isAssignedToMe = state.user && issue.assignee?.login === state.user.username;
    const assigneeText = issue.assignee ? `@${escapeHtml(issue.assignee.login)}` : "Sin asignar";

    const assignBtnHtml = (colKey !== "done")
      ? (isAssignedToMe
          ? `<span class="badge-assigned-me">✓ Mía</span>`
          : `<button class="btn-self-assign" title="Asignarme esta tarea" onclick="event.stopPropagation(); window.selfAssignIssue(${issue.number})">➕ Asignarme</button>`)
      : "";

    card.innerHTML = `
      <div class="card-title">
        <a href="${issue.html_url}" target="_blank" rel="noopener" style="color: inherit; text-decoration: none;">
          #${issue.number} ${escapeHtml(issue.title)}
        </a>
      </div>
      ${prBadgeHtml}
      ${acceptedByHtml}
      <div class="card-meta">
        <span class="assignee-tag" title="Responsable de la tarea">
          👤 ${assigneeText}
        </span>
        ${assignBtnHtml}
        <button class="btn-comments-trigger" title="Ver y agregar comentarios" onclick="event.stopPropagation(); window.openIssueComments(${issue.number})">
          💬 ${issue.comments}
        </button>
      </div>
      ${labelsHtml ? `<div class="card-labels">${labelsHtml}</div>` : ""}
    `;

    if (columns[colKey]) {
      columns[colKey].appendChild(card);
    }
  });

  document.getElementById("count-todo").textContent = counts.todo;
  document.getElementById("count-progress").textContent = counts.progress;
  document.getElementById("count-blocked").textContent = counts.blocked;
  document.getElementById("count-done").textContent = counts.done;
}

function onDragStart(e) {
  draggedCard = e.currentTarget;
  draggedCard.classList.add("dragging");
  e.dataTransfer.setData("text/plain", draggedCard.dataset.number);
}

function onDragEnd() {
  if (draggedCard) {
    draggedCard.classList.remove("dragging");
    draggedCard = null;
  }
}

export async function handleDrop(e, targetCol) {
  e.preventDefault();

  // Regla estricta 1: Nadie puede arrastrar manualmente a Listo
  if (targetCol === "done") {
    showToast("🔒 La columna 'Listo' está protegida:\nSolo se completa automáticamente cuando se aceptan los 2 reviews y se fusiona el PR en GitHub.", "warning", 5000);
    return;
  }

  if (!state.config.token) {
    showToast("Para mover tareas en GitHub se requiere un Token con permisos de escritura.", "warning");
    return;
  }

  const issueNumber = parseInt(e.dataTransfer.getData("text/plain"), 10);
  const issue = state.issues.find(i => i.number === issueNumber);
  if (!issue) return;

  const currentCol = classifyColumn(issue);
  if (currentCol === targetCol) return;

  // Regla estricta 2: No pasar a En Curso si no tiene responsable asignado
  let autoAssigned = false;
  if (targetCol === "progress" && !issue.assignee) {
    if (state.user && state.user.username) {
      const confirmAssign = confirm(`⚠️ Regla de flujo:\nPara pasar una tarea a 'En Curso' debe tener un responsable.\n¿Querés asignártela a vos (@${state.user.username}) ahora?`);
      if (!confirmAssign) return;
      issue.assignee = { login: state.user.username };
      autoAssigned = true;
    } else {
      showToast("⚠️ Regla de flujo: No podés pasar una tarea a 'En Curso' sin antes tener un responsable asignado.", "warning");
      return;
    }
  }

  // Actualización optimista en memoria (solo para todo, progress o blocked)
  issue.state = "open";
  issue.labels = (issue.labels || []).filter(l => {
    const name = typeof l === "string" ? l : l.name;
    return !Object.values(COLUMN_LABELS).includes(name);
  });
  if (COLUMN_LABELS[targetCol]) {
    issue.labels.push({ name: COLUMN_LABELS[targetCol], color: "30363d" });
  }

  renderKanban();

  // Sincronización remota con GitHub
  try {
    const labelNames = (issue.labels || []).map(l => (typeof l === "string" ? l : l.name));
    const patchPayload = { state: "open", labels: labelNames };
    if (autoAssigned) {
      patchPayload.assignees = [state.user.username];
    }
    await githubRequest(`/issues/${issueNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchPayload)
    });
    showToast(`Tarea #${issueNumber} actualizada en GitHub`, "success", 2500);
  } catch (err) {
    showToast("Error al sincronizar con GitHub: " + err.message, "error");
    loadKanban(); // Revertir con el estado remoto
  }
}

// Función global para auto-asignarse un issue con un click
window.selfAssignIssue = async function (issueNumber) {
  if (!state.config.token || !state.user) {
    showToast("Iniciá sesión con tu token de GitHub para asignarte esta tarea.", "info");
    import("../modals.js").then(m => m.openAuthModal());
    return;
  }

  const issue = state.issues.find(i => i.number === issueNumber);
  if (!issue) return;

  const username = state.user.username;
  issue.assignee = { login: username };
  renderKanban();

  try {
    await githubRequest(`/issues/${issueNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignees: [username] })
    });
    showToast(`Te asignaste la tarea #${issueNumber}`, "success", 2500);
  } catch (err) {
    showToast("Error al asignar tarea en GitHub: " + err.message, "error");
    loadKanban();
  }
};
