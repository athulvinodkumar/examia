// =====================================================================
// EXAMIA TOAST NOTIFICATION ENGINE
// =====================================================================

export function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `neo-toast neo-toast-${type}`;

  let icon = "info";
  if (type === "success") icon = "check_circle";
  if (type === "error") icon = "error";
  if (type === "warning") icon = "warning";

  toast.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.6rem;">
      <span class="material-symbols-outlined" style="font-size:20px;">${icon}</span>
      <span>${message}</span>
    </div>
    <button style="background:none; border:none; cursor:pointer; font-weight:bold; font-size:16px; padding:0 4px;" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    setTimeout(() => toast.remove(), 200);
  }, duration);
}
