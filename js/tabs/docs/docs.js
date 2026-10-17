// js/tabs/docs/docs.js - Lógica aislada de Documentación / Wiki
import { state } from "../../state.js";
import { githubRequest } from "../../api.js";

export async function loadDocs() {
  const treeEl = document.getElementById("docsFileList");
  treeEl.innerHTML = `<li class="loading">Cargando guías desde /docs...</li>`;

  try {
    state.docs = await githubRequest("/contents/docs");
    treeEl.innerHTML = "";

    const mdFiles = state.docs.filter(item => item.type === "file" && item.name.endsWith(".md"));

    if (mdFiles.length === 0) {
      treeEl.innerHTML = `<li class="loading">No hay archivos Markdown en /docs</li>`;
      return;
    }

    mdFiles.forEach((file, idx) => {
      const li = document.createElement("li");
      li.id = `doc-item-${file.name}`;
      li.innerHTML = `<a href="javascript:void(0)" data-path="${file.path}">📄 ${file.name}</a>`;
      li.querySelector("a").addEventListener("click", () => showDoc(file.path, file.name, file.html_url));
      treeEl.appendChild(li);

      if (idx === 0) {
        showDoc(file.path, file.name, file.html_url);
      }
    });
  } catch (err) {
    treeEl.innerHTML = `<li class="loading">Error al leer /docs: ${err.message}</li>`;
  }
}

export async function showDoc(path, filename, htmlUrl) {
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
    const rawMarkdown = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ""))));
    contentArea.innerHTML = window.marked ? window.marked.parse(rawMarkdown) : rawMarkdown;
  } catch (err) {
    contentArea.innerHTML = `<p style="color: var(--blocked);">Error al cargar documento: ${err.message}</p>`;
  }
}
