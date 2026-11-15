// =====================================================================
// EXAMIA REUSABLE NEO-BRUTALIST MODAL
// =====================================================================

export function showModal({
  title,
  content,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDanger = false,
  showCancel = true,
  modalClass = "",
  extraFooterHtml = "",
  onConfirm = null,
  onCancel = null
}) {
  // Remove any existing modal
  const existing = document.getElementById("active-neo-modal");
  if (existing) existing.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "active-neo-modal";
  backdrop.className = "neo-modal-backdrop";

  const confirmBtnClass = isDanger ? "neo-btn-danger" : "neo-btn-primary";

  backdrop.innerHTML = `
    <div class="neo-modal-content ${modalClass}">
      <div class="neo-modal-header">
        <h3 style="font-size:1.15rem; font-weight:800; text-transform:uppercase;">${title}</h3>
        <button id="modal-close-x" style="background:none; border:none; cursor:pointer; font-weight:900; font-size:1.25rem;">✕</button>
      </div>
      <div class="neo-modal-body">
        ${typeof content === "string" ? content : ""}
      </div>
      <div class="neo-modal-footer">
        ${extraFooterHtml}
        ${showCancel ? `<button id="modal-cancel-btn" class="neo-btn neo-btn-white">${cancelText}</button>` : ""}
        <button id="modal-confirm-btn" class="neo-btn ${confirmBtnClass}">${confirmText}</button>
      </div>
    </div>
  `;

  if (typeof content !== "string" && content instanceof HTMLElement) {
    backdrop.querySelector(".neo-modal-body").appendChild(content);
  }

  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();

  backdrop.querySelector("#modal-close-x").onclick = () => {
    close();
    if (onCancel) onCancel();
  };

  if (showCancel) {
    backdrop.querySelector("#modal-cancel-btn").onclick = () => {
      close();
      if (onCancel) onCancel();
    };
  }

  backdrop.querySelector("#modal-confirm-btn").onclick = async () => {
    if (onConfirm) {
      const result = await onConfirm();
      if (result !== false) close();
    } else {
      close();
    }
  };

  // Close on backdrop click
  backdrop.onclick = (e) => {
    if (e.target === backdrop) {
      close();
      if (onCancel) onCancel();
    }
  };
}
