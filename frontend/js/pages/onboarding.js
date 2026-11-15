// =====================================================================
// EXAMIA USER ONBOARDING & BASIC INFORMATION SETUP
// Displayed after Google login (or initial sign-in) to collect
// full name, unique username, institution, department, and contact info.
// =====================================================================

import { auth } from '../auth.js';
import { sound } from '../sound.js';
import { showToast } from '../notifications.js';

let usernameCheckTimeout = null;

export function renderOnboarding() {
  const user = auth.user || {};
  const defaultName = user.full_name || "";
  const defaultUsername = user.username || (user.email ? user.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() : "");
  const defaultOrg = user.school_organization || "";
  const defaultDept = user.department || "";
  const defaultPhone = user.phone || "";

  return `
    <div class="animate-fade-in" style="min-height:85vh; display:flex; align-items:center; justify-content:center; padding:1.5rem 1rem;">
      <div class="neo-card" style="max-width:540px; width:100%; padding:2.25rem; background:#FFFFFF; box-shadow:var(--shadow-xl);">
        
        <!-- Header -->
        <div style="text-align:center; margin-bottom:1.5rem;">
          <span class="neo-badge neo-badge-primary" style="margin-bottom:0.5rem;">Profile Setup</span>
          <h1 style="font-size:1.85rem; font-weight:800; text-transform:uppercase; letter-spacing:-0.02em; margin-top:0.25rem;">
            Welcome to Examia!
          </h1>
          <p style="color:var(--text-muted); font-size:0.9rem; max-width:440px; margin:0.35rem auto 0;">
            Please provide your basic information to complete your account setup and enter the platform.
          </p>
        </div>

        <!-- Google User Preview Badge -->
        <div style="background:var(--bg-main); border:2px solid #171717; border-radius:10px; padding:0.75rem 1rem; margin-bottom:1.5rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div style="width:38px; height:38px; border-radius:8px; border:2px solid #171717; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; overflow:hidden; font-weight:bold;">
              ${user.avatar_url ? `<img src="${user.avatar_url}" style="width:100%; height:100%; object-fit:cover;" />` : (user.full_name || 'U')[0]}
            </div>
            <div>
              <div style="font-weight:700; font-size:0.9rem;">${user.full_name || user.email || 'Authenticated User'}</div>
              <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${user.email || ''}</div>
            </div>
          </div>
          <span class="neo-badge neo-badge-sm neo-badge-primary" style="font-size:0.65rem;">
            <span class="material-symbols-outlined" style="font-size:12px; vertical-align:middle; margin-right:2px;">verified</span> Verified
          </span>
        </div>

        <form id="onboarding-form">
          <!-- 1. Full Name & Username Grid -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.25rem;">
            <div class="neo-input-group">
              <label class="neo-label" for="onboarding-fullname">
                Full Name <span style="color:var(--color-error);">*</span>
              </label>
              <input type="text" id="onboarding-fullname" class="neo-input" value="${defaultName}" placeholder="e.g. Dr. Sarah Jenkins" required />
            </div>

            <div class="neo-input-group">
              <label class="neo-label" for="onboarding-username" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Username <span style="color:var(--color-error);">*</span></span>
                <span id="username-status-indicator" style="font-size:0.7rem; font-weight:700; text-transform:none;"></span>
              </label>
              <div style="position:relative; display:flex; align-items:center;">
                <span style="position:absolute; left:12px; font-weight:700; color:var(--text-muted); font-family:var(--font-mono);">@</span>
                <input type="text" id="onboarding-username" class="neo-input" style="padding-left:28px;" value="${defaultUsername}" placeholder="sarah_j" required minlength="3" maxlength="30" />
              </div>
            </div>
          </div>

          <!-- 2. School / Institution & Department Grid -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.25rem;">
            <div class="neo-input-group">
              <label class="neo-label" for="onboarding-org">
                School / Institution
              </label>
              <input type="text" id="onboarding-org" class="neo-input" value="${defaultOrg}" placeholder="e.g. Stanford University" />
            </div>

            <div class="neo-input-group">
              <label class="neo-label" for="onboarding-dept">
                Department / Field
              </label>
              <input type="text" id="onboarding-dept" class="neo-input" value="${defaultDept}" placeholder="e.g. Computer Science" />
            </div>
          </div>

          <!-- 3. Contact Phone (Optional) -->
          <div class="neo-input-group" style="margin-bottom:1.75rem;">
            <label class="neo-label" for="onboarding-phone">
              Phone / Contact Number <span style="color:var(--text-muted); font-weight:normal;">(Optional)</span>
            </label>
            <input type="tel" id="onboarding-phone" class="neo-input" value="${defaultPhone}" placeholder="e.g. +1 (555) 019-2834" />
          </div>

          <!-- Submit Button -->
          <button type="submit" id="btn-submit-onboarding" class="neo-btn neo-btn-primary" style="width:100%; justify-content:center; font-size:1rem; padding:0.85rem;">
            <span class="material-symbols-outlined" style="font-size:20px;">check_circle</span>
            <strong>Complete Setup & Launch Platform →</strong>
          </button>
        </form>
      </div>
    </div>
  `;
}

