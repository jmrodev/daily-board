// js/tabs/activity/activity.js - Lógica aislada de historial de commits
import { state, escapeHtml } from "../../state.js";
import { githubRequest } from "../../api.js";

export async function loadActivity() {
  const container = document.getElementById("activityList");
  container.innerHTML = `<div class="loading">Cargando commits recientes...</div>`;

  try {
    state.commits = await githubRequest("/commits?per_page=20");
    container.innerHTML = state.commits.map(c => `
      <div class="commit-item">
        <div>
          <div class="commit-msg">
            <a href="${c.html_url}" target="_blank" rel="noopener" style="color: inherit; text-decoration: none;">
              ${escapeHtml(c.commit.message.split("\n")[0])}
            </a>
          </div>
          <div class="commit-author">
            Por <strong>${escapeHtml(c.commit.author.name)}</strong> · ${new Date(c.commit.author.date).toLocaleString()}
          </div>
        </div>
        <a href="${c.html_url}" target="_blank" rel="noopener" class="btn small secondary">
          ${c.sha.substring(0, 7)}
        </a>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<div class="loading">Error al cargar actividad: ${err.message}</div>`;
  }
}
