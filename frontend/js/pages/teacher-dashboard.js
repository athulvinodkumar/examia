// =====================================================================
// EXAMIA TEACHER DASHBOARD VIEW (DATABASE-DRIVEN)
// =====================================================================

import { api } from '../api.js';
import { auth } from '../auth.js';
import { sound } from '../sound.js';
import { showToast } from '../notifications.js';
import { showModal } from '../components/modal.js';

export async function renderTeacherDashboard() {
  const user = auth.user || {};

  // Fetch real statistics from database
  let overview = {
    stats: { total_exams: 0, published_exams: 0, draft_exams: 0, total_students: 0, total_submissions: 0, average_score: 0 },
    recent_activities: [],
    upcoming_exams: []
  };

  try {
    const data = await api.get("/analytics/teacher-overview");
    if (data && data.stats) {
      overview = data;
    }
  } catch (err) {
    console.warn("Could not fetch overview stats:", err);
  }

  const { stats, recent_activities, upcoming_exams } = overview;

  return `
    <div class="animate-fade-in">
      <!-- Welcome Header -->
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:2rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <span class="neo-badge neo-badge-primary" style="margin-bottom:0.5rem;">Unified Workspace</span>
          <h1 style="font-size:2.25rem; font-weight:800; text-transform:uppercase;">Welcome back, ${user.full_name || 'Member'}!</h1>
          <p style="color:var(--text-muted); font-weight:500;">Generate, take, evaluate, and analyze examinations with high-precision AI.</p>
        </div>
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
          <a href="#ai-generator" class="neo-btn neo-btn-primary">
            <span class="material-symbols-outlined" style="font-size:20px;">auto_stories</span> AI Generator
          </a>
          <a href="#papers" class="neo-btn neo-btn-white">
            <span class="material-symbols-outlined" style="font-size:20px;">upload_file</span> Upload Paper
          </a>
          <button id="btn-create-exam-header" class="neo-btn neo-btn-white">
            <span class="material-symbols-outlined" style="font-size:20px;">add_circle</span> Create Exam
          </button>
        </div>
      </div>

      <!-- Real DB Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-card-label">Total Exams</span>
          <div class="stat-card-value">${stats.total_exams}</div>
          <div style="display:flex; gap:0.5rem; font-size:0.75rem; font-weight:700;">
            <span style="color:var(--color-success);">${stats.published_exams} Live</span> • 
            <span style="color:var(--text-muted);">${stats.draft_exams} Drafts</span>
          </div>
        </div>

        <div class="stat-card" style="background:var(--accent-primary);">
          <span class="stat-card-label" style="color:#171717;">Total Submissions</span>
          <div class="stat-card-value" style="color:#171717;">${stats.total_submissions}</div>
          <div style="font-size:0.75rem; font-weight:700; color:#171717;">From ${stats.total_students} Candidates</div>
        </div>

        <div class="stat-card">
          <span class="stat-card-label">Cohort Average</span>
          <div class="stat-card-value">${stats.average_score}%</div>
          <div style="font-size:0.75rem; font-weight:700; color:var(--accent-secondary);">Across All Completed Exams</div>
        </div>

        <div class="stat-card">
          <span class="stat-card-label">Active Candidates</span>
          <div class="stat-card-value">${stats.total_students}</div>
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted);">Enrolled & Tested</div>
        </div>
      </div>

      <!-- Two-Column Main Content -->
      <div style="display:grid; grid-template-columns:2fr 1fr; gap:1.75rem; margin-top:2rem;">
        <!-- Left: Live & Upcoming Exams -->
        <div class="neo-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
            <h3 style="font-size:1.2rem; font-weight:800; text-transform:uppercase;">Examinations Overview</h3>
            <a href="#exams" class="neo-btn neo-btn-sm neo-btn-white">View All →</a>
          </div>

          ${upcoming_exams.length === 0 ? `
            <div style="text-align:center; padding:3rem 1rem; background:var(--surface-low); border:2px dashed #171717; border-radius:12px;">
              <span class="material-symbols-outlined" style="font-size:48px; color:var(--text-muted); margin-bottom:0.5rem;">post_add</span>
              <h4 style="font-weight:700; text-transform:uppercase;">No Examinations Yet</h4>
              <p style="color:var(--text-muted); font-size:0.9rem; max-width:320px; margin:0.5rem auto 1rem;">Upload a question paper or create an examination manually to get started.</p>
              <button id="btn-create-first-exam" class="neo-btn neo-btn-primary neo-btn-sm">+ Create Your First Exam</button>
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:0.75rem;">
              ${upcoming_exams.map(e => `
                <div style="padding:1rem 1.25rem; border:2px solid #171717; border-radius:10px; background:var(--surface-low); display:flex; justify-content:space-between; align-items:center; box-shadow:2px 2px 0px #171717;">
                  <div>
                    <span class="neo-badge neo-badge-sm ${e.status === 'published' ? 'neo-badge-primary' : ''}">${e.status}</span>
                    <h4 style="font-weight:800; font-size:1rem; margin-top:0.35rem;">${e.title}</h4>
                    <span style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${e.duration_minutes} Mins • ${e.total_marks} Marks</span>
                  </div>
                  <div style="display:flex; gap:0.5rem;">
                    <a href="#exam-editor/${e.id}" class="neo-btn neo-btn-sm neo-btn-white">Edit</a>
                    <a href="#exams/${e.id}/submissions" class="neo-btn neo-btn-sm neo-btn-primary">Submissions</a>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Right: Recent Activity Feed -->
        <div class="neo-card">
          <h3 style="font-size:1.2rem; font-weight:800; text-transform:uppercase; margin-bottom:1.25rem;">Live Activity</h3>
          ${recent_activities.length === 0 ? `
            <p style="color:var(--text-muted); font-size:0.85rem;">No recent activities recorded.</p>
          ` : `
            <div style="display:flex; flex-direction:column; gap:1rem;">
              ${recent_activities.map(act => `
                <div style="padding-bottom:0.75rem; border-bottom:1px solid #171717; font-size:0.85rem;">
                  <div style="display:flex; align-items:center; gap:0.4rem; font-weight:700;">
                    <span class="material-symbols-outlined" style="font-size:18px; color:var(--accent-secondary);">
                      ${act.type === 'submission' ? 'how_to_reg' : 'edit_document'}
                    </span>
                    <span>${act.title}</span>
                  </div>
                  <p style="color:var(--text-muted); margin:0.25rem 0 0 1.5rem; font-size:0.8rem;">${act.description}</p>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

export function attachTeacherDashboardEvents() {
  const createExamModal = () => {
    sound.playClick();
    const content = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <div class="neo-input-group">
          <label class="neo-label">Examination Title *</label>
          <input type="text" id="modal-new-exam-title" class="neo-input" placeholder="e.g. Grade 12 Physics Midterm" required />
        </div>
        <div class="neo-input-group">
          <label class="neo-label">Subject</label>
          <input type="text" id="modal-new-exam-subject" class="neo-input" placeholder="e.g. Physics / Mathematics / CS" />
        </div>
        <div class="neo-input-group">
          <label class="neo-label">Duration (Minutes)</label>
          <input type="number" id="modal-new-exam-duration" class="neo-input" value="60" min="5" max="360" />
        </div>
      </div>
    `;

    showModal({
      title: "Create New Examination",
      content: content,
      confirmText: "Create & Open Editor",
      onConfirm: async () => {
        const title = document.getElementById("modal-new-exam-title").value.trim();
        const subject = document.getElementById("modal-new-exam-subject").value.trim();
        const duration = parseInt(document.getElementById("modal-new-exam-duration").value) || 60;

        if (!title) {
          showToast("Please enter an examination title.", "error");
          return false;
        }

        try {
          const resp = await api.post("/exams", {
            title,
            subject,
            duration_minutes: duration
          });
          showToast("Exam created! Redirecting to editor...", "success");
          window.location.hash = `#exam-editor/${resp.exam.id}`;
          return true;
        } catch (err) {
          showToast(err.message, "error");
          return false;
        }
      }
    });
  };

  const btnHeader = document.getElementById("btn-create-exam-header");
  if (btnHeader) btnHeader.onclick = createExamModal;

  const btnFirst = document.getElementById("btn-create-first-exam");
  if (btnFirst) btnFirst.onclick = createExamModal;
}
