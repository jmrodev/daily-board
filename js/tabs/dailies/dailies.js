// js/tabs/dailies/dailies.js - Lógica aislada de Dailies conectada a /dailies/ con vista tabular compacta
import { state, escapeHtml } from "../../state.js";
import { githubRequest } from "../../api.js";

export async function loadDailies() {
  const treeEl = document.getElementById("dailiesDatesList");
  treeEl.innerHTML = `<li class="loading">Buscando fechas en /dailies...</li>`;

  try {
    const items = await githubRequest("/contents/dailies?ref=gh-pages");
    const dateFolders = items.filter(item => item.type === "dir" || (item.type === "file" && item.name.endsWith(".md")));

    if (dateFolders.length === 0) {
      treeEl.innerHTML = `<li class="loading">No hay registros aún en /dailies</li>`;
      document.getElementById("dailyContent").innerHTML = `<p class="placeholder-text">Sé el primero en registrar el Daily de hoy con el botón "➕ Registrar mi Daily".</p>`;
      return;
    }

    // Ordenar fechas descendente (la más reciente primero)
    dateFolders.sort((a, b) => b.name.localeCompare(a.name));

    treeEl.innerHTML = "";
    dateFolders.forEach((folder, idx) => {
      const dateName = folder.name.replace(".md", "");
      const li = document.createElement("li");
      li.id = `daily-folder-${dateName}`;
      li.innerHTML = `<a href="javascript:void(0)">📅 ${dateName}</a>`;
      li.querySelector("a").addEventListener("click", () => showDateReports(folder));
      treeEl.appendChild(li);

      if (idx === 0) {
        showDateReports(folder);
      }
    });
  } catch (err) {
    if (err.message.includes("404")) {
      treeEl.innerHTML = `<li class="loading">La carpeta /dailies está vacía.</li>`;
    } else {
      treeEl.innerHTML = `<li class="loading">Error al cargar dailies: ${err.message}</li>`;
    }
  }
}

async function showDateReports(folderItem) {
  const dateName = folderItem.name.replace(".md", "");
  document.querySelectorAll(".dailies-tree li").forEach(li => li.classList.remove("active"));
  const currentItem = document.getElementById(`daily-folder-${dateName}`);
  if (currentItem) currentItem.classList.add("active");

  document.getElementById("currentDailyTitle").textContent = `Dailies del ${dateName}`;
  const linkBtn = document.getElementById("githubDailyLink");
  linkBtn.href = folderItem.html_url;
  document.getElementById("dailyActions").style.display = "block";

  const contentArea = document.getElementById("dailyContent");
  contentArea.innerHTML = `<p class="loading">Cargando reportes del equipo...</p>`;

  // Si es un archivo directo legacy (YYYY-MM-DD.md)
  if (folderItem.type === "file") {
    try {
      const data = await githubRequest(`/contents/${folderItem.path}?ref=gh-pages`);
      const rawMarkdown = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ""))));
      contentArea.innerHTML = window.marked ? window.marked.parse(rawMarkdown) : rawMarkdown;
    } catch (err) {
      contentArea.innerHTML = `<p style="color: var(--blocked);">Error al cargar daily: ${err.message}</p>`;
    }
    return;
  }

  // Si es una carpeta con archivos individuales por usuario (/dailies/YYYY-MM-DD/usuario.md)
  try {
    const userFiles = await githubRequest(`/contents/${folderItem.path}?ref=gh-pages`);
    const mdFiles = userFiles.filter(f => f.type === "file" && f.name.endsWith(".md"));

    if (mdFiles.length === 0) {
      contentArea.innerHTML = `<p class="placeholder-text">No hay reportes cargados aún para esta fecha.</p>`;
      return;
    }

    // Cargar todos los reportes de los alumnos de ese día en paralelo
    const parsedReports = await Promise.all(
      mdFiles.map(async file => {
        try {
          const fileData = await githubRequest(`/contents/${file.path}?ref=gh-pages`);
          const raw = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ""))));
          const username = file.name.replace(".md", "");
          return parseDailyMarkdown(raw, username);
        } catch {
          return null;
        }
      })
    );

    const validReports = parsedReports.filter(Boolean);
    if (validReports.length === 0) {
      contentArea.innerHTML = `<p class="placeholder-text">No se pudieron leer los reportes de este día.</p>`;
      return;
    }

    contentArea.innerHTML = renderDailyTable(validReports);
  } catch (err) {
    contentArea.innerHTML = `<p style="color: var(--blocked);">Error al leer la carpeta de dailies: ${err.message}</p>`;
  }
}

function parseDailyMarkdown(rawMarkdown, defaultUsername) {
  let author = `@${defaultUsername}`;
  const authorMatch = rawMarkdown.match(/\*\*Autor:\*\*\s*@?([^\n]+)/);
  if (authorMatch) author = authorMatch[1].trim();

  // Extraer las 3 respuestas
  // 1. ¿Qué hiciste ayer? ... 2. ¿Qué tenés pensado hacer hoy? ... 3. ¿Tenés algún bloqueo o impedimento?
  let done = "";
  let plan = "";
  let blocker = "";

  const q1Match = rawMarkdown.match(/###\s*1\.[^\n]*\n([\s\S]*?)(?=###\s*2\.|$)/);
  if (q1Match) done = q1Match[1].trim();

  const q2Match = rawMarkdown.match(/###\s*2\.[^\n]*\n([\s\S]*?)(?=###\s*3\.|$)/);
  if (q2Match) plan = q2Match[1].trim();

  const q3Match = rawMarkdown.match(/###\s*3\.[^\n]*\n([\s\S]*?)(?=$)/);
  if (q3Match) blocker = q3Match[1].trim();

  // Si no coincidieron las cabeceras exactas, fallback a líneas
  if (!done && !plan) {
    done = rawMarkdown;
  }

  return {
    author: author.startsWith("@") ? author : `@${author}`,
    done: done || "—",
    plan: plan || "—",
    blocker: blocker || "Ninguno"
  };
}

function renderDailyTable(reports) {
  const rows = reports.map(r => {
    const username = r.author.replace("@", "");
    const avatarUrl = `https://github.com/${username}.png?size=32`;
    const isBlocker = r.blocker && r.blocker.toLowerCase() !== "ninguno" && r.blocker !== "—";

    const doneHtml = window.marked ? window.marked.parse(r.done) : escapeHtml(r.done);
    const planHtml = window.marked ? window.marked.parse(r.plan) : escapeHtml(r.plan);
    const blockerHtml = window.marked ? window.marked.parse(r.blocker) : escapeHtml(r.blocker);

    return `
      <tr>
        <td class="td-author">
          <div class="daily-author-cell">
            <img src="${avatarUrl}" class="daily-table-avatar" onerror="this.src='https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'" alt="${username}">
            <strong class="daily-author-name">${escapeHtml(r.author)}</strong>
          </div>
        </td>
        <td class="td-done markdown-body">
          ${doneHtml}
        </td>
        <td class="td-plan markdown-body">
          ${planHtml}
        </td>
        <td class="td-blocker markdown-body ${isBlocker ? "has-blocker" : ""}">
          ${blockerHtml}
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div class="daily-table-wrapper">
      <table class="daily-table">
        <thead>
          <tr>
            <th style="width: 170px;">Miembro</th>
            <th>✅ Logrado ayer / reciente</th>
            <th>🎯 Plan para hoy</th>
            <th style="width: 220px;">🚧 Bloqueos</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}
