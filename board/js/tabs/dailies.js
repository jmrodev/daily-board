// js/tabs/dailies.js - Lógica aislada de Dailies conectada a /dailies/
import { state, escapeHtml } from "../state.js";
import { githubRequest } from "../api.js";

let cachedDailyTree = [];

export async function loadDailies() {
  const treeEl = document.getElementById("dailiesDatesList");
  treeEl.innerHTML = `<li class="loading">Buscando fechas en /dailies...</li>`;

  try {
    const items = await githubRequest("/contents/dailies");
    // Puede haber carpetas por fecha (YYYY-MM-DD) o archivos legacy (.md)
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
      const data = await githubRequest(`/contents/${folderItem.path}`);
      const rawMarkdown = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ""))));
      contentArea.innerHTML = window.marked ? window.marked.parse(rawMarkdown) : rawMarkdown;
    } catch (err) {
      contentArea.innerHTML = `<p style="color: var(--blocked);">Error al cargar daily: ${err.message}</p>`;
    }
    return;
  }

  // Si es una carpeta con archivos individuales por usuario (/dailies/YYYY-MM-DD/usuario.md)
  try {
    const userFiles = await githubRequest(`/contents/${folderItem.path}`);
    const mdFiles = userFiles.filter(f => f.type === "file" && f.name.endsWith(".md"));

    if (mdFiles.length === 0) {
      contentArea.innerHTML = `<p class="placeholder-text">No hay reportes cargados aún para esta fecha.</p>`;
      return;
    }

    // Cargar todos los reportes de los alumnos de ese día en paralelo
    const reports = await Promise.all(
      mdFiles.map(async file => {
        try {
          const fileData = await githubRequest(`/contents/${file.path}`);
          const raw = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ""))));
          return `<div class="daily-user-card">${window.marked ? window.marked.parse(raw) : raw}</div>`;
        } catch {
          return "";
        }
      })
    );

    contentArea.innerHTML = reports.join("<hr style='border: 0; border-top: 1px solid var(--border); margin: 24px 0;' />");
  } catch (err) {
    contentArea.innerHTML = `<p style="color: var(--blocked);">Error al leer la carpeta de dailies: ${err.message}</p>`;
  }
}
