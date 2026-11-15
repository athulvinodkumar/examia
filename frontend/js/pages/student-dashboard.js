// =====================================================================
// EXAMIA STUDENT DASHBOARD & ASSESSMENT CONSOLE
// =====================================================================

import { api } from '../api.js';
import { auth } from '../auth.js';
import { sound } from '../sound.js';
import { showToast } from '../notifications.js';
import { showModal } from '../components/modal.js';

export async function renderStudentDashboard() {
  const user = auth.user || {};
  let myResults = [];

  try {
    const resp = await api.get("/results/my-results");
    myResults = resp.results || [];
  } catch (err) {
    console.warn("Could not load student results:", err);
  }

  return `
    <div class="animate-fade-in">
      <!-- Header -->
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:2rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <span class="neo-badge neo-badge-primary">Results & Submissions</span>
          <h1 style="font-size:2rem; font-weight:800; text-transform:uppercase; margin-top:0.25rem;">My Scorecards & Tests</h1>
          <p style="color:var(--text-muted); font-size:0.95rem;">Review your completed examinations, released scorecards, and enter new exam tokens.</p>
        </div>

        <button id="btn-join-exam-token" class="neo-btn neo-btn-primary">
          <span class="material-symbols-outlined" style="font-size:20px;">login</span> Enter Exam Token
        </button>
      </div>

      <!-- Quick Action Card: Start Exam by Token -->
      <div class="neo-card neo-card-accent" style="margin-bottom:2rem; padding:1.5rem 2rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.5rem;">
          <div>
            <h3 style="font-size:1.25rem; font-weight:800; text-transform:uppercase; margin-bottom:0.25rem;">Have an Examination Invitation?</h3>
            <p style="font-size:0.9rem; font-weight:600; max-width:480px; margin:0;">
              Enter the examination invitation token or passcode provided by your instructor to start your timed session.
            </p>
          </div>
          <button id="btn-enter-token-hero" class="neo-btn neo-btn-white neo-btn-lg">
            Start Examination →
          </button>
        </div>
      </div>

      <!-- My Completed Assessments & Scorecards -->
      <div class="neo-card" style="padding:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
          <h3 style="font-size:1.2rem; font-weight:800; text-transform:uppercase;">My Examination History</h3>
          <span style="font-family:var(--font-mono); font-size:0.85rem; font-weight:700;">${myResults.length} Completed</span>
        </div>

        ${myResults.length === 0 ? `
          <div style="text-align:center; padding:3rem; color:var(--text-muted);">
            <span class="material-symbols-outlined" style="font-size:48px;">assignment</span>
            <p style="margin-top:0.5rem;">You have not taken any examinations yet. Click "Enter Exam Token" above to begin.</p>
          </div>
        ` : `
          <div class="neo-table-container">
            <table class="neo-table">
              <thead>
                <tr>
                  <th>Examination Title</th>
                  <th>Subject</th>
                  <th>Submitted At</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Result</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${myResults.map(res => `
                  <tr>
                    <td><strong>${res.exam_title}</strong></td>
                    <td style="font-family:var(--font-mono); font-size:0.85rem;">${res.subject || 'General'}</td>
                    <td style="font-family:var(--font-mono); font-size:0.8rem;">
                      ${res.submitted_at ? new Date(res.submitted_at).toLocaleDateString() : 'Recent'}
                    </td>
                    <td>
                      <span class="neo-badge neo-badge-sm ${res.results_released ? 'neo-badge-success' : 'neo-badge-warning'}">
                        ${res.results_released ? 'Results Released' : 'Pending Release'}
                      </span>
                    </td>
                    <td style="font-family:var(--font-mono); font-weight:800;">
                      ${res.results_released && res.score_obtained !== undefined ? `${res.score_obtained} / ${res.total_possible}` : 'Locked'}
                    </td>
                    <td>
                      ${res.results_released && res.percentage !== undefined ? `
                        <span class="neo-badge neo-badge-sm ${res.passed ? 'neo-badge-success' : 'neo-badge-danger'}">
                          ${res.passed ? 'Passed' : 'Failed'} (${res.percentage}%)
                        </span>
                      ` : `
                        <span style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">Awaiting Teacher</span>
                      `}
                    </td>
                    <td>
                      <a href="#results/${res.submission_id}" class="neo-btn neo-btn-sm neo-btn-white">
                        <span class="material-symbols-outlined" style="font-size:16px;">visibility</span> Scorecard
                      </a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;
}

export function attachStudentDashboardEvents() {
  const openTokenPrompt = () => {
    sound.playClick();
    const content = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <div class="neo-input-group">
          <label class="neo-label">Invitation Token or URL *</label>
          <input type="text" id="modal-token-input" class="neo-input" placeholder="e.g. exm_9a8b7c6d5e4f... or full link" required />
        </div>
        <div class="neo-input-group">
          <label class="neo-label">Passcode (If required)</label>
          <input type="password" id="modal-passcode-input" class="neo-input" placeholder="Optional exam passcode" />
        </div>
      </div>
    `;

    showModal({
      title: "Enter Examination",
      content: content,
      confirmText: "Access Exam →",
      onConfirm: async () => {
        let token = document.getElementById("modal-token-input").value.trim();
        const passcode = document.getElementById("modal-passcode-input").value.trim();

        if (!token) {
          showToast("Please enter an invitation token", "error");
          return false;
        }

        // Clean if full URL passed
        if (token.includes("#exam-invite/")) {
          token = token.split("#exam-invite/")[1];
        } else if (token.includes("token=")) {
          token = token.split("token=")[1].split("&")[0];
        }

        try {
          // Check exam info
          const info = await api.get(`/exams/public/${token}`);
          if (!info.is_open) {
            showToast(info.message, "warning");
            return false;
          }

          // Start submission
          const startResp = await api.post("/submissions/start", {
            invitation_token: token,
            passcode: passcode || null
          });

          sound.playSuccess();
          showToast("Entering Examination Room...", "success");
          window.location.hash = `#exam-room/${startResp.session_token}`;
          return true;
        } catch (err) {
          showToast(err.message, "error");
          return false;
        }
      }
    });
  };

  const btnTop = document.getElementById("btn-join-exam-token");
  if (btnTop) btnTop.onclick = openTokenPrompt;

  const btnHero = document.getElementById("btn-enter-token-hero");
  if (btnHero) btnHero.onclick = openTokenPrompt;
}
