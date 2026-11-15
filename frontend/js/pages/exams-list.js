// =====================================================================
// EXAMIA MY EXAMS VIEW (MANAGEMENT, FILTERING, PUBLISHING, SHARING)
// =====================================================================

import { api } from '../api.js';
import { sound } from '../sound.js';
import { showToast } from '../notifications.js';
import { showModal } from '../components/modal.js';
import { openSharingModal } from '../components/qr-modal.js';

let currentFilter = "all";
let currentSearch = "";

export async function renderExamsList() {
  let exams = [];
  try {
    const params = new URLSearchParams();
    if (currentFilter !== "all") params.append("status", currentFilter);
    if (currentSearch) params.append("search", currentSearch);

    const resp = await api.get(`/exams?${params.toString()}`);
    exams = resp.exams || [];
  } catch (err) {
    showToast("Failed to load examinations", "error");
  }

  const statusFilters = [
    { key: "all", label: "All Exams" },
    { key: "published", label: "Published" },
    { key: "draft", label: "Drafts" },
    { key: "ready_for_review", label: "Needs Review" },
    { key: "completed", label: "Completed" }
  ];

  return `
    <div class="animate-fade-in">
      <!-- Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <h1 style="font-size:2rem; font-weight:800; text-transform:uppercase;">My Examinations</h1>
          <p style="color:var(--text-muted); font-size:0.95rem;">Manage, publish, duplicate, and monitor candidate evaluations.</p>
        </div>
        <a href="#papers" class="neo-btn neo-btn-primary">
          <span class="material-symbols-outlined" style="font-size:20px;">add_circle</span> + New Exam
        </a>
      </div>

      <!-- Filter Controls & Search Bar -->
      <div class="neo-card" style="padding:1rem 1.25rem; margin-bottom:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <!-- Filter Tabs -->
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            ${statusFilters.map(f => `
              <button class="neo-btn neo-btn-sm ${currentFilter === f.key ? 'neo-btn-primary' : 'neo-btn-white'} btn-filter-status" data-status="${f.key}">
                ${f.label}
              </button>
            `).join('')}
          </div>

          <!-- Search Input -->
          <div style="display:flex; gap:0.5rem; min-width:280px;">
            <input type="text" id="exam-search-input" class="neo-input" placeholder="Search by title, subject..." value="${currentSearch}" style="padding:0.4rem 0.8rem; font-size:0.85rem;" />
            <button id="btn-search-exams" class="neo-btn neo-btn-white neo-btn-sm">
              <span class="material-symbols-outlined" style="font-size:18px;">search</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Exam Cards List -->
      ${exams.length === 0 ? `
        <div class="neo-card" style="text-align:center; padding:4rem 1.5rem;">
          <span class="material-symbols-outlined" style="font-size:56px; color:var(--text-muted);">folder_off</span>
          <h3 style="font-weight:800; font-size:1.25rem; text-transform:uppercase; margin-top:0.75rem;">No examinations match your filter</h3>
          <p style="color:var(--text-muted); max-width:360px; margin:0.5rem auto 1.5rem;">Create a new examination or clear search filters to view your papers.</p>
          <a href="#papers" class="neo-btn neo-btn-primary">+ Create Examination</a>
        </div>
      ` : `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:1.25rem;">
          ${exams.map(e => `
            <div class="neo-card neo-card-hover" style="display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                  <span class="neo-badge neo-badge-sm ${e.status === 'published' ? 'neo-badge-primary' : (e.status === 'ready_for_review' ? 'neo-badge-warning' : '')}">
                    ${e.status.replace('_', ' ')}
                  </span>
                  <span style="font-size:0.75rem; font-family:var(--font-mono); color:var(--text-muted); font-weight:700;">
                    ${e.duration_minutes} Mins
                  </span>
                </div>

                <h3 style="font-size:1.15rem; font-weight:800; margin-bottom:0.35rem; line-height:1.25;">${e.title}</h3>
                <p style="color:var(--text-muted); font-size:0.8rem; margin-bottom:1rem;">
                  ${e.subject || 'General'} • ${e.question_count} Questions • ${e.total_marks} Total Marks
                </p>
              </div>

              <div>
                <!-- Middle Info Strip -->
                <div style="padding:0.6rem 0.8rem; background:var(--surface-low); border:1.5px solid #171717; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; font-family:var(--font-mono); margin-bottom:1rem;">
                  <span>Submissions: <strong>${e.submission_count}</strong></span>
                  <span style="color:${e.has_passcode ? 'var(--color-warning)' : 'var(--color-success)'};">
                    ${e.has_passcode ? '🔒 Passcode' : '🌐 Public'}
                  </span>
                </div>

                <!-- Action Button Matrix -->
                <div style="display:flex; gap:0.4rem; flex-wrap:wrap; border-top:1.5px solid #171717; padding-top:0.75rem;">
                  <a href="#exam-editor/${e.id}" class="neo-btn neo-btn-sm neo-btn-white" style="flex:1;">
                    <span class="material-symbols-outlined" style="font-size:16px;">edit</span> Edit
                  </a>

                  ${e.status === 'published' ? `
                    <button class="neo-btn neo-btn-sm neo-btn-primary btn-share-exam" data-id="${e.id}" title="Share Exam & QR">
                      <span class="material-symbols-outlined" style="font-size:16px;">qr_code_2</span> Share
                    </button>
                  ` : `
                    <a href="#exam-editor/${e.id}" class="neo-btn neo-btn-sm neo-btn-primary" title="Publish">
                      <span class="material-symbols-outlined" style="font-size:16px;">publish</span> Publish
                    </a>
                  `}

                  <a href="#exams/${e.id}/submissions" class="neo-btn neo-btn-sm neo-btn-white" title="Submissions">
                    <span class="material-symbols-outlined" style="font-size:16px;">grading</span>
                  </a>

                  <a href="#analytics/${e.id}" class="neo-btn neo-btn-sm neo-btn-white" title="Analytics">
                    <span class="material-symbols-outlined" style="font-size:16px;">bar_chart</span>
                  </a>

                  <button class="neo-btn neo-btn-sm neo-btn-white btn-duplicate-exam" data-id="${e.id}" title="Duplicate">
                    <span class="material-symbols-outlined" style="font-size:16px;">content_copy</span>
                  </button>

                  <button class="neo-btn neo-btn-sm neo-btn-white btn-delete-exam" data-id="${e.id}" data-title="${e.title}" title="Delete" style="color:var(--color-error);">
                    <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

export function attachExamsListEvents() {
  // Filter tabs
  document.querySelectorAll(".btn-filter-status").forEach(btn => {
    btn.onclick = () => {
      sound.playClick();
      currentFilter = btn.dataset.status;
      window.router.renderCurrentRoute();
    };
  });

  // Search
  const searchBtn = document.getElementById("btn-search-exams");
  const searchInput = document.getElementById("exam-search-input");
  if (searchBtn && searchInput) {
    searchBtn.onclick = () => {
      sound.playClick();
      currentSearch = searchInput.value.trim();
      window.router.renderCurrentRoute();
    };
    searchInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        currentSearch = searchInput.value.trim();
        window.router.renderCurrentRoute();
      }
    };
  }

  // Share Modal
  document.querySelectorAll(".btn-share-exam").forEach(btn => {
    btn.onclick = async () => {
      sound.playClick();
      const examId = btn.dataset.id;
      try {
        const resp = await api.get(`/exams/${examId}/sharing`);
        openSharingModal(resp.sharing);
      } catch (err) {
        showToast("Could not load sharing details: " + err.message, "error");
      }
    };
  });

  // Duplicate Exam
  document.querySelectorAll(".btn-duplicate-exam").forEach(btn => {
    btn.onclick = async () => {
      sound.playClick();
      const examId = btn.dataset.id;
      try {
        await api.post(`/exams/${examId}/duplicate`);
        showToast("Examination duplicated successfully!", "success");
        window.router.renderCurrentRoute();
      } catch (err) {
        showToast("Duplicate failed: " + err.message, "error");
      }
    };
  });

  // Delete Exam
  document.querySelectorAll(".btn-delete-exam").forEach(btn => {
    btn.onclick = () => {
      sound.playClick();
      const examId = btn.dataset.id;
      const examTitle = btn.dataset.title;

      showModal({
        title: "Delete Examination?",
        content: `Are you sure you want to permanently delete <strong>"${examTitle}"</strong>? All questions and student submissions will be removed. This cannot be undone.`,
        confirmText: "Yes, Delete Exam",
        isDanger: true,
        onConfirm: async () => {
          try {
            await api.delete(`/exams/${examId}`);
            showToast("Examination deleted.", "info");
            window.router.renderCurrentRoute();
          } catch (err) {
            showToast("Delete failed: " + err.message, "error");
          }
        }
      });
    };
  });
}
