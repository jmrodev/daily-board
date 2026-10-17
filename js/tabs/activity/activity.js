// js/tabs/activity/activity.js - Lógica aislada de historial de commits de todas las ramas
import { state, escapeHtml } from "../../state.js";
import { githubRequest } from "../../api.js";

let selectedBranch = "all";

export async function loadActivity() {
  const container = document.getElementById("activityList");
  if (!container) return;
  container.innerHTML = `<div class="loading">Cargando commits recientes...</div>`;

  setupBranchFilter();

  try {
    // Si se pide una rama específica
    if (selectedBranch !== "all") {
      const commits = await githubRequest(`/commits?sha=${encodeURIComponent(selectedBranch)}&per_page=30`);
      renderCommitsList(commits, container);
      return;
    }

    // Si se piden "Todas las ramas", consultamos las ramas existentes del repo
    const branches = await githubRequest("/branches").catch(() => [{ name: "gh-pages" }, { name: "main" }]);
    
    // Obtener los commits de cada rama en paralelo
    const branchCommitsList = await Promise.all(
      branches.map(async b => {
        try {
          const list = await githubRequest(`/commits?sha=${encodeURIComponent(b.name)}&per_page=15`);
          return list.map(c => ({ ...c, branchName: b.name }));
        } catch {
          return [];
        }
      })
    );

    // Unificar y desduplicar commits por SHA (puede haber commits compartidos entre ramas)
    const commitMap = new Map();
    branchCommitsList.flat().forEach(c => {
      if (commitMap.has(c.sha)) {
        // Si ya está, agregarle la rama adicional a su badge
        const existing = commitMap.get(c.sha);
        if (existing.branches && !existing.branches.includes(c.branchName)) {
          existing.branches.push(c.branchName);
        }
      } else {
        commitMap.set(c.sha, {
          ...c,
          branches: [c.branchName]
        });
      }
    });

    const unifiedCommits = Array.from(commitMap.values());

    // Ordenar cronológicamente descendente (el más reciente primero)
    unifiedCommits.sort((a, b) => {
      const dateA = new Date(a.commit.author?.date || a.commit.committer?.date || 0);
      const dateB = new Date(b.commit.author?.date || b.commit.committer?.date || 0);
      return dateB - dateA;
    });

    renderCommitsList(unifiedCommits.slice(0, 30), container);
  } catch (err) {
    container.innerHTML = `<div class="loading">Error al cargar actividad: ${err.message}</div>`;
  }
}

function setupBranchFilter() {
  const select = document.getElementById("selectActivityBranch");
  if (!select) return;

  // Evitar vincular listeners repetidos
  if (!select.dataset.listenerBound) {
    select.dataset.listenerBound = "true";
    select.addEventListener("change", (e) => {
      selectedBranch = e.target.value;
      loadActivity();
    });
  }
}

function renderCommitsList(commits, container) {
  if (!commits || commits.length === 0) {
    container.innerHTML = `<div class="loading">No se encontraron commits registrados.</div>`;
    return;
  }

  container.innerHTML = commits.map(c => {
    const msg = escapeHtml(c.commit.message.split("\n")[0]);
    const authorName = escapeHtml(c.commit.author?.name || c.author?.login || "Anónimo");
    const avatar = c.author?.avatar_url || `https://github.com/${authorName}.png?size=32`;
    const dateStr = new Date(c.commit.author?.date || c.commit.committer?.date).toLocaleString("es-AR", {
      dateStyle: "short",
      timeStyle: "short"
    });

    const branchesBadges = (c.branches || [selectedBranch !== "all" ? selectedBranch : ""]).filter(Boolean).map(b => `
      <span class="commit-branch-tag ${b === "main" ? "main-tag" : "pages-tag"}">🌿 ${escapeHtml(b)}</span>
    `).join("");

    return `
      <div class="commit-item">
        <div class="commit-left">
          <img src="${avatar}" class="commit-avatar" onerror="this.src='https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'" alt="${authorName}">
          <div class="commit-info">
            <div class="commit-msg-row">
              <a href="${c.html_url}" target="_blank" rel="noopener" class="commit-msg-link">
                ${msg}
              </a>
              ${branchesBadges}
            </div>
            <div class="commit-author">
              Por <strong>${authorName}</strong> · ${dateStr}
            </div>
          </div>
        </div>
        <a href="${c.html_url}" target="_blank" rel="noopener" class="btn small secondary commit-sha-btn">
          <code>${c.sha.substring(0, 7)}</code> ↗
        </a>
      </div>
    `;
  }).join("");
}
