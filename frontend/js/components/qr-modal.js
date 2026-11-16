// =====================================================================
// EXAMIA PUBLISHING & SHARING MODAL (QR CODE + INVITATION LINKS)
// =====================================================================

import { showModal } from './modal.js';
import { showToast } from '../notifications.js';
import { sound } from '../sound.js';

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

  // Resolve true actual accessible link
  // If we are on a deployed domain (Cloudflare Pages, custom domain, Vercel, network IP),
  // always use the actual live origin instead of any stale localhost string
  let resolvedBase = currentOrigin;
  const savedPublicDomain = localStorage.getItem("examia_public_domain");

  if (!isLocalhost) {
    resolvedBase = currentOrigin;
  } else if (savedPublicDomain) {
    resolvedBase = savedPublicDomain.replace(/\/+$/, "");
  }

  let actualInvitationUrl = token ? `${resolvedBase}/app.html#exam-invite/${token}` : (sharingData.invitation_url || "");

  function buildShareText(url) {
    const qCount = sharingData.question_count !== undefined ? `${sharingData.question_count} Questions | ` : "";
    const marks = sharingData.total_marks !== undefined ? `Total Marks: ${sharingData.total_marks}` : "";
    const duration = sharingData.duration_minutes ? `Duration: ${sharingData.duration_minutes} Mins\n` : "";
    return `Hello! You have been invited to take the examination: ${sharingData.title || 'Exam'}.\n\n${qCount}${marks}\n${duration}\nAccess your examination here:\n${url}\n\nPlease read instructions before starting. Good luck!`;
  }

  let shareText = buildShareText(actualInvitationUrl);
  let qrCodeSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(actualInvitationUrl)}`;

  const content = `
    <div style="display:flex; flex-direction:column; gap:1.25rem;">
      <div style="text-align:center; padding:1.25rem; background:var(--surface-low); border:2px solid #171717; border-radius:12px; box-shadow:3px 3px 0px #171717;">
        <img id="share-qr-img" src="${qrCodeSrc}" onerror="this.src='${sharingData.qr_code_base64 || ''}'" alt="Exam QR Code" style="width:180px; height:180px; border:2px solid #171717; border-radius:8px; margin:0 auto; display:block; background:#FFF; padding:6px; box-shadow:2px 2px 0px #171717;" />
        <p style="font-size:0.75rem; font-weight:700; text-transform:uppercase; margin-top:0.75rem; color:var(--text-muted);">
          Scan with any mobile camera to take the exam
        </p>
      </div>

      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
          <label class="neo-label" style="margin:0;">Direct Candidate Link</label>
          ${isLocalhost ? `
            <button id="btn-toggle-domain" class="neo-btn neo-btn-white neo-btn-sm" style="font-size:0.7rem; padding:2px 8px;">
              <span class="material-symbols-outlined" style="font-size:14px;">language</span> ${savedPublicDomain ? 'Edit Domain' : 'Set Live Domain'}
            </button>
          ` : `
            <span class="neo-badge neo-badge-sm neo-badge-primary">Live Domain</span>
          `}
        </div>

        <div id="domain-config-panel" style="display:${isLocalhost && !savedPublicDomain ? 'block' : 'none'}; background:#FFFDE6; border:2px dashed #171717; border-radius:8px; padding:0.75rem; margin-bottom:0.75rem;">
          <div style="font-size:0.78rem; font-weight:700; margin-bottom:0.35rem; color:#171717;">
            💡 Currently viewing on localhost. To share with students on other devices, provide your public domain:
          </div>
          <div style="display:flex; gap:0.5rem;">
            <input type="text" id="custom-domain-input" placeholder="e.g. https://examia.pages.dev" value="${savedPublicDomain || ''}" class="neo-input" style="font-size:0.8rem; padding:0.4rem 0.6rem;" />
            <button id="btn-apply-domain" class="neo-btn neo-btn-primary neo-btn-sm" style="white-space:nowrap;">
              Apply
            </button>
          </div>
        </div>

        <div style="display:flex; gap:0.5rem;">
          <input type="text" readonly value="${actualInvitationUrl}" id="share-link-input" class="neo-input" style="font-family:var(--font-mono); font-size:0.85rem; font-weight:700; background:#FFF;" />
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
    const qrImg = document.getElementById("share-qr-img");
    const whatsappBtn = document.getElementById("btn-whatsapp-share");
    const emailBtn = document.getElementById("btn-email-share");

    function updateAllLinks(newUrl) {
      actualInvitationUrl = newUrl;
      if (linkInput) linkInput.value = newUrl;
      const newMsg = buildShareText(newUrl);
      if (msgTextarea) msgTextarea.value = newMsg;
      if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(newUrl)}`;
      if (whatsappBtn) whatsappBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(newMsg)}`;
      if (emailBtn) emailBtn.href = `mailto:?subject=${encodeURIComponent('Exam Invitation: ' + (sharingData.title || 'Exam'))}&body=${encodeURIComponent(newMsg)}`;
    }

    const toggleDomainBtn = document.getElementById("btn-toggle-domain");
    const domainPanel = document.getElementById("domain-config-panel");
    const customDomainInput = document.getElementById("custom-domain-input");
    const applyDomainBtn = document.getElementById("btn-apply-domain");

    if (toggleDomainBtn && domainPanel) {
      toggleDomainBtn.onclick = () => {
        domainPanel.style.display = domainPanel.style.display === "none" ? "block" : "none";
      };
    }

    if (applyDomainBtn && customDomainInput) {
      applyDomainBtn.onclick = () => {
        let val = (customDomainInput.value || "").trim();
        if (val) {
          if (!val.startsWith("http://") && !val.startsWith("https://")) {
            val = "https://" + val;
          }
          val = val.replace(/\/+$/, "");
          localStorage.setItem("examia_public_domain", val);
          const newUrl = `${val}/app.html#exam-invite/${token}`;
          updateAllLinks(newUrl);
          showToast(`Live domain set to: ${val}`, "success");
          if (domainPanel) domainPanel.style.display = "none";
        } else {
          localStorage.removeItem("examia_public_domain");
          updateAllLinks(`${currentOrigin}/app.html#exam-invite/${token}`);
          showToast("Reverted to local origin", "info");
        }
      };
    }

    const copyLinkBtn = document.getElementById("btn-copy-link");
    if (copyLinkBtn) {
      copyLinkBtn.onclick = () => {
        const textToCopy = linkInput ? linkInput.value : actualInvitationUrl;
        navigator.clipboard.writeText(textToCopy);
        sound.playClick();
        showToast("Actual invitation link copied to clipboard!", "success");
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
