// =====================================================================
// EXAMIA CLIENT-SIDE ROUTER & VIEW ORCHESTRATOR
// =====================================================================

import { auth } from './auth.js';
import { api } from './api.js';
import { CONFIG } from './config.js';
import { renderSidebar } from './components/sidebar.js';
import { renderTeacherDashboard, attachTeacherDashboardEvents } from './pages/teacher-dashboard.js';
import { renderStudentDashboard, attachStudentDashboardEvents } from './pages/student-dashboard.js';
import { renderExamsList, attachExamsListEvents } from './pages/exams-list.js';
import { renderExamEditor, attachExamEditorEvents } from './pages/exam-editor.js';
import { renderQuestionPapers, attachQuestionPapersEvents } from './pages/question-papers.js';
import { renderQuestionBank, attachQuestionBankEvents } from './pages/question-bank.js';
import { renderSubmissionsView, attachSubmissionsEvents } from './pages/submissions-view.js';
import { renderResultsView, attachResultsEvents } from './pages/results.js';
import { renderAnalyticsView, attachAnalyticsEvents } from './pages/analytics.js';
import { renderExamRoom, attachExamRoomEvents } from './pages/exam-taking.js';
import { renderSettings, attachSettingsEvents } from './pages/settings.js';
import { renderAIGenerator, attachAIGeneratorEvents } from './pages/ai-generator.js';
import { renderOnboarding, attachOnboardingEvents } from './pages/onboarding.js';

class Router {
  constructor() {
    this.appContainer = null;
    window.addEventListener("hashchange", () => this.handleRouteChange());
  }

  init(containerId = "app") {
    this.appContainer = document.getElementById(containerId);
    if (!window.location.hash) {
      window.location.hash = "#dashboard";
    }
    // Always trigger route rendering immediately
    this.handleRouteChange();
  }

  async handleRouteChange() {
    try {
      const hash = window.location.hash || "#dashboard";
      const path = hash.replace(/^#/, "");
      await this.renderRoute(path);
    } catch (err) {
      console.error("Router error:", err);
      if (this.appContainer) {
        this.appContainer.innerHTML = `
          <div style="min-height:80vh; display:flex; align-items:center; justify-content:center; padding:2rem; background:var(--bg-main);">
            <div class="neo-card" style="text-align:center; max-width:500px; padding:2rem;">
              <span class="material-symbols-outlined" style="font-size:48px; color:var(--color-error,#e53e3e);">error</span>
              <h2 style="font-size:1.5rem; font-weight:800; margin:1rem 0 0.5rem; text-transform:uppercase;">Unable to Load View</h2>
              <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1.5rem;">${err.message || 'An error occurred while loading this view.'}</p>
              <button onclick="location.hash='#dashboard'; location.reload();" class="neo-btn neo-btn-primary">Reload Dashboard</button>
            </div>
          </div>
        `;
      }
    }
  }

  async renderCurrentRoute() {
    await this.handleRouteChange();
  }

  async renderRoute(path) {
    if (!this.appContainer) return;

    // Check standalone full-screen pages
    if (path.startsWith("exam-room/")) {
      const sessionToken = path.split("/")[1];
      this.appContainer.innerHTML = await renderExamRoom(sessionToken);
      attachExamRoomEvents();
      return;
    }

    if (path.startsWith("exam-invite/")) {
      const token = path.split("/")[1];
      await this.renderInvitationLanding(token);
      return;
    }

    // Require onboarding if authenticated user hasn't set role/username/details
    if (auth.isAuthenticated() && !auth.isOnboarded()) {
      this.appContainer.innerHTML = renderOnboarding();
      attachOnboardingEvents((updatedUser) => {
        window.location.hash = "#dashboard";
        this.handleRouteChange();
      });
      return;
    }

    // Default to Unified Dashboard Layout with Sidebar
    const user = auth.user || {};
    const sidebarHtml = renderSidebar(`#${path}`);

    this.appContainer.innerHTML = `
      <div class="dashboard-layout">
        ${sidebarHtml}
        <div class="dashboard-main">
          <!-- Topbar -->
          <div class="dashboard-topbar">
            <div style="display:flex; align-items:center; gap:1rem;">
              <button class="neo-btn neo-btn-sm" style="display:none;" id="mobile-menu-trigger" onclick="document.getElementById('dashboard-sidebar').classList.toggle('open')">
                <span class="material-symbols-outlined" style="font-size:20px;">menu</span>
              </button>
              <span class="uppercase-label" style="color:var(--text-muted); font-size:0.75rem;">Platform / ${path.split('/')[0].replace('-', ' ')}</span>
            </div>

            <div style="display:flex; align-items:center; gap:0.75rem;">
              ${user.username ? `<span class="neo-badge neo-badge-sm neo-badge-primary">@${user.username}</span>` : ''}
              <a href="#settings" class="neo-btn neo-btn-sm neo-btn-white" title="Settings">
                <span class="material-symbols-outlined" style="font-size:18px;">settings</span>
              </a>
            </div>
          </div>

          <!-- Main Content -->
          <div class="dashboard-content" id="dashboard-content-area">
            <div style="text-align:center; padding:3rem;"><span class="material-symbols-outlined animate-spin" style="font-size:36px;">sync</span></div>
          </div>
        </div>
      </div>
    `;

    // Attach sidebar logout
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) logoutBtn.onclick = () => auth.logout();

    // Check responsive toggle
    const toggleBtn = document.getElementById("mobile-menu-trigger");
    if (window.innerWidth <= 1024 && toggleBtn) {
      toggleBtn.style.display = "inline-flex";
    }

    const contentArea = document.getElementById("dashboard-content-area");

    // Route dispatch
    if (path === "dashboard" || path === "overview" || path === "teacher-dashboard" || path === "student-dashboard" || path === "") {
      contentArea.innerHTML = await renderTeacherDashboard();
      attachTeacherDashboardEvents();
    } else if (path === "my-results" || path === "available-exams" || path === "my-exams") {
      contentArea.innerHTML = await renderStudentDashboard();
      attachStudentDashboardEvents();
    } else if (path === "ai-generator") {
      contentArea.innerHTML = await renderAIGenerator();
      attachAIGeneratorEvents();
    } else if (path === "exams") {
      contentArea.innerHTML = await renderExamsList();
      attachExamsListEvents();
    } else if (path.startsWith("exam-editor/")) {
      const examId = path.split("/")[1];
      contentArea.innerHTML = await renderExamEditor(examId);
      attachExamEditorEvents();
    } else if (path === "papers") {
      contentArea.innerHTML = await renderQuestionPapers();
      attachQuestionPapersEvents();
    } else if (path === "question-bank") {
      contentArea.innerHTML = await renderQuestionBank();
      attachQuestionBankEvents();
    } else if (path.startsWith("exams/") && path.endsWith("/submissions")) {
      const examId = path.split("/")[1];
      contentArea.innerHTML = await renderSubmissionsView(examId);
      attachSubmissionsEvents();
    } else if (path.startsWith("results/")) {
      const subId = path.split("/")[1];
      contentArea.innerHTML = await renderResultsView(subId);
      attachResultsEvents();
    } else if (path === "my-results") {
      contentArea.innerHTML = await renderStudentDashboard();
      attachStudentDashboardEvents();
    } else if (path.startsWith("analytics/")) {
      const examId = path.split("/")[1];
      contentArea.innerHTML = await renderAnalyticsView(examId);
      attachAnalyticsEvents();
    } else if (path === "analytics") {
      contentArea.innerHTML = await renderExamsList();
      attachExamsListEvents();
    } else if (path === "settings") {
      contentArea.innerHTML = renderSettings();
      attachSettingsEvents();
    } else {
      contentArea.innerHTML = await renderTeacherDashboard();
      attachTeacherDashboardEvents();
    }
  }

