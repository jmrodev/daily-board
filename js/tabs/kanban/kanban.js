// js/tabs/kanban/kanban.js - Orquestador desacoplado del Tablero Kanban
import { state, COLUMN_LABELS, escapeHtml } from "../../state.js";
import { githubRequest } from "../../api.js";
import { showToast } from "../../toast.js";
import { createKanbanCard } from "./card.js";

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
    // Cargar issues, pull requests y milestones en paralelo
    const [issues, pulls, milestones] = await Promise.all([
      githubRequest("/issues?state=all&per_page=100"),
      githubRequest("/pulls?state=all&per_page=100").catch(() => []),
      githubRequest("/milestones?state=open").catch(() => [])
    ]);

    state.issues = issues;
    state.pullRequests = pulls;
    state.milestones = milestones;
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
    showToast(err.message, "warning", 6000);
  }
}

export function updateAssigneeFilterOptions() {
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

  // Detectar el Sprint en curso (el primer milestone abierto)
  const currentSprint = (state.milestones || []).find(m => m.state === "open");

  // Arrays de distribución para la columna "Por Hacer"
  const todoCurrentSprint = [];
  const todoFutureOrBacklog = [];

  state.issues.forEach(issue => {
    if (issue.pull_request) return; // Filtrar PRs directos en issues

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

    const card = createKanbanCard(issue, colKey);

    // En la columna "Por Hacer", dividimos entre este sprint (arriba) y próximo/sin sprint (abajo)
    if (colKey === "todo") {
      const isCurrent = currentSprint && issue.milestone && issue.milestone.number === currentSprint.number;
      if (isCurrent) {
        todoCurrentSprint.push(card);
      } else {
        todoFutureOrBacklog.push(card);
      }
    } else {
      if (columns[colKey]) {
        columns[colKey].appendChild(card);
      }
    }
  });

  // Renderizar la columna Por Hacer con secciones Arriba (Sprint actual) y Abajo (Próximo / Sin Sprint)
  if (columns.todo) {
    const sprintTitle = currentSprint ? `🎯 ${escapeHtml(currentSprint.title)}` : "🎯 Sprint en curso";
    
    const currentSection = document.createElement("div");
    currentSection.className = "kanban-section-group";
    currentSection.innerHTML = `<div class="kanban-section-title">${sprintTitle} (${todoCurrentSprint.length})</div>`;
    const currentCardsWrap = document.createElement("div");
    currentCardsWrap.className = "kanban-section-cards";
    if (todoCurrentSprint.length === 0) {
      currentCardsWrap.innerHTML = `<div class="kanban-empty-section">No hay tareas pendientes en este sprint</div>`;
    } else {
      todoCurrentSprint.forEach(c => currentCardsWrap.appendChild(c));
    }
    currentSection.appendChild(currentCardsWrap);
    columns.todo.appendChild(currentSection);

    const futureSection = document.createElement("div");
    futureSection.className = "kanban-section-group future-group";
    futureSection.innerHTML = `<div class="kanban-section-title future-title">⏳ Próximo Sprint / Sin Sprint (${todoFutureOrBacklog.length})</div>`;
    const futureCardsWrap = document.createElement("div");
    futureCardsWrap.className = "kanban-section-cards";
    if (todoFutureOrBacklog.length === 0) {
      futureCardsWrap.innerHTML = `<div class="kanban-empty-section">No hay tareas para próximos sprints</div>`;
    } else {
      todoFutureOrBacklog.forEach(c => futureCardsWrap.appendChild(c));
    }
    futureSection.appendChild(futureCardsWrap);
    columns.todo.appendChild(futureSection);
  }

  document.getElementById("count-todo").textContent = counts.todo;
  document.getElementById("count-progress").textContent = counts.progress;
  document.getElementById("count-blocked").textContent = counts.blocked;
  document.getElementById("count-done").textContent = counts.done;
}
