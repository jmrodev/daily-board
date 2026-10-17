// js/tabs/dailies.js - Lógica aislada de Dailies conectada a /dailies/
import { state, escapeHtml } from "../state.js";
import { githubRequest } from "../api.js";

let cachedDailiesList = [];

export async function loadDailies() {
  const treeEl = document.getElementById("dailiesDatesList");
  treeEl.innerHTML = `<li class="loading">Buscando fechas en /dailies...</li>`;

  try {
    const items = await githubRequest("/contents/dailies");
    cachedDailiesList = items.filter(item => item.type === "file" && item.name.endsWith(".md"));

    if (cachedDailiesList.length === 0) {
      treeEl.innerHTML = `<li class="loading">No hay registros aún en /dailies</li>`;
      document.getElementById("dailyContent").innerHTML = `<p class="placeholder-text">Sé el primero en registrar el Daily de hoy con el botón "➕ Registrar mi Daily".</p>`;
      return;
    }

    // Ordenar fechas descendente (la más reciente primero)
    cachedDailiesList.sort((a, b) => b.name.localeCompare(a.name));

    treeEl.innerHTML = "";
    cachedDailiesList.forEach((file, idx) => {
      const dateName = file.name.replace(".md", "");
      const li = document.createElement("li");
      li.id = `daily-item-${file.name}`;
      li.innerHTML = `<a href="javascript:void(0)">📅 ${dateName}</a>`;
      li.querySelector("a").addEventListener("click", () => showDaily(file.path, file.name, file.html_url));
      treeEl.appendChild(li);

      if (idx === 0) {
        showDaily(file.path, file.name, file.html_url);
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

export async function showDaily(path, filename, htmlUrl) {
  document.querySelectorAll(".dailies-tree li").forEach(li => li.classList.remove("active"));
  const currentItem = document.getElementById(`daily-item-${filename}`);
  if (currentItem) currentItem.classList.add("active");

  const dateLabel = filename.replace(".md", "");
  document.getElementById("currentDailyTitle").textContent = `Daily del ${dateLabel}`;
  const linkBtn = document.getElementById("githubDailyLink");
  linkBtn.href = htmlUrl;
  document.getElementById("dailyActions").style.display = "block";

  const contentArea = document.getElementById("dailyContent");
  contentArea.innerHTML = `<p class="loading">Cargando reporte del día...</p>`;

  try {
    const data = await githubRequest(`/contents/${path}`);
    const rawMarkdown = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ""))));
    contentArea.innerHTML = window.marked ? window.marked.parse(rawMarkdown) : rawMarkdown;
  } catch (err) {
    contentArea.innerHTML = `<p style="color: var(--blocked);">Error al cargar daily: ${err.message}</p>`;
  }
}
