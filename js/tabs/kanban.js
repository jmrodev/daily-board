// js/tabs/kanban.js - Lógica aislada del Tablero Kanban
import { state, COLUMN_LABELS, escapeHtml } from "../state.js";
import { githubRequest } from "../api.js";

let draggedCard = null;

export function classifyColumn(issue) {
  if (issue.state === "closed") return "done";
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
    updateAssigneeFilterOptions();
    renderKanban();
  } catch (err) {
    console.error("Error al cargar Kanban:", err);
  }
}

function updateAssigneeFilterOptions() {
  const select = document.getElementById("selectFilterAssignee");
  if (!select) return;

  // Extraer usuarios únicos asignados
  const assignees = new Set();
  state.issues.forEach(i => {
    if (i.assignee) assignees.add(i.assignee.login);
    (i.assignees || []).forEach(a => assignees.add(a.login));
  });

  const currentVal = select.value;
  select.innerHTML = `
    <option value="all">Todos los miembros</option>
    <option value="unassigned">Sin asignar</option>
    ${Array.from(assignees).sort().map(user => `<option value="${escapeHtml(user)}">@${escapeHtml(user)}</option>`).join("")}
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

    // Aplicar Filtros
    if (onlyMine && currentUser) {
      const isAssignedToMe = issue.assignee?.login === currentUser ||
        (issue.assignees || []).some(a => a.login === currentUser);
      if (!isAssignedToMe) return;
    }

    if (filterAssignee === "unassigned" && issue.assignee) return;
    if (filterAssignee !== "all" && filterAssignee !== "unassigned") {
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
    card.draggable = Boolean(state.config.token);
    card.dataset.number = issue.number;

    if (state.config.token) {
      card.addEventListener("dragstart", onDragStart);
      card.addEventListener("dragend", onDragEnd);
    }

    const labelsHtml = (issue.labels || [])
      .filter(l => !Object.values(COLUMN_LABELS).includes(l.name))
      .map(l => `<span class="label-pill" style="background-color: #${l.color || '30363d'}22; border: 1px solid #${l.color || '30363d'}">${escapeHtml(l.name)}</span>`)
      .join("");

    const prBadgeHtml = linkedPR ? `
      <a href="${linkedPR.html_url}" target="_blank" rel="noopener" class="pr-badge ${linkedPR.state}" title="Pull Request vinculado: #${linkedPR.number}">
        🔀 PR #${linkedPR.number} (${linkedPR.state === 'open' ? 'En revisión' : 'Merged'})
      </a>
    ` : "";

    const assigneeText = issue.assignee ? `@${escapeHtml(issue.assignee.login)}` : "Sin asignar";
    const canSelfAssign = state.config.token && state.user && issue.assignee?.login !== state.user.username;

    card.innerHTML = `
      <div class="card-title">
        <a href="${issue.html_url}" target="_blank" rel="noopener" style="color: inherit; text-decoration: none;">
          #${issue.number} ${escapeHtml(issue.title)}
        </a>
      </div>
      ${prBadgeHtml}
      <div class="card-meta">
        <span class="assignee-tag" title="Responsable de la tarea">
          👤 ${assigneeText}
          ${canSelfAssign ? `<button class="btn-self-assign" title="Asignármela a mí" onclick="event.stopPropagation(); window.selfAssignIssue(${issue.number})">➕</button>` : ""}
        </span>
        <span>💬 ${issue.comments}</span>
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
  if (!state.config.token) {
    alert("Para mover tareas en GitHub se requiere un Token con permisos de escritura.");
    return;
  }

  const issueNumber = parseInt(e.dataTransfer.getData("text/plain"), 10);
  const issue = state.issues.find(i => i.number === issueNumber);
  if (!issue) return;

  const currentCol = classifyColumn(issue);
  if (currentCol === targetCol) return;

  // Actualización optimista en memoria
  if (targetCol === "done") {
    issue.state = "closed";
  } else {
    issue.state = "open";
    issue.labels = (issue.labels || []).filter(l => {
      const name = typeof l === "string" ? l : l.name;
      return !Object.values(COLUMN_LABELS).includes(name);
    });
    if (COLUMN_LABELS[targetCol]) {
      issue.labels.push({ name: COLUMN_LABELS[targetCol], color: "30363d" });
    }
  }

  renderKanban();

  // Sincronización remota con GitHub
  try {
    if (targetCol === "done") {
      await githubRequest(`/issues/${issueNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "closed" })
      });
    } else {
      const labelNames = (issue.labels || []).map(l => (typeof l === "string" ? l : l.name));
      await githubRequest(`/issues/${issueNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "open", labels: labelNames })
      });
    }
  } catch (err) {
    alert("Error al sincronizar con GitHub: " + err.message);
    loadKanban(); // Revertir con el estado remoto
  }
}

// Función global para auto-asignarse un issue con un click
window.selfAssignIssue = async function (issueNumber) {
  if (!state.config.token || !state.user) {
    alert("Iniciá sesión para asignarte esta tarea.");
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
  } catch (err) {
    alert("Error al asignar tarea en GitHub: " + err.message);
    loadKanban();
  }
};
