// Estado y Configuración Local
const CONFIG_KEY = "gh_board_config";
let config = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
let issues = [];

const COLUMN_LABELS = {
  todo: "status:todo",
  progress: "status:in-progress",
  blocked: "status:blocked",
  done: "status:done"
};

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  if (config.owner && config.repo && config.token) {
    document.getElementById("cfgOwner").value = config.owner;
    document.getElementById("cfgRepo").value = config.repo;
    document.getElementById("cfgToken").value = config.token;
    actualizarBadgeRepo();
    cargarIssues();
  } else {
    toggleConfig(true);
  }
});

function toggleConfig(forzarAbrir) {
  const panel = document.getElementById("configPanel");
  if (forzarAbrir === true) {
    panel.classList.add("open");
  } else {
    panel.classList.toggle("open");
  }
}

function actualizarBadgeRepo() {
  const info = document.getElementById("repoInfo");
  const badge = document.getElementById("repoNameBadge");
  badge.textContent = `${config.owner}/${config.repo}`;
  info.style.display = "block";
}

function guardarConfig() {
  const owner = document.getElementById("cfgOwner").value.trim();
  const repo = document.getElementById("cfgRepo").value.trim();
  const token = document.getElementById("cfgToken").value.trim();

  if (!owner || !repo || !token) {
    alert("Por favor completá los 3 campos.");
    return;
  }

  config = { owner, repo, token };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  actualizarBadgeRepo();
  toggleConfig(false);
  cargarIssues();
}

// Llamadas a GitHub API
async function githubFetch(endpoint, options = {}) {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

async function cargarIssues() {
  try {
    // Pedimos todos los issues abiertos y cerrados recientes
    issues = await githubFetch("/issues?state=all&per_page=100");
    renderizarTablero();
  } catch (err) {
    console.error(err);
    alert("Error al cargar issues de GitHub: " + err.message);
    toggleConfig(true);
  }
}

// Renderizado del Tablero
function clasificarColumna(issue) {
  if (issue.state === "closed") return "done";

  const labels = issue.labels.map(l => (typeof l === "string" ? l : l.name).toLowerCase());
  if (labels.includes(COLUMN_LABELS.blocked)) return "blocked";
  if (labels.includes(COLUMN_LABELS.progress)) return "progress";
  if (labels.includes(COLUMN_LABELS.done)) return "done";
  return "todo";
}

function renderizarTablero() {
  const columnas = {
    todo: document.getElementById("list-todo"),
    progress: document.getElementById("list-progress"),
    blocked: document.getElementById("list-blocked"),
    done: document.getElementById("list-done")
  };

  // Limpiar listas
  Object.values(columnas).forEach(col => col.innerHTML = "");

  const contadores = { todo: 0, progress: 0, blocked: 0, done: 0 };

  issues.forEach(issue => {
    // Excluir Pull Requests (la API de issues incluye PRs)
    if (issue.pull_request) return;

    const colKey = clasificarColumna(issue);
    contadores[colKey]++;

    const card = document.createElement("div");
    card.className = "task-card";
    card.draggable = true;
    card.id = `card-${issue.number}`;
    card.dataset.number = issue.number;

    card.addEventListener("dragstart", arrastrar);
    card.addEventListener("dragend", soltarFinal);

    const labelsHtml = (issue.labels || [])
      .filter(l => !Object.values(COLUMN_LABELS).includes(l.name))
      .map(l => `<span class="label-pill" style="background-color: #${l.color || '30363d'}22; border: 1px solid #${l.color || '30363d'}">${l.name}</span>`)
      .join("");

    card.innerHTML = `
      <div class="card-title">
        <a href="${issue.html_url}" target="_blank" rel="noopener" style="color: inherit; text-decoration: none;">
          #${issue.number} ${escapeHtml(issue.title)}
        </a>
      </div>
      <div class="card-meta">
        <span>👤 ${issue.assignee ? issue.assignee.login : "Sin asignar"}</span>
        <span>💬 ${issue.comments}</span>
      </div>
      ${labelsHtml ? `<div class="card-labels">${labelsHtml}</div>` : ""}
    `;

    columnas[colKey].appendChild(card);
  });

  // Actualizar badges
  document.getElementById("count-todo").textContent = contadores.todo;
  document.getElementById("count-progress").textContent = contadores.progress;
  document.getElementById("count-blocked").textContent = contadores.blocked;
  document.getElementById("count-done").textContent = contadores.done;
}

// Drag & Drop
let tarjetaArrastrada = null;

function arrastrar(e) {
  tarjetaArrastrada = e.currentTarget;
  tarjetaArrastrada.classList.add("dragging");
  e.dataTransfer.setData("text/plain", tarjetaArrastrada.dataset.number);
}

function soltarFinal() {
  if (tarjetaArrastrada) {
    tarjetaArrastrada.classList.remove("dragging");
    tarjetaArrastrada = null;
  }
}

function permitirSoltar(e) {
  e.preventDefault();
}

async function soltar(e, destinoKey) {
  e.preventDefault();
  const issueNumber = parseInt(e.dataTransfer.getData("text/plain"), 10);
  const issue = issues.find(i => i.number === issueNumber);
  if (!issue) return;

  const origenKey = clasificarColumna(issue);
  if (origenKey === destinoKey) return;

  // Actualización optimista en memoria
  if (destinoKey === "done") {
    issue.state = "closed";
  } else {
    issue.state = "open";
    // Limpiar status labels anteriores
    issue.labels = (issue.labels || []).filter(l => {
      const name = typeof l === "string" ? l : l.name;
      return !Object.values(COLUMN_LABELS).includes(name);
    });
    // Agregar nueva etiqueta
    if (COLUMN_LABELS[destinoKey]) {
      issue.labels.push({ name: COLUMN_LABELS[destinoKey], color: "30363d" });
    }
  }

  renderizarTablero();

  // Sincronizar con GitHub API
  try {
    if (destinoKey === "done") {
      await githubFetch(`/issues/${issueNumber}`, {
        method: "PATCH",
        body: JSON.stringify({ state: "closed" })
      });
    } else {
      // Reabrir si estaba cerrado
      const labelNames = (issue.labels || []).map(l => (typeof l === "string" ? l : l.name));
      await githubFetch(`/issues/${issueNumber}`, {
        method: "PATCH",
        body: JSON.stringify({
          state: "open",
          labels: labelNames
        })
      });
    }
  } catch (err) {
    alert("Error al mover el issue en GitHub: " + err.message);
    cargarIssues(); // Rollback recargando
  }
}

// Modal Nuevo Issue
function abrirModalNuevoIssue() {
  if (!config.token) {
    alert("Primero configurá el token de GitHub.");
    toggleConfig(true);
    return;
  }
  document.getElementById("newIssueModal").showModal();
}

function cerrarModalNuevoIssue() {
  document.getElementById("newIssueModal").close();
}

async function crearNuevoIssue(e) {
  e.preventDefault();
  const title = document.getElementById("newTitle").value.trim();
  const body = document.getElementById("newBody").value.trim();
  const column = document.getElementById("newColumn").value;

  const labels = [];
  if (COLUMN_LABELS[column]) {
    labels.push(COLUMN_LABELS[column]);
  }

  try {
    const nuevo = await githubFetch("/issues", {
      method: "POST",
      body: JSON.stringify({ title, body, labels })
    });

    issues.unshift(nuevo);
    renderizarTablero();
    cerrarModalNuevoIssue();
    document.getElementById("newTitle").value = "";
    document.getElementById("newBody").value = "";
  } catch (err) {
    alert("Error al crear el issue: " + err.message);
  }
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
