// =====================================================================
// EXAMIA PUBLISHING & SHARING MODAL (QR CODE + INVITATION LINKS)
// =====================================================================

import { showModal } from './modal.js';
import { showToast } from '../notifications.js';
import { sound } from '../sound.js';

export const PRIMARY_LIVE_DOMAIN = "https://examia.athulvinodkumar08.workers.dev";

export function openSharingModal(rawSharingData) {
  sound.playPublish();

  const sharingData = rawSharingData.sharing || rawSharingData;
  const currentOrigin = window.location.origin;
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  // Extract invitation token
  let token = sharingData.invitation_token || "";
  if (!token && sharingData.invitation_url) {
    if (sharingData.invitation_url.includes("#exam-invite/")) {
      token = sharingData.invitation_url.split("#exam-invite/")[1];
    } else if (sharingData.invitation_url.includes("#exam-taking/")) {
      token = sharingData.invitation_url.split("#exam-taking/")[1];
    }
  }

  // Determine base domain: NEVER use localhost; always use primary live domain or actual public host
  let resolvedBase = PRIMARY_LIVE_DOMAIN;
  const savedPublicDomain = localStorage.getItem("examia_public_domain");

  if (!isLocalhost && currentOrigin && !currentOrigin.includes("localhost") && !currentOrigin.includes("127.0.0.1")) {
    resolvedBase = currentOrigin;
  } else if (savedPublicDomain && !savedPublicDomain.includes("localhost")) {
    resolvedBase = savedPublicDomain.replace(/\/+$/, "");
  }

  let actualInvitationUrl = token ? `${resolvedBase}/app.html#exam-invite/${token}` : (sharingData.invitation_url || "");
  // Guard against any leftover localhost string
  if (actualInvitationUrl.includes("localhost") || actualInvitationUrl.includes("127.0.0.1")) {
    actualInvitationUrl = actualInvitationUrl.replace(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, PRIMARY_LIVE_DOMAIN);
  }

  function buildShareText(url) {
    const qCount = sharingData.question_count !== undefined ? `${sharingData.question_count} Questions | ` : "";
    const marks = sharingData.total_marks !== undefined ? `Total Marks: ${sharingData.total_marks}` : "";
    const duration = sharingData.duration_minutes ? `Duration: ${sharingData.duration_minutes} Mins\n` : "";
    return `Hello! You have been invited to take the examination: ${sharingData.title || 'Exam'}.\n\n${qCount}${marks}\n${duration}\nAccess your examination here:\n${url}\n\nPlease read instructions before starting. Good luck!`;
  }

  let shareText = buildShareText(actualInvitationUrl);
  let qrCodeSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(actualInvitationUrl)}`;

  const content = `
    <div style="display:flex; flex-direction:column; gap:1.25rem;">
      <div style="text-align:center; padding:1.25rem; background:var(--surface-low); border:2px solid #171717; border-radius:12px; box-shadow:3px 3px 0px #171717;">
        <img id="share-qr-img" src="${qrCodeSrc}" onerror="this.src='${sharingData.qr_code_base64 || ''}'" alt="Exam QR Code" style="width:180px; height:180px; border:2px solid #171717; border-radius:8px; margin:0 auto; display:block; background:#FFF; padding:6px; box-shadow:2px 2px 0px #171717;" />
        <p style="font-size:0.75rem; font-weight:700; text-transform:uppercase; margin-top:0.75rem; color:var(--text-muted);">
          Scan with any mobile camera to take the exam
        </p>
      </div>

      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
          <label class="neo-label" style="margin:0;">Direct Candidate Link</label>
          <span class="neo-badge neo-badge-sm neo-badge-primary">Live Cloudflare Link</span>
        </div>

        <div style="display:flex; gap:0.5rem;">
          <input type="text" readonly value="${actualInvitationUrl}" id="share-link-input" class="neo-input" style="font-family:var(--font-mono); font-size:0.85rem; font-weight:700; background:#FFF; color:#171717;" />
          <button id="btn-copy-link" class="neo-btn neo-btn-primary neo-btn-sm" style="white-space:nowrap;">
            <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span> Copy
          </button>
        </div>
      </div>

      <div>
        <label class="neo-label">Pre-Formatted Invitation Message</label>
        <textarea id="share-message-text" class="neo-textarea" style="font-size:0.85rem; height:90px; font-family:inherit;">${shareText}</textarea>
        <div style="display:flex; gap:0.5rem; margin-top:0.5rem; flex-wrap:wrap;">
          <button id="btn-copy-message" class="neo-btn neo-btn-white neo-btn-sm">
            <span class="material-symbols-outlined" style="font-size:18px;">copy_all</span> Copy Message
          </button>
          <a id="btn-whatsapp-share" href="https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}" target="_blank" class="neo-btn neo-btn-sm" style="background:#25D366; color:#FFF;">
            <span class="material-symbols-outlined" style="font-size:18px;">chat</span> WhatsApp
          </a>
          <a id="btn-email-share" href="mailto:?subject=${encodeURIComponent('Exam Invitation: ' + (sharingData.title || 'Exam'))}&body=${encodeURIComponent(shareText)}" target="_blank" class="neo-btn neo-btn-sm" style="background:var(--accent-secondary); color:#FFF;">
            <span class="material-symbols-outlined" style="font-size:18px;">mail</span> Email
          </a>
        </div>
      </div>
    </div>
  `;

  showModal({
    title: `Share Exam: ${sharingData.title || 'Exam'}`,
    content: content,
    confirmText: "Done",
    showCancel: false,
    onConfirm: () => true
  });

  // Attach event handlers
  setTimeout(() => {
    const linkInput = document.getElementById("share-link-input");
    const msgTextarea = document.getElementById("share-message-text");

    const copyLinkBtn = document.getElementById("btn-copy-link");
    if (copyLinkBtn) {
      copyLinkBtn.onclick = () => {
        const textToCopy = linkInput ? linkInput.value : actualInvitationUrl;
        navigator.clipboard.writeText(textToCopy);
        sound.playClick();
        showToast("Live candidate link copied to clipboard!", "success");
      };
    }

    const copyMsgBtn = document.getElementById("btn-copy-message");
    if (copyMsgBtn) {
      copyMsgBtn.onclick = () => {
        const text = msgTextarea ? msgTextarea.value : shareText;
        navigator.clipboard.writeText(text);
        sound.playClick();
        showToast("Full invitation message copied to clipboard!", "success");
      };
    }
  }, 50);
}
