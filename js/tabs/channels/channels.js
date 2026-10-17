// js/tabs/channels/channels.js - Lógica aislada de Canales de Discusión y Novedades (Slack-like)
import { state, escapeHtml } from "../../state.js";
import { githubRequest } from "../../api.js";

export const DEFAULT_CHANNELS = [
  { id: "novedades", name: "🔥 novedades", desc: "Resumen de lo último publicado en cada canal para estar al día", isSummary: true },
  { id: "general", name: "💬 general", desc: "Charla general del equipo y consultas rápidas" },
  { id: "anuncios", name: "📢 anuncios", desc: "Novedades importantes del proyecto y entregas" },
  { id: "bloqueos", name: "🚧 bloqueos-y-ayuda", desc: "¿Trascendió un bug? Pedí una mano acá" },
  { id: "links-utiles", name: "🔗 links-utiles", desc: "Recursos, documentación externa y tutoriales" }
];

let activeChannel = "novedades";

export async function loadChannels() {
  renderChannelsSidebar();
  await switchChannel(activeChannel);
}

export function getActiveChannel() {
  return activeChannel;
}

export async function switchChannel(channelId) {
  activeChannel = channelId;
  document.querySelectorAll(".channels-tree li").forEach(item => {
    item.classList.toggle("active", item.id === `channel-item-${channelId}`);
  });

  const composerContainer = document.getElementById("chatComposerContainer");
  const isSummary = channelId === "novedades";

  // En la vista de novedades no se redacta directamente, es un dashboard agregador
  if (composerContainer) {
    composerContainer.style.display = isSummary ? "none" : "block";
  }

  if (isSummary) {
    await renderNovedadesDashboard();
  } else {
    await loadChannelMessages(channelId);
  }
}

function renderChannelsSidebar() {
  const listEl = document.getElementById("channelsList");
  if (!listEl) return;

  listEl.innerHTML = "";
  DEFAULT_CHANNELS.forEach(ch => {
    const li = document.createElement("li");
    li.id = `channel-item-${ch.id}`;
    if (ch.id === activeChannel) li.classList.add("active");

    li.innerHTML = `
      <a href="javascript:void(0)" class="channel-link">
        <span class="channel-name">${ch.name}</span>
      </a>
    `;

    li.querySelector("a").addEventListener("click", () => switchChannel(ch.id));
    listEl.appendChild(li);
  });
}

