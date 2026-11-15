// =====================================================================
// EXAMIA USER SETTINGS & PREFERENCES
// =====================================================================

import { api } from '../api.js';
import { auth } from '../auth.js';
import { sound } from '../sound.js';
import { showToast } from '../notifications.js';

export function renderSettings() {
  const user = auth.user || {};
  const prefs = user.preferences || {};
  const isSoundActive = sound.enabled;

  return `
    <div class="animate-fade-in" style="max-width:760px; margin:0 auto;">
      <div style="margin-bottom:1.5rem;">
        <span class="neo-badge neo-badge-primary">Configuration</span>
        <h1 style="font-size:2rem; font-weight:800; text-transform:uppercase; margin-top:0.25rem;">Account & Platform Settings</h1>
        <p style="color:var(--text-muted); font-size:0.95rem;">Manage your profile, sound feedback, notifications, and accessibility options.</p>
      </div>

      <!-- Profile Card -->
      <div class="neo-card" style="margin-bottom:1.5rem;">
        <h3 style="font-size:1.2rem; font-weight:800; text-transform:uppercase; margin-bottom:1.25rem;">Profile Information</h3>
        <div style="display:flex; flex-direction:column; gap:1rem;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="neo-input-group" style="margin:0;">
              <label class="neo-label">Full Name</label>
              <input type="text" id="setting-name" class="neo-input" value="${user.full_name || ''}" />
            </div>
            <div class="neo-input-group" style="margin:0;">
              <label class="neo-label">Username</label>
              <div style="position:relative; display:flex; align-items:center;">
                <span style="position:absolute; left:12px; font-weight:700; color:var(--text-muted); font-family:var(--font-mono);">@</span>
                <input type="text" id="setting-username" class="neo-input" style="padding-left:28px;" value="${user.username || ''}" placeholder="username" />
              </div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="neo-input-group" style="margin:0;">
              <label class="neo-label">Email Address</label>
              <input type="email" class="neo-input" value="${user.email || ''}" disabled style="background:var(--surface-low); cursor:not-allowed;" />
            </div>
            <div class="neo-input-group" style="margin:0;">
              <label class="neo-label">Phone / Contact</label>
              <input type="tel" id="setting-phone" class="neo-input" value="${user.phone || ''}" placeholder="+1 (555) 000-0000" />
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="neo-input-group" style="margin:0;">
              <label class="neo-label">School / Institution</label>
              <input type="text" id="setting-school" class="neo-input" value="${user.school_organization || ''}" placeholder="e.g. Cambridge Academy / MIT" />
            </div>
            <div class="neo-input-group" style="margin:0;">
              <label class="neo-label">Department / Grade</label>
              <input type="text" id="setting-dept" class="neo-input" value="${user.department || ''}" placeholder="e.g. Computer Science" />
            </div>
          </div>
        </div>
      </div>

      <!-- Sound & Feedback Preferences -->
      <div class="neo-card" style="margin-bottom:1.5rem;">
        <h3 style="font-size:1.2rem; font-weight:800; text-transform:uppercase; margin-bottom:0.5rem;">Audio Feedback</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.25rem;">Subtle acoustic cues on uploads, publications, and submissions. Disabled by default.</p>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem; border:2px solid #171717; border-radius:10px; background:var(--surface-low);">
          <div>
            <strong style="display:block; font-size:0.95rem;">Interface Sound Effects</strong>
            <span style="font-size:0.8rem; color:var(--text-muted);">Never plays during student examinations.</span>
          </div>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <button id="btn-test-sound" class="neo-btn neo-btn-sm neo-btn-white" type="button">
              <span class="material-symbols-outlined" style="font-size:16px;">volume_up</span> Test Audio
            </button>
            <label class="exam-option-card" style="margin:0; padding:0.4rem 0.8rem; cursor:pointer;">
              <input type="checkbox" id="setting-sound-toggle" class="exam-option-radio" ${isSoundActive ? 'checked' : ''} />
              <span style="font-weight:700; font-size:0.8rem;">Enabled</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Action Button -->
      <button id="btn-save-all-settings" class="neo-btn neo-btn-primary neo-btn-lg" style="width:100%;">
        Save Preferences
      </button>
    </div>
  `;
}

export function attachSettingsEvents() {
  const soundToggle = document.getElementById("setting-sound-toggle");
  if (soundToggle) {
    soundToggle.onchange = () => {
      sound.setPreference(soundToggle.checked);
      if (soundToggle.checked) sound.playSuccess();
    };
  }

  const testSoundBtn = document.getElementById("btn-test-sound");
  if (testSoundBtn) {
    testSoundBtn.onclick = () => {
      sound.initContext();
      sound.playSuccess();
      showToast("Audio synthesizer verified!", "info");
    };
  }

  const saveBtn = document.getElementById("btn-save-all-settings");
  if (saveBtn) {
    saveBtn.onclick = async () => {
      sound.playClick();
      const fullName = document.getElementById("setting-name").value.trim();
      const username = document.getElementById("setting-username").value.trim().toLowerCase();
      const school = document.getElementById("setting-school").value.trim();
      const dept = document.getElementById("setting-dept").value.trim();
      const phone = document.getElementById("setting-phone").value.trim();
      const soundEnabled = document.getElementById("setting-sound-toggle").checked;

      sound.setPreference(soundEnabled);

      try {
        const resp = await api.put("/auth/profile", {
          full_name: fullName,
          username: username,
          school_organization: school,
          department: dept,
          phone: phone,
          preferences: { sound_enabled: soundEnabled }
        });
        auth.user = resp.user;
        localStorage.setItem("examia_user_data", JSON.stringify(resp.user));
        sound.playSuccess();
        showToast("Profile settings saved successfully!", "success");
      } catch (err) {
        showToast("Save failed: " + err.message, "error");
      }
    };
  }
}
