// =====================================================================
// EXAMIA REUSABLE QUESTION BANK
// =====================================================================

import { api } from '../api.js';
import { sound } from '../sound.js';
import { showToast } from '../notifications.js';
import { showModal } from '../components/modal.js';

let bankQuestions = [];
let searchKeyword = "";

export async function renderQuestionBank() {
  try {
    const params = new URLSearchParams();
    if (searchKeyword) params.append("search", searchKeyword);
    const resp = await api.get(`/question-bank?${params.toString()}`);
    bankQuestions = resp.questions || [];
  } catch (err) {
    showToast("Could not load question bank: " + err.message, "error");
  }

  return `
    <div class="animate-fade-in">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <h1 style="font-size:2rem; font-weight:800; text-transform:uppercase;">Question Bank Library</h1>
          <p style="color:var(--text-muted); font-size:0.95rem;">Curated collection of reusable questions across subjects and topics.</p>
        </div>
        <button id="btn-add-bank-q" class="neo-btn neo-btn-primary">
          <span class="material-symbols-outlined" style="font-size:20px;">add_circle</span> + Add Question
        </button>
      </div>

      <!-- Search Bar -->
      <div class="neo-card" style="padding:1rem 1.25rem; margin-bottom:1.5rem;">
        <div style="display:flex; gap:0.75rem;">
          <input type="text" id="bank-search-input" class="neo-input" placeholder="Search questions by topic, equation, or keyword..." value="${searchKeyword}" />
          <button id="btn-search-bank" class="neo-btn neo-btn-primary neo-btn-sm" style="padding:0 1.25rem;">
            Search
          </button>
        </div>
      </div>

      <!-- Questions Grid -->
      ${bankQuestions.length === 0 ? `
        <div class="neo-card" style="text-align:center; padding:3.5rem;">
          <span class="material-symbols-outlined" style="font-size:52px; color:var(--text-muted);">menu_book</span>
          <h3 style="font-weight:800; text-transform:uppercase; margin-top:0.5rem;">Question Bank is Empty</h3>
          <p style="color:var(--text-muted); max-width:360px; margin:0.5rem auto 1.5rem;">Store verified questions here to reuse them across multiple examinations.</p>
          <button id="btn-first-bank-q" class="neo-btn neo-btn-primary">+ Add First Question</button>
        </div>
      ` : `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:1.25rem;">
          ${bankQuestions.map(q => `
            <div class="neo-card neo-card-hover" style="display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                  <span class="neo-badge neo-badge-sm neo-badge-primary">${q.subject || 'General'}</span>
                  <span style="font-family:var(--font-mono); font-size:0.75rem; font-weight:700;">${q.marks} Mark${q.marks > 1 ? 's' : ''}</span>
                </div>
                <h4 style="font-size:1.05rem; font-weight:700; margin-bottom:0.75rem; line-height:1.4;">${q.question_text}</h4>
                <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono); margin-bottom:1rem;">
                  Type: ${q.question_type} ${q.topic ? `• Topic: ${q.topic}` : ''}
                </div>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; border-top:1.5px solid #171717; padding-top:0.75rem;">
                <span style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${(q.options || []).length} Options</span>
                <button class="neo-btn neo-btn-sm neo-btn-white btn-delete-bank-q" data-id="${q.id}" style="color:var(--color-error);">
                  <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

export function attachQuestionBankEvents() {
  const openAddModal = () => {
    sound.playClick();
    const content = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
          <div class="neo-input-group" style="margin:0;">
            <label class="neo-label">Subject</label>
            <input type="text" id="modal-bank-subject" class="neo-input" placeholder="e.g. Physics" value="Physics" />
          </div>
          <div class="neo-input-group" style="margin:0;">
            <label class="neo-label">Topic</label>
            <input type="text" id="modal-bank-topic" class="neo-input" placeholder="e.g. Mechanics" value="Mechanics" />
          </div>
        </div>
        <div class="neo-input-group">
          <label class="neo-label">Question Text *</label>
          <textarea id="modal-bank-text" class="neo-textarea" placeholder="Enter question text..." required></textarea>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
          <div class="neo-input-group" style="margin:0;">
            <label class="neo-label">Marks</label>
            <input type="number" id="modal-bank-marks" class="neo-input" value="2" min="1" />
          </div>
          <div class="neo-input-group" style="margin:0;">
            <label class="neo-label">Question Type</label>
            <select id="modal-bank-type" class="neo-select">
              <option value="mcq_single">Single Choice MCQ</option>
              <option value="numerical">Numerical</option>
              <option value="descriptive">Descriptive</option>
              <option value="short_answer">Short Answer</option>
            </select>
          </div>
        </div>
      </div>
    `;

    showModal({
      title: "Add Question to Library",
      content: content,
      confirmText: "Save to Question Bank",
      onConfirm: async () => {
        const text = document.getElementById("modal-bank-text").value.trim();
        const subject = document.getElementById("modal-bank-subject").value.trim();
        const topic = document.getElementById("modal-bank-topic").value.trim();
        const marks = parseFloat(document.getElementById("modal-bank-marks").value) || 1.0;
        const qType = document.getElementById("modal-bank-type").value;

        if (!text) {
          showToast("Question text cannot be blank", "error");
          return false;
        }

        try {
          await api.post("/question-bank", {
            question_text: text,
            subject: subject,
            topic: topic,
            marks: marks,
            question_type: qType
          });
          sound.playSuccess();
          showToast("Question added to library!", "success");
          window.router.renderCurrentRoute();
          return true;
        } catch (err) {
          showToast("Error adding question: " + err.message, "error");
          return false;
        }
      }
    });
  };

  const btnAdd = document.getElementById("btn-add-bank-q");
  if (btnAdd) btnAdd.onclick = openAddModal;

  const btnFirst = document.getElementById("btn-first-bank-q");
  if (btnFirst) btnFirst.onclick = openAddModal;

  // Search
  const searchBtn = document.getElementById("btn-search-bank");
  const searchInput = document.getElementById("bank-search-input");
  if (searchBtn && searchInput) {
    searchBtn.onclick = () => {
      sound.playClick();
      searchKeyword = searchInput.value.trim();
      window.router.renderCurrentRoute();
    };
  }

  // Delete
  document.querySelectorAll(".btn-delete-bank-q").forEach(btn => {
    btn.onclick = async () => {
      sound.playClick();
      const bankId = btn.dataset.id;
      try {
        await api.delete(`/question-bank/${bankId}`);
        showToast("Removed from question bank", "info");
        window.router.renderCurrentRoute();
      } catch (err) {
        showToast("Delete failed: " + err.message, "error");
      }
    };
  });
}