export function attachOnboardingEvents(onSuccessCallback) {
  const form = document.getElementById("onboarding-form");
  const usernameInput = document.getElementById("onboarding-username");
  const statusIndicator = document.getElementById("username-status-indicator");
  const submitBtn = document.getElementById("btn-submit-onboarding");

  // Username live availability checking
  if (usernameInput && statusIndicator) {
    const checkAvailability = async () => {
      const u = usernameInput.value.trim().toLowerCase();
      if (u.length < 3) {
        statusIndicator.innerHTML = `<span style="color:var(--text-muted);">Min 3 chars</span>`;
        return;
      }
      statusIndicator.innerHTML = `<span style="color:var(--text-muted);">Checking...</span>`;
      const res = await auth.checkUsername(u);
      if (res.available) {
        statusIndicator.innerHTML = `<span style="color:var(--color-success); font-weight:bold;">✓ Available</span>`;
      } else {
        statusIndicator.innerHTML = `<span style="color:var(--color-error); font-weight:bold;">✗ Taken</span>`;
      }
    };

    usernameInput.oninput = () => {
      clearTimeout(usernameCheckTimeout);
      usernameCheckTimeout = setTimeout(checkAvailability, 300);
    };

    // Initial check
    if (usernameInput.value.trim().length >= 3) {
      checkAvailability();
    }
  }

  // Form submission
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      sound.playClick();

      const fullName = document.getElementById("onboarding-fullname").value.trim();
      const username = document.getElementById("onboarding-username").value.trim().toLowerCase();
      const schoolOrg = document.getElementById("onboarding-org").value.trim();
      const dept = document.getElementById("onboarding-dept").value.trim();
      const phone = document.getElementById("onboarding-phone").value.trim();

      if (!fullName) {
        showToast("Please enter your full name.", "warning");
        return;
      }

      if (!username || username.length < 3) {
        showToast("Username must be at least 3 characters.", "warning");
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="material-symbols-outlined animate-spin" style="font-size:20px;">sync</span> Setting up profile...`;
      }

      try {
        const updatedUser = await auth.completeOnboarding({
          role: "user",
          full_name: fullName,
          username: username,
          school_organization: schoolOrg,
          department: dept,
          phone: phone
        });

        sound.playSuccess();
        showToast(`Profile setup complete! Welcome, ${updatedUser.full_name}.`, "success");

        if (typeof onSuccessCallback === "function") {
          onSuccessCallback(updatedUser);
        } else {
          // Redirect to the unified dashboard
          if (window.location.pathname.includes("login.html")) {
            window.location.href = `app.html#dashboard`;
          } else {
            window.location.hash = "#dashboard";
            window.location.reload();
          }
        }
      } catch (err) {
        sound.playError();
        showToast("Setup failed: " + err.message, "error");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px;">check_circle</span> <strong>Complete Setup & Launch Platform →</strong>`;
        }
      }
    };
  }
}
