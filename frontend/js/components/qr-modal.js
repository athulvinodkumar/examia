// =====================================================================
// EXAMIA PUBLISHING & SHARING MODAL (QR CODE + INVITATION LINKS)
// =====================================================================

import { showModal } from './modal.js';
import { showToast } from '../notifications.js';
import { sound } from '../sound.js';

export function openSharingModal(sharingData) {
  sound.playPublish();

  const content = `
    <div style="display:flex; flex-direction:column; gap:1.25rem;">
      <div style="text-align:center; padding:1rem; background:var(--surface-low); border:2px solid #171717; border-radius:12px; box-shadow:3px 3px 0px #171717;">
        <img src="${sharingData.qr_code_base64}" alt="Exam QR Code" style="width:180px; height:180px; border:2px solid #171717; border-radius:8px; margin:0 auto; display:block; background:#FFF; padding:6px; box-shadow:2px 2px 0px #171717;" />
        <p style="font-size:0.75rem; font-weight:700; text-transform:uppercase; margin-top:0.5rem; color:var(--text-muted);">Scan with any phone camera to access</p>
      </div>

      <div>
        <label class="neo-label">Direct Candidate Link</label>
        <div style="display:flex; gap:0.5rem; margin-top:0.25rem;">
          <input type="text" readonly value="${sharingData.invitation_url}" id="share-link-input" class="neo-input" style="font-family:var(--font-mono); font-size:0.85rem;" />
          <button id="btn-copy-link" class="neo-btn neo-btn-primary neo-btn-sm">
            <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span> Copy
          </button>
        </div>
      </div>

      <div>
        <label class="neo-label">Pre-Formatted Invitation Message</label>
        <textarea id="share-message-text" class="neo-textarea" style="font-size:0.85rem; height:90px;">${sharingData.share_text}</textarea>
        <div style="display:flex; gap:0.5rem; margin-top:0.5rem; flex-wrap:wrap;">
          <button id="btn-copy-message" class="neo-btn neo-btn-white neo-btn-sm">
            <span class="material-symbols-outlined" style="font-size:18px;">copy_all</span> Copy Message
          </button>
          <a href="${sharingData.whatsapp_url}" target="_blank" class="neo-btn neo-btn-sm" style="background:#25D366; color:#FFF;">
            <span class="material-symbols-outlined" style="font-size:18px;">chat</span> WhatsApp
          </a>
          <a href="${sharingData.email_url}" target="_blank" class="neo-btn neo-btn-sm" style="background:var(--accent-secondary); color:#FFF;">
            <span class="material-symbols-outlined" style="font-size:18px;">mail</span> Email
          </a>
        </div>
      </div>
    </div>
  `;

  showModal({
    title: `Share Exam: ${sharingData.title}`,
    content: content,
    confirmText: "Done",
    showCancel: false,
    onConfirm: () => true
  });

  // Attach event handlers
  setTimeout(() => {
    const copyLinkBtn = document.getElementById("btn-copy-link");
    if (copyLinkBtn) {
      copyLinkBtn.onclick = () => {
        navigator.clipboard.writeText(sharingData.invitation_url);
        sound.playClick();
        showToast("Invitation link copied to clipboard!", "success");
      };
    }

    const copyMsgBtn = document.getElementById("btn-copy-message");
    if (copyMsgBtn) {
      copyMsgBtn.onclick = () => {
        const text = document.getElementById("share-message-text").value;
        navigator.clipboard.writeText(text);
        sound.playClick();
        showToast("Full invitation message copied to clipboard!", "success");
      };
    }
  }, 50);
}
