// js/tabs/kanban/card.js - Componente puro de renderizado de tarjetas Kanban
import { state, COLUMN_LABELS, escapeHtml } from "../../state.js";
import { onDragStart, onDragEnd } from "./drag.js";

export function createKanbanCard(issue, colKey) {
  // Buscar Pull Requests vinculados que mencionen #numero o usar el mismo si es standalone
  const issueRef = `#${issue.number}`;
  const linkedPR = issue.isStandalonePR ? issue : (state.pullRequests || []).find(pr =>
    (pr.body || "").includes(issueRef) || (pr.title || "").includes(issueRef)
  );

  const card = document.createElement("div");
  card.className = "task-card";
  // Si la tarjeta ya está en Listo (cerrada) o es PR standalone, controlar drag
  card.draggable = Boolean(state.config.token) && colKey !== "done" && !issue.isStandalonePR;
  card.dataset.number = issue.number;

  if (state.config.token && colKey !== "done" && !issue.isStandalonePR) {
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
          🔀 ${issue.isStandalonePR ? 'Pull Request' : 'PR'} #${linkedPR.number} (${prStateLabel})
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

  const milestoneHtml = issue.milestone
    ? `<span class="milestone-badge" title="Sprint: ${escapeHtml(issue.milestone.title)}">🎯 ${escapeHtml(issue.milestone.title)}</span>`
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
    <div class="card-badges-row">
      ${milestoneHtml}
      ${labelsHtml ? `<div class="card-labels">${labelsHtml}</div>` : ""}
    </div>
  `;

  return card;
}
