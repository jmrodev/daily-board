// Configuración y Estado Global
const STORAGE_KEY = "classroom_hub_config";
let config = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

// Defaults públicos (carga sin pedir token)
if (!config.repoSlug) {
  config.repoSlug = "jmrodev/daily-board";
}

let solapaActual = "kanban";
let cachedIssues = [];
let cachedDocs = [];

const COLUMN_LABELS = {
  todo: "status:todo",
  progress: "status:in-progress",
  blocked: "status:blocked",
  done: "status:done"
};

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  actualizarUIAuth();
  cambiarSolapa("kanban");
});

// Navegación por Solapas
function cambiarSolapa(tabKey) {
  solapaActual = tabKey;

  // Actualizar botones de navegación
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === tabKey);
  });

  // Mostrar contenedor correspondiente
  document.querySelectorAll(".tab-content").forEach(content => {
    content.classList.remove("active");
  });
  document.getElementById(`tab-${tabKey}`).classList.add("active");

  // Ajustar el botón de acción principal según solapa
  const btnAccion = document.getElementById("btnNuevaAccion");
  if (tabKey === "kanban") {
    btnAccion.style.display = "inline-block";
    btnAccion.textContent = "➕ Nueva Tarea";
    cargarKanban();
  } else if (tabKey === "docs") {
    btnAccion.style.display = "inline-block";
    btnAccion.textContent = "➕ Nuevo Doc";
    cargarDocs();
  } else if (tabKey === "sprints") {
    btnAccion.style.display = "none";
    cargarSprints();
  } else if (tabKey === "activity") {
    btnAccion.style.display = "none";
    cargarActividad();
  }
}

function ejecutarAccionSolapa() {
  if (solapaActual === "kanban") {
    abrirModalNuevaTarea();
  } else if (solapaActual === "docs") {
    abrirModalNuevoDoc();
  }
}

function recargarDatosActuales() {
  cambiarSolapa(solapaActual);
}

