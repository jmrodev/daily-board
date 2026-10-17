// js/tabs/sprints/sprints.js - Lógica aislada de Milestones y progreso
import { state, escapeHtml } from "../../state.js";
import { githubRequest } from "../../api.js";

export async function loadSprints() {
  const container = document.getElementById("sprintsList");
  container.innerHTML = `<div class="loading">Cargando hitos de GitHub...</div>`;

  try {
    state.milestones = await githubRequest("/milestones?state=all");
    if (!state.milestones.length) {
      container.innerHTML = `<p class="placeholder-text">No hay Milestones creados en este repositorio todavía.</p>`;
      return;
    }

    container.innerHTML = state.milestones.map(m => {
      const total = m.open_issues + m.closed_issues;
      const pct = total > 0 ? Math.round((m.closed_issues / total) * 100) : 0;
      return `
        <div class="sprint-card">
          <div class="sprint-card-head">
            <h3><a href="${m.html_url}" target="_blank" rel="noopener" style="color: inherit; text-decoration: none;">${escapeHtml(m.title)}</a></h3>
            <span class="badge">${m.state === "open" ? "En curso" : "Cerrado"}</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(m.description || "Sin descripción")}</p>
          <div class="sprint-progress-bar">
            <div class="sprint-progress-fill" style="width: ${pct}%"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
            <span>${pct}% Completado</span>
            <span>${m.closed_issues} cerrados / ${total} totales</span>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    container.innerHTML = `<div class="loading">Error al cargar hitos: ${err.message}</div>`;
  }
}
