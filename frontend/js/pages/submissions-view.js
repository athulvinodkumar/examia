// =====================================================================
// EXAMIA SUBMISSIONS & MANUAL/AI GRADING WORKSPACE
// =====================================================================

import { api } from '../api.js';
import { sound } from '../sound.js';
import { showToast } from '../notifications.js';
import { showModal } from '../components/modal.js';

let activeExamId = null;
let currentSubmissions = [];

export async function renderSubmissionsView(examId) {
  activeExamId = examId;
  let examData = null;

  try {
    const resp = await api.get(`/submissions/exams/${examId}/submissions`);
    currentSubmissions = resp.submissions || [];
    examData = resp;
  } catch (err) {
    return `
      <div class="neo-card" style="text-align:center; padding:3rem;">
        <h3 style="color:var(--color-error);">Could not load submissions</h3>
        <p>${err.message}</p>
        <a href="#exams" class="neo-btn neo-btn-primary" style="margin-top:1rem;">Back to Exams</a>
      </div>
    `;
  }

  return `
    <div class="animate-fade-in">
      <!-- Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <a href="#exams" class="neo-btn neo-btn-sm neo-btn-white" style="margin-bottom:0.5rem;">← Back to Exams</a>
          <h1 style="font-size:2rem; font-weight:800; text-transform:uppercase;">${examData.exam_title} — Submissions</h1>
          <p style="color:var(--text-muted); font-size:0.95rem;">Review candidate submissions, run Gemini AI evaluation on descriptive answers, and release grades.</p>
        </div>

        <div style="display:flex; gap:0.75rem;">
          <a href="#analytics/${examId}" class="neo-btn neo-btn-white">
            <span class="material-symbols-outlined" style="font-size:20px;">analytics</span> Analytics & CSV
          </a>
          <button id="btn-release-results" class="neo-btn neo-btn-primary">
            <span class="material-symbols-outlined" style="font-size:20px;">send</span> Release Results to Candidates
          </button>
        </div>
      </div>

      <!-- Submissions Table -->
      <div class="neo-card" style="padding:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
          <h3 style="font-size:1.2rem; font-weight:800; text-transform:uppercase;">Candidate Responses</h3>
          <span style="font-family:var(--font-mono); font-size:0.85rem; font-weight:700;">${currentSubmissions.length} Submissions</span>
        </div>

        ${currentSubmissions.length === 0 ? `
          <div style="text-align:center; padding:3rem; color:var(--text-muted);">
            <span class="material-symbols-outlined" style="font-size:48px;">assignment_late</span>
            <p style="margin-top:0.5rem;">No candidates have submitted this examination yet.</p>
          </div>
        ` : `
          <div class="neo-table-container">
            <table class="neo-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Submitted At</th>
                  <th>Time Taken</th>
                  <th>Status</th>
                  <th>Score Obtained</th>
                  <th>Percentage</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${currentSubmissions.map(sub => `
                  <tr>
                    <td>
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span class="material-symbols-outlined" style="font-size:20px; color:var(--text-muted);">person</span>
                        <div>
                          <strong>${sub.student_name}</strong>
                          <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${sub.student_email || 'Candidate'}</div>
                        </div>
                      </div>
                    </td>
                    <td style="font-family:var(--font-mono); font-size:0.8rem;">
                      ${sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'In Progress'}
                    </td>
                    <td style="font-family:var(--font-mono); font-size:0.8rem;">
                      ${Math.round(sub.time_spent_seconds / 60)} Mins
                    </td>
                    <td>
                      <span class="neo-badge neo-badge-sm ${sub.status === 'graded' ? 'neo-badge-success' : 'neo-badge-warning'}">
                        ${sub.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style="font-family:var(--font-mono); font-weight:800;">
                      ${sub.score_obtained !== null ? sub.score_obtained : '-'} / ${sub.total_possible || '-'}
                    </td>
                    <td style="font-family:var(--font-mono); font-weight:800;">
                      ${sub.percentage !== null ? `${sub.percentage}%` : '-'}
                    </td>
                    <td>
                      <div style="display:flex; gap:0.4rem;">
                        <button class="neo-btn neo-btn-sm neo-btn-primary btn-grade-submission" data-id="${sub.id}" title="Grade Answers">
                          <span class="material-symbols-outlined" style="font-size:16px;">edit_note</span> Grade
                        </button>
                        <a href="#results/${sub.id}" class="neo-btn neo-btn-sm neo-btn-white" title="View Full Report">
                          <span class="material-symbols-outlined" style="font-size:16px;">visibility</span>
                        </a>
                      </div>
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

export function attachSubmissionsEvents() {
  // Release results button
  const btnRelease = document.getElementById("btn-release-results");
  if (btnRelease) {
    btnRelease.onclick = () => {
      sound.playClick();
      showModal({
        title: "Release Results to All Candidates?",
        content: `This will make scores and question breakdowns immediately visible to all students who submitted this examination.`,
        confirmText: "Release Results Now",
        onConfirm: async () => {
          try {
            await api.post(`/grading/exams/${activeExamId}/release-results`, { release: true });
            sound.playPublish();
            showToast("Results successfully released to candidates!", "success");
            window.router.renderCurrentRoute();
          } catch (err) {
            showToast("Failed to release results: " + err.message, "error");
          }
        }
      });
    };
  }

  // Grade individual submission
  document.querySelectorAll(".btn-grade-submission").forEach(btn => {
    btn.onclick = async () => {
      sound.playClick();
      const subId = btn.dataset.id;
      const sub = currentSubmissions.find(s => s.id === subId);
      if (!sub) return;

      openGradingModal(sub);
    };
  });
}

function openGradingModal(sub) {
  const answers = sub.answers || [];

  const content = `
    <div style="display:flex; flex-direction:column; gap:1.25rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-low); padding:0.75rem 1rem; border:2px solid #171717; border-radius:8px; font-family:var(--font-mono); font-size:0.85rem;">
        <span>Candidate: <strong>${sub.student_name}</strong></span>
        <span>Score: <strong>${sub.score_obtained} / ${sub.total_possible} (${sub.percentage}%)</strong></span>
      </div>

      <div style="max-height:500px; overflow-y:auto; display:flex; flex-direction:column; gap:1rem;">
        ${answers.map((ans, idx) => `
          <div style="border:2px solid #171717; border-radius:8px; padding:1rem; background:var(--surface-white);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
              <span class="neo-badge neo-badge-sm">Question #${idx + 1}</span>
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <label style="font-size:0.75rem; font-weight:700;">Score:</label>
                <input type="number" step="0.5" class="neo-input input-ans-score" data-ans-id="${ans.id}" value="${ans.score_awarded !== null ? ans.score_awarded : 0}" style="width:70px; padding:3px 6px; font-size:0.85rem; font-family:var(--font-mono);" />
              </div>
            </div>

            <!-- Student Answer Text or Option -->
            <div style="margin:0.5rem 0; padding:0.6rem; background:var(--surface-low); border:1px solid #171717; border-radius:6px; font-size:0.9rem;">
              <strong>Student Response:</strong>
              <div style="margin-top:0.25rem; font-family:var(--font-mono); font-size:0.85rem; white-space:pre-wrap;">
                ${ans.text_answer || (ans.numerical_answer !== null ? ans.numerical_answer : (ans.selected_option_ids && ans.selected_option_ids.length ? 'Selected Option(s)' : '<em>No answer provided</em>'))}
              </div>
              ${ans.evaluation_notes ? `
                <div style="margin-top:0.5rem; padding:0.35rem 0.5rem; background:var(--surface-white); border:1px solid #171717; border-radius:4px; font-size:0.75rem; font-family:var(--font-mono); display:flex; align-items:center; gap:0.35rem;">
                  <span class="material-symbols-outlined" style="font-size:15px; color:var(--accent-secondary);">analytics</span>
                  <strong>Closeness Match:</strong> ${ans.evaluation_notes}
                </div>
              ` : ''}
            </div>

            <!-- AI Evaluate Button for descriptive answers -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
              <button class="neo-btn neo-btn-sm neo-btn-white btn-ai-evaluate-ans" data-ans-id="${ans.id}">
                <span class="material-symbols-outlined" style="font-size:16px; color:var(--accent-secondary);">auto_awesome</span> AI Evaluate
              </button>
              <span class="ai-feedback-badge" id="ai-feedback-badge-${ans.id}" style="font-size:0.75rem; font-weight:700; color:var(--accent-secondary);"></span>
            </div>

            <!-- Notes & Feedback -->
            <div style="margin-top:0.5rem;">
              <input type="text" class="neo-input input-ans-notes" data-ans-id="${ans.id}" placeholder="Teacher feedback notes..." value="${ans.evaluation_notes || ''}" style="padding:4px 8px; font-size:0.8rem;" />
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  showModal({
    title: `Grading: ${sub.student_name}`,
    content: content,
    confirmText: "Save All Grades",
    onConfirm: async () => {
      // Save all updated scores
      const scoreInputs = document.querySelectorAll(".input-ans-score");
      const noteInputs = document.querySelectorAll(".input-ans-notes");

      for (let i = 0; i < scoreInputs.length; i++) {
        const ansId = scoreInputs[i].dataset.ansId;
        const score = parseFloat(scoreInputs[i].value) || 0.0;
        const notes = noteInputs[i].value.trim();

        try {
          await api.put(`/grading/answers/${ansId}`, {
            score_awarded: score,
            evaluation_notes: notes
          });
        } catch (e) {
          console.error("Error saving answer score:", e);
        }
      }

      showToast("Grades successfully updated!", "success");
      window.router.renderCurrentRoute();
    }
  });

  // Attach AI Evaluate Handlers
  setTimeout(() => {
    document.querySelectorAll(".btn-ai-evaluate-ans").forEach(btn => {
      btn.onclick = async () => {
        sound.playClick();
        const ansId = btn.dataset.ansId;
        const badge = document.getElementById(`ai-feedback-badge-${ansId}`);
        btn.disabled = true;
        btn.textContent = "Analyzing with AI...";

        try {
          const resp = await api.post(`/grading/answers/${ansId}/ai-evaluate`);
          const evalData = resp.evaluation;
          sound.playSuccess();

          // Auto-fill suggested score
          const scoreInput = document.querySelector(`.input-ans-score[data-ans-id="${ansId}"]`);
          if (scoreInput && evalData.suggested_score !== undefined) {
            scoreInput.value = evalData.suggested_score;
          }

          const notesInput = document.querySelector(`.input-ans-notes[data-ans-id="${ansId}"]`);
          if (notesInput && evalData.feedback) {
            notesInput.value = evalData.feedback;
          }

          if (badge) {
            badge.textContent = `Suggested: ${evalData.suggested_score}/${evalData.max_score} (${evalData.feedback.substring(0, 40)}...)`;
          }
          showToast(`Gemini evaluated: Suggested ${evalData.suggested_score}/${evalData.max_score}`, "success");
        } catch (err) {
          showToast("AI Evaluation failed: " + err.message, "error");
        } finally {
          btn.disabled = false;
          btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:var(--accent-secondary);">auto_awesome</span> AI Evaluate`;
        }
      };
    });
  }, 100);
}
