import { state, COLUMN_LABELS } from "../../state.js";
import { githubRequest } from "../../api.js";
import { showToast, showConfirmDialog } from "../../toast.js";
import { classifyColumn, renderKanban, loadKanban } from "./kanban.js";

let draggedCard = null;

export function onDragStart(e) {
  draggedCard = e.currentTarget;
  draggedCard.classList.add("dragging");
  e.dataTransfer.setData("text/plain", draggedCard.dataset.number);
}

export function onDragEnd() {
  if (draggedCard) {
    draggedCard.classList.remove("dragging");
    draggedCard = null;
  }
}

export async function handleDrop(e, targetCol) {
  e.preventDefault();

  // Regla estricta 1: Nadie puede arrastrar manualmente a Listo
  if (targetCol === "done") {
    showToast("🔒 La columna 'Listo' está protegida:\nSolo se completa automáticamente cuando se aceptan los 2 reviews y se fusiona el PR en GitHub.", "warning", 5000);
    return;
  }

  if (!state.config.token) {
    showToast("Para mover tareas en GitHub se requiere un Token con permisos de escritura.", "warning");
    return;
  }

  const issueNumber = parseInt(e.dataTransfer.getData("text/plain"), 10);
  const issue = state.issues.find(i => i.number === issueNumber);
  if (!issue) return;

  const currentCol = classifyColumn(issue);
  if (currentCol === targetCol) return;

  // Regla estricta 2: No pasar a En Curso si no tiene responsable asignado
  let autoAssigned = false;
  if (targetCol === "progress" && !issue.assignee) {
    if (state.user && state.user.username) {
      const confirmed = await showConfirmDialog({
        title: "⚠️ Asignación requerida",
        message: `Para pasar una tarea a 'En Curso' debe tener un responsable asignado.\n\n¿Querés asignártela a vos (@${state.user.username}) ahora?`
      });
      if (!confirmed) return;
      issue.assignee = { login: state.user.username };
      autoAssigned = true;
    } else {
      showToast("⚠️ Regla de flujo: No podés pasar una tarea a 'En Curso' sin antes tener un responsable asignado.", "warning");
      return;
    }
  }

  // Actualización optimista en memoria (solo para todo, progress o blocked)
  issue.state = "open";
  issue.labels = (issue.labels || []).filter(l => {
    const name = typeof l === "string" ? l : l.name;
    return !Object.values(COLUMN_LABELS).includes(name);
  });
  if (COLUMN_LABELS[targetCol]) {
    issue.labels.push({ name: COLUMN_LABELS[targetCol], color: "30363d" });
  }

  renderKanban();

  // Sincronización remota con GitHub
  try {
    const labelNames = (issue.labels || []).map(l => (typeof l === "string" ? l : l.name));
    const patchPayload = { state: "open", labels: labelNames };
    if (autoAssigned) {
      patchPayload.assignees = [state.user.username];
    }
    await githubRequest(`/issues/${issueNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchPayload)
    });
    showToast(`Tarea #${issueNumber} actualizada en GitHub`, "success", 2500);
  } catch (err) {
    showToast("Error al sincronizar con GitHub: " + err.message, "error");
    loadKanban(); // Revertir con el estado remoto
  }
}

// Función global para auto-asignarse un issue con un click
window.selfAssignIssue = async function (issueNumber) {
  if (!state.config.token || !state.user) {
    showToast("Iniciá sesión con tu token de GitHub para asignarte esta tarea.", "info");
    import("../modals.js").then(m => m.openAuthModal());
    return;
  }

  const issue = state.issues.find(i => i.number === issueNumber);
  if (!issue) return;

  const username = state.user.username;
  issue.assignee = { login: username };
  renderKanban();

  try {
    await githubRequest(`/issues/${issueNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignees: [username] })
    });
    showToast(`Te asignaste la tarea #${issueNumber}`, "success", 2500);
  } catch (err) {
    showToast("Error al asignar tarea en GitHub: " + err.message, "error");
    loadKanban();
  }
};