// Carga y renderiza el Dashboard de Novedades (últimos mensajes de todos los canales)
async function renderNovedadesDashboard() {
  const titleEl = document.getElementById("currentChannelTitle");
  const descEl = document.getElementById("currentChannelDesc");
  const feedEl = document.getElementById("channelMessagesFeed");

  if (titleEl) titleEl.textContent = "🔥 novedades";
  if (descEl) descEl.textContent = "";
  if (feedEl) feedEl.innerHTML = `<p class="loading">Cargando novedades...</p>`;

  const chatChannels = DEFAULT_CHANNELS.filter(c => !c.isSummary);

  try {
    const channelSummaries = await Promise.all(
      chatChannels.map(async ch => {
        try {
          const items = await githubRequest(`/contents/canales/${ch.id}?ref=gh-pages`);
          const mdFiles = (items || []).filter(item => item.type === "file" && item.name.endsWith(".md") && !item.name.toLowerCase().includes("readme"));
          
          if (mdFiles.length === 0) {
            return { ...ch, latestMessage: null, total: 0 };
          }

          // Ordenar descendente para tomar el más reciente
          mdFiles.sort((a, b) => b.name.localeCompare(a.name));
          const latestFile = mdFiles[0];

          const fileData = await githubRequest(`/contents/${latestFile.path}?ref=gh-pages`);
          const raw = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ""))));
          
          return {
            ...ch,
            latestMessage: parseMessageData(raw, latestFile.name),
            total: mdFiles.length
          };
        } catch {
          return { ...ch, latestMessage: null, total: 0 };
        }
      })
    );

    let html = `<div class="novedades-grid">`;

    channelSummaries.forEach(ch => {
      if (!ch.latestMessage) {
        html += `
          <div class="novedad-card empty-card" onclick="window.jumpToChannel('${ch.id}')">
            <div class="novedad-card-head">
              <h4>${ch.name}</h4>
              <span class="badge-empty">Sin mensajes</span>
            </div>
            <p class="novedad-empty-text">No hay mensajes recientes en este canal.</p>
            <span class="novedad-jump-btn">Ir al canal ↗</span>
          </div>
        `;
        return;
      }

      const msg = ch.latestMessage;
      const avatarUrl = `https://github.com/${msg.author.replace("@", "")}.png?size=32`;

      html += `
        <div class="novedad-card" onclick="window.jumpToChannel('${ch.id}')">
          <div class="novedad-card-head">
            <h4>${ch.name}</h4>
            <span class="badge-count">${ch.total} mensaje${ch.total === 1 ? "" : "s"}</span>
          </div>
          
          <div class="novedad-preview-meta">
            <img src="${avatarUrl}" class="novedad-avatar" onerror="this.src='https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'">
            <div>
              <strong class="novedad-author">${escapeHtml(msg.author)}</strong>
              <small class="novedad-date">${escapeHtml(msg.timestamp)}</small>
            </div>
          </div>

          <div class="novedad-body markdown-body">
            ${msg.renderedHtml}
          </div>

          <div class="novedad-footer">
            <span class="novedad-jump-btn">Abrir conversación completa en ${ch.name} ↗</span>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    feedEl.innerHTML = html;
  } catch (err) {
    feedEl.innerHTML = `<p style="color: var(--blocked);">Error al cargar novedades: ${err.message}</p>`;
  }
}

window.jumpToChannel = function (channelId) {
  switchChannel(channelId);
};

export async function loadChannelMessages(channelId) {
  const currentCh = DEFAULT_CHANNELS.find(c => c.id === channelId) || { name: `#${channelId}`, desc: "" };
  
  const titleEl = document.getElementById("currentChannelTitle");
  const descEl = document.getElementById("currentChannelDesc");
  const feedEl = document.getElementById("channelMessagesFeed");

  if (titleEl) titleEl.textContent = currentCh.name;
  if (descEl) descEl.textContent = currentCh.desc;
  if (feedEl) feedEl.innerHTML = `<p class="loading">Cargando mensajes de ${currentCh.name}...</p>`;

  const path = `canales/${channelId}`;

  try {
    const items = await githubRequest(`/contents/${path}?ref=gh-pages`);
    // Ignorar README de inicialización
    const mdFiles = (items || []).filter(item => item.type === "file" && item.name.endsWith(".md") && !item.name.toLowerCase().includes("readme"));

    if (mdFiles.length === 0) {
      feedEl.innerHTML = `
        <div class="empty-channel">
          <p class="placeholder-text">No hay mensajes todavía en este canal.</p>
          <small>Escribí el primer mensaje abajo para iniciar la conversación.</small>
        </div>
      `;
      return;
    }

    // Ordenar cronológicamente (los archivos comienzan con timestamp YYYYMMDD-HHMMSS)
    mdFiles.sort((a, b) => a.name.localeCompare(b.name));

    // Descargar mensajes en paralelo
    const messageCards = await Promise.all(
      mdFiles.map(async file => {
        try {
          const fileData = await githubRequest(`/contents/${file.path}?ref=gh-pages`);
          const raw = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ""))));
          return renderChatMessageCard(raw, file.name);
        } catch {
          return null;
        }
      })
    );

    const validCards = messageCards.filter(Boolean);
    if (validCards.length === 0) {
      feedEl.innerHTML = `<p class="placeholder-text">No se pudieron leer los mensajes.</p>`;
      return;
    }

    feedEl.innerHTML = validCards.join("");
    feedEl.scrollTop = feedEl.scrollHeight;
  } catch (err) {
    if (err.message.includes("404")) {
      feedEl.innerHTML = `
        <div class="empty-channel">
          <p class="placeholder-text">Canal limpio. Todavía no se publicaron mensajes.</p>
          <small>Sé el primero en escribir abajo.</small>
        </div>
      `;
    } else {
      feedEl.innerHTML = `<p style="color: var(--blocked);">Error al cargar canal: ${err.message}</p>`;
    }
  }
}

function parseMessageData(rawMarkdown, filename) {
  let author = "Anónimo";
  let timestamp = "";
  let content = rawMarkdown;

  const authorMatch = rawMarkdown.match(/\*\*Autor:\*\*\s*@?([^\n]+)/);
  if (authorMatch) author = authorMatch[1].trim();

  const dateMatch = rawMarkdown.match(/\*\*Fecha:\*\*\s*([^\n]+)/);
  if (dateMatch) {
    timestamp = dateMatch[1].trim();
  } else {
    const fileParts = filename.replace(".md", "").split("-");
    if (fileParts.length >= 2) timestamp = `${fileParts[0]} ${fileParts[1]}`;
  }

  content = rawMarkdown
    .replace(/\*\*Autor:\*\*[^\n]+\n?/, "")
    .replace(/\*\*Fecha:\*\*[^\n]+\n?/, "")
    .replace(/^---\s*\n?/m, "")
    .trim();

  const renderedHtml = window.marked ? window.marked.parse(content) : escapeHtml(content);

  return { author, timestamp, content, renderedHtml };
}

function renderChatMessageCard(rawMarkdown, filename) {
  const data = parseMessageData(rawMarkdown, filename);
  const avatarUrl = `https://github.com/${data.author.replace("@", "")}.png?size=40`;

  return `
    <article class="chat-message-item">
      <img src="${avatarUrl}" class="chat-avatar" onerror="this.src='https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'" alt="${data.author}">
      <div class="chat-message-content">
        <div class="chat-message-header">
          <span class="chat-author">@${escapeHtml(data.author.replace("@", ""))}</span>
          <span class="chat-time">${escapeHtml(data.timestamp)}</span>
        </div>
        <div class="chat-message-body markdown-body">
          ${data.renderedHtml}
        </div>
      </div>
    </article>
  `;
}