// Cliente GitHub API (con fallback público)
async function githubRequest(endpoint, options = {}) {
  const headers = {
    "Accept": "application/vnd.github+json",
    ...(options.headers || {})
  };

  if (config.token) {
    headers["Authorization"] = `Bearer ${config.token}`;
  }

  const url = `https://api.github.com/repos/${config.repoSlug}${endpoint}`;
  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Permisos insuficientes o límite de API alcanzado. Configurá tu token de GitHub.`);
    }
    throw new Error(errorBody.message || `Error ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

// ----------------------------------------------------
// 1. LÓGICA DE TABLERO KANBAN
// ----------------------------------------------------
function clasificarColumna(issue) {
  if (issue.state === "closed") return "done";
  const labelNames = (issue.labels || []).map(l => (typeof l === "string" ? l : l.name).toLowerCase());
  if (labelNames.includes(COLUMN_LABELS.blocked)) return "blocked";
  if (labelNames.includes(COLUMN_LABELS.progress)) return "progress";
  if (labelNames.includes(COLUMN_LABELS.done)) return "done";
  return "todo";
}

async function cargarKanban() {
  try {
    cachedIssues = await githubRequest("/issues?state=all&per_page=100");
    renderizarKanban();
  } catch (err) {
    console.error(err);
  }
}

function renderizarKanban() {
  const columnas = {
    todo: document.getElementById("list-todo"),
    progress: document.getElementById("list-progress"),
    blocked: document.getElementById("list-blocked"),
    done: document.getElementById("list-done")
  };

  Object.values(columnas).forEach(col => col.innerHTML = "");
  const contadores = { todo: 0, progress: 0, blocked: 0, done: 0 };

  cachedIssues.forEach(issue => {
    if (issue.pull_request) return; // Filtrar PRs

    const colKey = clasificarColumna(issue);
    contadores[colKey]++;

    const card = document.createElement("div");
    card.className = "task-card";
    card.draggable = !!config.token;
    card.dataset.number = issue.number;

    if (config.token) {
      card.addEventListener("dragstart", arrastrar);
      card.addEventListener("dragend", soltarFinal);
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

    columnas[colKey].appendChild(card);
  });

  document.getElementById("count-todo").textContent = contadores.todo;
  document.getElementById("count-progress").textContent = contadores.progress;
  document.getElementById("count-blocked").textContent = contadores.blocked;
  document.getElementById("count-done").textContent = contadores.done;
}

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

function permitirSoltar(e) { e.preventDefault(); }

async function soltar(e, destinoKey) {
  e.preventDefault();
  if (!config.token) {
    alert("Para mover tarjetas en GitHub se requiere un Token con permisos.");
    abrirModalAuth();
    return;
  }

  const issueNumber = parseInt(e.dataTransfer.getData("text/plain"), 10);
  const issue = cachedIssues.find(i => i.number === issueNumber);
  if (!issue) return;

  const origenKey = clasificarColumna(issue);
  if (origenKey === destinoKey) return;

  // Actualización optimista
  if (destinoKey === "done") {
    issue.state = "closed";
  } else {
    issue.state = "open";
    issue.labels = (issue.labels || []).filter(l => {
      const name = typeof l === "string" ? l : l.name;
      return !Object.values(COLUMN_LABELS).includes(name);
    });
    if (COLUMN_LABELS[destinoKey]) {
      issue.labels.push({ name: COLUMN_LABELS[destinoKey], color: "30363d" });
    }
  }

  renderizarKanban();

  try {
    if (destinoKey === "done") {
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
    cargarKanban();
  }
}

// ----------------------------------------------------
// 2. LÓGICA DE DOCS / WIKI
// ----------------------------------------------------
async function cargarDocs() {
  const treeEl = document.getElementById("docsFileList");
  treeEl.innerHTML = `<li class="loading">Cargando guías desde /docs...</li>`;

  try {
    cachedDocs = await githubRequest("/contents/docs");
    treeEl.innerHTML = "";

    const mdFiles = cachedDocs.filter(item => item.type === "file" && item.name.endsWith(".md"));

    if (mdFiles.length === 0) {
      treeEl.innerHTML = `<li class="loading">No hay archivos Markdown en /docs</li>`;
      return;
    }

    mdFiles.forEach((file, idx) => {
      const li = document.createElement("li");
      li.id = `doc-item-${file.name}`;
      li.innerHTML = `<a href="javascript:void(0)" onclick="mostrarDoc('${file.path}', '${file.name}', '${file.html_url}')">📄 ${file.name}</a>`;
      treeEl.appendChild(li);

      // Cargar el primero automáticamente
      if (idx === 0) {
        mostrarDoc(file.path, file.name, file.html_url);
      }
    });
  } catch (err) {
    treeEl.innerHTML = `<li class="loading">Error al leer /docs: ${err.message}</li>`;
  }
}

async function mostrarDoc(path, filename, htmlUrl) {
  document.querySelectorAll(".docs-tree li").forEach(li => li.classList.remove("active"));
  const currentItem = document.getElementById(`doc-item-${filename}`);
  if (currentItem) currentItem.classList.add("active");

  document.getElementById("currentDocTitle").textContent = filename;
  const linkBtn = document.getElementById("githubDocLink");
  linkBtn.href = htmlUrl;
  document.getElementById("docActions").style.display = "block";

  const contentArea = document.getElementById("docContent");
  contentArea.innerHTML = `<p class="loading">Descargando ${filename}...</p>`;

  try {
    const data = await githubRequest(`/contents/${path}`);
    // Decodificar Base64 UTF-8
    const rawMarkdown = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ""))));
    contentArea.innerHTML = marked.parse(rawMarkdown);
  } catch (err) {
    contentArea.innerHTML = `<p style="color: var(--blocked);">Error al cargar documento: ${err.message}</p>`;
  }
}

