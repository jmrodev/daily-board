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
    state.issues = await githubRequest("/issues?state=all&per_page=100");
    renderKanban();
  } catch (err) {
    console.error("Error al cargar Kanban:", err);
  }
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

  state.issues.forEach(issue => {
    if (issue.pull_request) return; // Filtrar PRs

    const colKey = classifyColumn(issue);
    counts[colKey]++;

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

    card.innerHTML = `
      <div class="card-title">
        <a href="${issue.html_url}" target="_blank" rel="noopener" style="color: inherit; text-decoration: none;">
          #${issue.number} ${escapeHtml(issue.title)}
        </a>
      </div>
      <div class="card-meta">
        <span>👤 ${issue.assignee ? escapeHtml(issue.assignee.login) : "Sin asignar"}</span>
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
