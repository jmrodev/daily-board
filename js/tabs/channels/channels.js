// js/tabs/channels/channels.js - Lógica aislada de Canales de Discusión (Slack-like)
import { state, escapeHtml } from "../../state.js";
import { githubRequest } from "../../api.js";

export const DEFAULT_CHANNELS = [
  { id: "general", name: "💬 general", desc: "Charla general del equipo y consultas rápidas" },
  { id: "anuncios", name: "📢 anuncios", desc: "Novedades importantes del proyecto y entregas" },
  { id: "bloqueos", name: "🚧 bloqueos-y-ayuda", desc: "¿Trascendió un bug? Pedí una mano acá" },
  { id: "links-utiles", name: "🔗 links-utiles", desc: "Recursos, documentación externa y tutoriales" }
];

let activeChannel = "general";

export async function loadChannels() {
  renderChannelsSidebar();
  await loadChannelMessages(activeChannel);
}

export function getActiveChannel() {
  return activeChannel;
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

    li.querySelector("a").addEventListener("click", () => {
      if (activeChannel === ch.id) return;
      activeChannel = ch.id;
      document.querySelectorAll(".channels-tree li").forEach(item => item.classList.remove("active"));
      li.classList.add("active");
      loadChannelMessages(activeChannel);
    });

    listEl.appendChild(li);
  });
}

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
    const mdFiles = items.filter(item => item.type === "file" && item.name.endsWith(".md"));

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
          return parseMessageMarkdown(raw, file.name);
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
    // Scroll al último mensaje
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

function parseMessageMarkdown(rawMarkdown, filename) {
  // Extraer metadata si existe cabecera YAML/Markdown
  // Formato:
  // **Autor:** @username
  // **Fecha:** 2026-10-17 04:30
  let author = "Anónimo";
  let timestamp = "";
  let content = rawMarkdown;

  const authorMatch = rawMarkdown.match(/\*\*Autor:\*\*\s*@?([^\n]+)/);
  if (authorMatch) {
    author = authorMatch[1].trim();
  }

  const dateMatch = rawMarkdown.match(/\*\*Fecha:\*\*\s*([^\n]+)/);
  if (dateMatch) {
    timestamp = dateMatch[1].trim();
  } else {
    // Tomar del nombre del archivo si es posible: 20261017-043000-username.md
    const fileParts = filename.replace(".md", "").split("-");
    if (fileParts.length >= 2) {
      timestamp = `${fileParts[0]} ${fileParts[1]}`;
    }
  }

  // Quitar la metadata para renderizar solo el cuerpo del mensaje
  content = rawMarkdown
    .replace(/\*\*Autor:\*\*[^\n]+\n?/, "")
    .replace(/\*\*Fecha:\*\*[^\n]+\n?/, "")
    .replace(/^---\s*\n?/m, "")
    .trim();

  const renderedBody = window.marked ? window.marked.parse(content) : escapeHtml(content);
  const avatarUrl = `https://github.com/${author.replace("@", "")}.png?size=40`;

  return `
    <article class="chat-message-item">
      <img src="${avatarUrl}" class="chat-avatar" onerror="this.src='https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'" alt="${author}">
      <div class="chat-message-content">
        <div class="chat-message-header">
          <span class="chat-author">@${escapeHtml(author.replace("@", ""))}</span>
          <span class="chat-time">${escapeHtml(timestamp)}</span>
        </div>
        <div class="chat-message-body markdown-body">
          ${renderedBody}
        </div>
      </div>
    </article>
  `;
}
