// js/toast.js - Sistema de notificaciones no bloqueantes (Toasts modernos)

export function showToast(message, type = "info", duration = 4000) {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast-item toast-${type}`;

  const iconMap = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    error: "❌"
  };

  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || "ℹ️"}</span>
    <div class="toast-message">${message.replace(/\n/g, "<br>")}</div>
    <button class="toast-close" aria-label="Cerrar">&times;</button>
  `;

  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.classList.add("toast-leaving");
    setTimeout(() => toast.remove(), 250);
  });

  container.appendChild(toast);

  // Animación de entrada
  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  // Auto-cierre
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add("toast-leaving");
      setTimeout(() => toast.remove(), 250);
    }
  }, duration);
}

export function showConfirmDialog({ title = "Confirmación", message = "¿Deseas continuar?" }) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    const titleEl = document.getElementById("confirmModalTitle");
    const msgEl = document.getElementById("confirmModalMessage");
    const btnOk = document.getElementById("btnConfirmOk");
    const btnCancel = document.getElementById("btnConfirmCancel");

    titleEl.textContent = title;
    msgEl.textContent = message;

    const cleanup = () => {
      btnOk.removeEventListener("click", onOk);
      btnCancel.removeEventListener("click", onCancel);
      modal.removeEventListener("close", onCancel);
    };

    const onOk = () => {
      cleanup();
      modal.close();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      modal.close();
      resolve(false);
    };

    btnOk.addEventListener("click", onOk);
    btnCancel.addEventListener("click", onCancel);
    modal.addEventListener("close", onCancel, { once: true });

    modal.showModal();
  });
}