// ----------------------------------------------------
// 3. LÓGICA DE SPRINTS / MILESTONES
// ----------------------------------------------------
async function cargarSprints() {
  const container = document.getElementById("sprintsList");
  container.innerHTML = `<div class="loading">Cargando hitos de GitHub...</div>`;

  try {
    const milestones = await githubRequest("/milestones?state=all");
    if (!milestones.length) {
      container.innerHTML = `<p class="placeholder-text">No hay Milestones creados en este repositorio todavía.</p>`;
      return;
    }

    container.innerHTML = milestones.map(m => {
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

// ----------------------------------------------------
// 4. LÓGICA DE ACTIVIDAD (COMMITS)
// ----------------------------------------------------
async function cargarActividad() {
  const container = document.getElementById("activityList");
  container.innerHTML = `<div class="loading">Cargando commits recientes...</div>`;

  try {
    const commits = await githubRequest("/commits?per_page=20");
    container.innerHTML = commits.map(c => `
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

// ----------------------------------------------------
// MODALES Y FORMULARIOS (CREACIÓN HACIA GITHUB)
// ----------------------------------------------------
function abrirModalAuth() {
  document.getElementById("cfgRepoSlug").value = config.repoSlug || "jmrodev/daily-board";
  document.getElementById("cfgUserToken").value = config.token || "";
  document.getElementById("authModal").showModal();
}

function cerrarModalAuth() {
  document.getElementById("authModal").close();
}

function guardarToken(e) {
  e.preventDefault();
  const repoSlug = document.getElementById("cfgRepoSlug").value.trim();
  const token = document.getElementById("cfgUserToken").value.trim();

  config.repoSlug = repoSlug || "jmrodev/daily-board";
  config.token = token;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  actualizarUIAuth();
  cerrarModalAuth();
  recargarDatosActuales();
}

function limpiarAuth() {
  config.token = "";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  actualizarUIAuth();
  cerrarModalAuth();
  recargarDatosActuales();
}

function actualizarUIAuth() {
  document.getElementById("repoSubtitle").textContent = config.repoSlug;
  const dot = document.getElementById("authDot");
  const label = document.getElementById("authLabel");

  if (config.token) {
    dot.classList.add("active");
    label.textContent = "Conectado (Lectura & Escritura)";
  } else {
    dot.classList.remove("active");
    label.textContent = "Modo Lectura (Público)";
  }
}

function abrirModalNuevaTarea() {
  if (!config.token) {
    alert("Para crear un issue en GitHub necesitás conectar tu token.");
    abrirModalAuth();
    return;
  }
  document.getElementById("newIssueModal").showModal();
}

async function crearNuevoIssue(e) {
  e.preventDefault();
  const title = document.getElementById("newTitle").value.trim();
  const body = document.getElementById("newBody").value.trim();
  const column = document.getElementById("newColumn").value;

  const labels = [];
  if (COLUMN_LABELS[column]) labels.push(COLUMN_LABELS[column]);

  try {
    const nuevo = await githubRequest("/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, labels })
    });
    cachedIssues.unshift(nuevo);
    renderizarKanban();
    document.getElementById("newIssueModal").close();
    document.getElementById("newTitle").value = "";
    document.getElementById("newBody").value = "";
  } catch (err) {
    alert("Error al crear issue: " + err.message);
  }
}

function abrirModalNuevoDoc() {
  if (!config.token) {
    alert("Para crear un documento en GitHub necesitás conectar tu token.");
    abrirModalAuth();
    return;
  }
  document.getElementById("newDocModal").showModal();
}

async function crearNuevoDoc(e) {
  e.preventDefault();
  let filename = document.getElementById("newDocFilename").value.trim();
  if (!filename.endsWith(".md")) filename += ".md";

  const content = document.getElementById("newDocContent").value;
  // Codificar a Base64 UTF-8
  const b64Content = btoa(unescape(encodeURIComponent(content)));

  try {
    await githubRequest(`/contents/docs/${filename}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `docs: agregar ${filename} desde Classroom Hub`,
        content: b64Content
      })
    });
    document.getElementById("newDocModal").close();
    document.getElementById("newDocFilename").value = "";
    document.getElementById("newDocContent").value = "";
    cargarDocs();
  } catch (err) {
    alert("Error al guardar documento en GitHub: " + err.message);
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