  async renderInvitationLanding(token) {
    const container = document.getElementById("app");
    try {
      if (!auth.isAuthenticated()) {
        sessionStorage.setItem("examia_redirect_target", `app.html#exam-invite/${token}`);
        window.location.href = `login.html?redirect=${encodeURIComponent(`app.html#exam-invite/${token}`)}`;
        return;
      }

      let data = null;
      try {
        data = await api.get(`/exams/public/${token}`);
      } catch (fetchErr) {
        // Fallback to local storage cache if available
        try {
          const pubExams = JSON.parse(localStorage.getItem("examia_published_exams") || "{}");
          const cachedExams = JSON.parse(localStorage.getItem("examia_cached_exams") || "{}");
          data = pubExams[token] || cachedExams[token] || pubExams[token.replace(/^exm_/, '')];
        } catch (_) {}

        if (!data) throw fetchErr;
      }
      const exam = data.exam || data;
      const user = auth.user || {};
      const candidateInitial = (user.full_name || user.username || "C").charAt(0).toUpperCase();

      container.innerHTML = `
        <div class="exam-room-layout" style="align-items:center; justify-content:center; padding:2rem; min-height:100vh;">
          <div class="neo-card" style="max-width:580px; width:100%; padding:2.5rem; background:#FFFFFF;">
            <div style="text-align:center; margin-bottom:1.5rem;">
              <span class="neo-badge neo-badge-primary">Examination Invitation</span>
              <h1 style="font-size:1.85rem; font-weight:800; text-transform:uppercase; margin-top:0.5rem; letter-spacing:-0.02em;">${exam.title}</h1>
              <p style="color:var(--text-muted); font-size:0.95rem; margin-top:0.25rem;">${exam.subject || 'General'} • Total Marks: ${exam.total_marks || 0}</p>
            </div>

            <!-- Exam Specs Grid -->
            <div style="background:var(--surface-low); border:2px solid #171717; border-radius:10px; padding:1.25rem; font-family:var(--font-mono); font-size:0.85rem; margin-bottom:1.5rem;">
              <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;">
                <span>Duration:</span>
                <strong>${exam.duration_minutes || 60} Minutes</strong>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;">
                <span>Questions:</span>
                <strong>${exam.question_count || (exam.questions ? exam.questions.length : 0)} Questions</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span>Security:</span>
                <strong>${data.requires_passcode ? '🔒 Passcode Protected' : '🌐 Verified Candidate'}</strong>
              </div>
            </div>

            <!-- Authenticated Candidate Identity Card -->
            <div style="background:var(--bg-main, #FAF8F5); border:2px solid #171717; border-radius:10px; padding:1.25rem; margin-bottom:1.5rem;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem;">
                <span class="uppercase-label" style="font-size:0.75rem; font-weight:800; color:var(--text-muted);">Verified Candidate Profile</span>
                <button type="button" id="btn-invite-switch-account" class="neo-btn neo-btn-white neo-btn-sm" style="font-size:0.75rem; padding:0.3rem 0.65rem; border-radius:6px; cursor:pointer;">
                  <span class="material-symbols-outlined" style="font-size:16px;">switch_account</span>
                  Switch Account
                </button>
              </div>

              <div style="display:flex; align-items:center; gap:0.85rem;">
                <div style="width:46px; height:46px; border-radius:50%; background:var(--accent-primary); border:2.5px solid #171717; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:1.2rem; flex-shrink:0; box-shadow:2px 2px 0px #171717;">
                  ${candidateInitial}
                </div>
                <div style="overflow:hidden;">
                  <div style="font-weight:800; font-size:1.05rem; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${user.full_name || 'Candidate'}</div>
                  <div style="font-size:0.85rem; color:var(--text-muted); font-family:var(--font-mono); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">
                    ${user.email || 'student@examia.io'} ${user.username ? `(@${user.username})` : ''}
                  </div>
                </div>
              </div>
            </div>

            ${data.requires_passcode ? `
              <div style="margin-bottom:1.5rem;">
                <label class="neo-label">Examination Passcode *</label>
                <input type="password" id="invite-student-passcode" class="neo-input" placeholder="Enter passcode provided by instructor" required />
              </div>
            ` : ''}

            <button id="btn-start-invite-exam" class="neo-btn neo-btn-primary neo-btn-lg" style="width:100%; justify-content:center;">
              Start Examination Now →
            </button>
          </div>
        </div>
      `;

      // Switch Account Handler
      const switchBtn = document.getElementById("btn-invite-switch-account");
      if (switchBtn) {
        switchBtn.onclick = () => {
          sessionStorage.setItem("examia_redirect_target", `app.html#exam-invite/${token}`);
          auth.logout(`login.html?redirect=${encodeURIComponent(`app.html#exam-invite/${token}`)}`);
        };
      }

      // Start Exam Handler
      document.getElementById("btn-start-invite-exam").onclick = async () => {
        const passcodeEl = document.getElementById("invite-student-passcode");
        const passcode = passcodeEl ? passcodeEl.value.trim() : null;
        const startBtn = document.getElementById("btn-start-invite-exam");

        startBtn.disabled = true;
        startBtn.innerHTML = `<span class="material-symbols-outlined animate-spin" style="font-size:20px;">sync</span> Initializing Examination...`;

        try {
          const startData = await api.post("/submissions/start", {
            invitation_token: token,
            exam_id: exam.id,
            passcode: passcode,
            student_name: user.full_name || user.username || "Student Candidate",
            student_email: user.email || ""
          });

          if (startData && startData.session_token) {
            localStorage.setItem(`examia_session_${startData.session_token}`, JSON.stringify(startData));
          }

          window.location.hash = `#exam-room/${startData.session_token}`;
        } catch (e) {
          startBtn.disabled = false;
          startBtn.innerHTML = `Start Examination Now →`;
          alert(e.message || "Failed to start examination session.");
        }
      };

    } catch (e) {
      container.innerHTML = `
        <div style="min-height:80vh; display:flex; align-items:center; justify-content:center; padding:2rem;">
          <div class="neo-card" style="text-align:center; max-width:480px; padding:2.5rem;">
            <span class="material-symbols-outlined" style="font-size:48px; color:var(--color-error,#ba1a1a);">link_off</span>
            <h2 style="font-size:1.5rem; font-weight:800; margin:1rem 0 0.5rem; text-transform:uppercase;">Invalid Invitation Link</h2>
            <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1.5rem;">${e.message || 'This examination link is inactive or has expired.'}</p>
            <a href="app.html#dashboard" class="neo-btn neo-btn-primary">Go to Dashboard</a>
          </div>
        </div>
      `;
    }
  }
}

export const router = new Router();
window.router = router;
