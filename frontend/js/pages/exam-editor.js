// =====================================================================
// EXAMIA EXAMINATION EDITOR & SETTINGS STUDIO
// Supports 12 pedagogical question types, AI confidence scoring & review,
// math LaTeX preview, and split/merge post-processing operations.
// =====================================================================

import { api } from '../api.js';
import { sound } from '../sound.js';
import { showToast } from '../notifications.js';
import { showModal } from '../components/modal.js';
import { openSharingModal } from '../components/qr-modal.js';
import { renderMathInElement } from '../components/katex-helper.js';

let activeExam = null;
let selectedQuestionIndex = 0;
let currentTab = "questions"; // "questions" | "settings"
let paletteFilter = "all"; // "all" | "review" | "verified"

export async function renderExamEditor(examId) {
  try {
    const resp = await api.get(`/exams/${examId}`);
    activeExam = resp.exam;
  } catch (err) {
    return `
      <div class="neo-card" style="text-align:center; padding:3rem;">
        <h3 style="color:var(--color-error);">Error Loading Examination</h3>
        <p>${err.message}</p>
        <a href="#exams" class="neo-btn neo-btn-primary" style="margin-top:1rem;">Back to Exams</a>
      </div>
    `;
  }

  const allQuestions = activeExam.questions || [];
  if (selectedQuestionIndex >= allQuestions.length) {
    selectedQuestionIndex = Math.max(0, allQuestions.length - 1);
  }
  const currentQ = allQuestions[selectedQuestionIndex] || null;

  // Filter questions for the sidebar palette
  const filteredQuestions = allQuestions.map((q, originalIdx) => ({ ...q, originalIdx }))
    .filter(q => {
      if (paletteFilter === "review") return q.review_status === "needs_review";
      if (paletteFilter === "verified") return q.review_status !== "needs_review";
      return true;
    });

  const reviewCount = allQuestions.filter(q => q.review_status === "needs_review").length;
  const verifiedCount = allQuestions.length - reviewCount;
  const confScore = currentQ ? (currentQ.confidence_score !== undefined && currentQ.confidence_score !== null ? currentQ.confidence_score : 0.95) : 0.95;

  return `
    <div class="animate-fade-in">
      <!-- Top Action Bar -->
      <div class="neo-card" style="padding:1rem 1.5rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div style="display:flex; align-items:center; gap:1rem;">
          <a href="#exams" class="neo-btn neo-btn-sm neo-btn-white">← Exams</a>
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <h2 style="font-size:1.35rem; font-weight:800; text-transform:uppercase;">${activeExam.title}</h2>
              <span class="neo-badge neo-badge-sm ${activeExam.status === 'published' ? 'neo-badge-primary' : 'neo-badge-warning'}">
                ${activeExam.status.replace('_', ' ')}
              </span>
            </div>
            <span style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);" id="editor-save-indicator">
              ● All changes saved • ${allQuestions.length} Questions • ${activeExam.total_marks} Marks
            </span>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:0.6rem;">
          <!-- View Switcher -->
          <div style="border:2px solid #171717; border-radius:8px; padding:2px; display:inline-flex; background:var(--surface-low);">
            <button id="tab-btn-questions" class="neo-btn neo-btn-sm ${currentTab === 'questions' ? 'neo-btn-primary' : 'neo-btn-white'}" style="border:none; box-shadow:none;">
              Questions (${allQuestions.length})
            </button>
            <button id="tab-btn-settings" class="neo-btn neo-btn-sm ${currentTab === 'settings' ? 'neo-btn-primary' : 'neo-btn-white'}" style="border:none; box-shadow:none;">
              Settings
            </button>
          </div>

          <button id="btn-auto-solve-exam" class="neo-btn neo-btn-sm neo-btn-white" title="Auto-solve all questions and update answer keys with AI">
            <span class="material-symbols-outlined" style="font-size:18px; color:var(--accent-secondary);">auto_awesome</span> Auto-Solve Answers
          </button>

          <button id="btn-publish-exam" class="neo-btn neo-btn-primary">
            <span class="material-symbols-outlined" style="font-size:20px;">publish</span>
            ${activeExam.status === 'published' ? 'Re-Publish / Share' : 'Publish Live'}
          </button>
        </div>
      </div>

      <!-- Tab 1: Questions Editor -->
      <div id="editor-tab-questions" style="display:${currentTab === 'questions' ? 'block' : 'none'};">
        <div class="editor-layout">
          <!-- Left: Questions Sidebar Palette -->
          <div class="editor-questions-sidebar">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; padding-bottom:0.5rem; border-bottom:2px solid #171717;">
              <span class="uppercase-label">Question Palette</span>
              <button id="btn-add-question" class="neo-btn neo-btn-sm neo-btn-primary">+ Add</button>
            </div>

            <!-- Review Filter Pills -->
            <div style="display:flex; gap:0.25rem; margin-bottom:0.75rem; flex-wrap:wrap;">
              <button class="palette-filter-btn neo-btn neo-btn-sm ${paletteFilter === 'all' ? 'neo-btn-primary' : 'neo-btn-white'}" data-filter="all" style="padding:2px 7px; font-size:0.68rem; border-width:1.5px;">
                All (${allQuestions.length})
              </button>
              <button class="palette-filter-btn neo-btn neo-btn-sm ${paletteFilter === 'review' ? 'neo-btn-warning' : 'neo-btn-white'}" data-filter="review" style="padding:2px 7px; font-size:0.68rem; border-width:1.5px;">
                ⚠️ Review (${reviewCount})
              </button>
              <button class="palette-filter-btn neo-btn neo-btn-sm ${paletteFilter === 'verified' ? 'neo-btn-primary' : 'neo-btn-white'}" data-filter="verified" style="padding:2px 7px; font-size:0.68rem; border-width:1.5px;">
                ✓ Verified (${verifiedCount})
              </button>
            </div>

            <div id="questions-list-container" style="display:flex; flex-direction:column; gap:0.5rem;">
              ${filteredQuestions.length === 0 ? `
                <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:1.5rem 0;">No questions match filter.</p>
              ` : filteredQuestions.map((q) => {
                const idx = q.originalIdx;
                const score = (q.confidence_score !== undefined && q.confidence_score !== null) ? q.confidence_score : 0.95;
                const isNeedsReview = q.review_status === "needs_review" || score < 0.70;
                return `
                  <div class="editor-q-item ${idx === selectedQuestionIndex ? 'active' : ''}" data-index="${idx}">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <span style="font-weight:800; font-family:var(--font-mono); font-size:0.85rem;">Q${q.question_number || idx + 1}</span>
                      <div style="display:flex; gap:0.3rem; align-items:center;">
                        <span class="neo-badge neo-badge-sm ${score >= 0.9 ? 'neo-badge-primary' : (score >= 0.7 ? 'neo-badge-warning' : 'neo-badge-danger')}" style="font-size:0.55rem; padding:0 3px;">
                          ${Math.round(score * 100)}%
                        </span>
                        <span class="neo-badge" style="font-size:0.6rem; padding:1px 5px;">${q.marks}m</span>
                      </div>
                    </div>
                    <div style="font-size:0.8rem; margin:0.25rem 0; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
                      ${q.question_text || 'Untitled Question'}
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem;">
                      <span class="neo-badge neo-badge-sm ${isNeedsReview ? 'neo-badge-warning' : ''}" style="font-size:0.58rem; padding:0 4px;">
                        ${isNeedsReview ? '⚠️ Needs Review' : '✓ Verified'}
                      </span>
                      <span style="color:var(--text-muted); font-family:var(--font-mono); font-size:0.68rem;">${formatQuestionType(q.question_type)}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Right: Main Question Canvas -->
          <div class="neo-card" id="main-question-canvas">
            ${!currentQ ? `
              <div style="text-align:center; padding:4rem;">
                <h3>Select or create a question</h3>
              </div>
            ` : `
              <div>
                <!-- Top AI Intelligence & Operations Bar -->
                <div style="background:var(--surface-low); border:2px solid #171717; border-radius:8px; padding:0.6rem 0.9rem; margin-bottom:1.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                  <div style="display:flex; align-items:center; gap:0.6rem;">
                    <span style="font-weight:800; font-size:0.8rem; text-transform:uppercase;">AI Confidence:</span>
                    <span class="neo-badge neo-badge-sm ${confScore >= 0.9 ? 'neo-badge-primary' : (confScore >= 0.7 ? 'neo-badge-warning' : 'neo-badge-danger')}" style="font-weight:800;">
                      ${Math.round(confScore * 100)}%
                    </span>
                    <span class="neo-badge neo-badge-sm ${currentQ.review_status === 'needs_review' ? 'neo-badge-warning' : 'neo-badge-primary'}">
                      ${currentQ.review_status === 'needs_review' ? '⚠️ Needs Review' : '✓ Verified'}
                    </span>
                    ${currentQ.section_title ? `<span class="neo-badge neo-badge-sm" style="background:#FFFFFF; font-size:0.65rem;">${currentQ.section_title}</span>` : ''}
                  </div>

                  <div style="display:flex; align-items:center; gap:0.4rem;">
                    <button id="btn-merge-with-next" class="neo-btn neo-btn-sm neo-btn-white" title="Merge this question with the next sequential question">
                      <span class="material-symbols-outlined" style="font-size:16px;">link</span> Merge Next
                    </button>
                    <button id="btn-split-question" class="neo-btn neo-btn-sm neo-btn-white" title="Split into multiple sub-questions">
                      <span class="material-symbols-outlined" style="font-size:16px;">call_split</span> Split Question
                    </button>
                  </div>
                </div>

                <!-- Question Header Bar -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; padding-bottom:0.75rem; border-bottom:2px solid #171717;">
                  <div style="display:flex; align-items:center; gap:0.75rem;">
                    <span style="font-family:var(--font-heading); font-size:1.4rem; font-weight:800;">
                      Question #${currentQ.question_number || selectedQuestionIndex + 1}
                    </span>
                  </div>

                  <div style="display:flex; gap:0.5rem;">
                    <button id="btn-duplicate-current-q" class="neo-btn neo-btn-sm neo-btn-white" title="Duplicate Question">
                      <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span> Duplicate
                    </button>
                    <button id="btn-delete-current-q" class="neo-btn neo-btn-sm neo-btn-danger" title="Delete Question">
                      <span class="material-symbols-outlined" style="font-size:18px;">delete</span> Delete
                    </button>
                  </div>
                </div>

                <!-- 12-Type Selector, Marks, Negative Marks Row -->
                <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:1rem; margin-bottom:1.25rem;">
                  <div class="neo-input-group" style="margin:0;">
                    <label class="neo-label">Question Type (12 Types Supported)</label>
                    <select id="edit-q-type" class="neo-select">
                      <option value="mcq_single" ${currentQ.question_type === 'mcq_single' ? 'selected' : ''}>Single Choice MCQ</option>
                      <option value="mcq_multiple" ${currentQ.question_type === 'mcq_multiple' ? 'selected' : ''}>Multiple Select (MSQ)</option>
                      <option value="true_false" ${currentQ.question_type === 'true_false' ? 'selected' : ''}>True / False</option>
                      <option value="fill_blank" ${currentQ.question_type === 'fill_blank' ? 'selected' : ''}>Fill in the Blanks</option>
                      <option value="match_following" ${currentQ.question_type === 'match_following' ? 'selected' : ''}>Match the Following</option>
                      <option value="short_answer" ${currentQ.question_type === 'short_answer' ? 'selected' : ''}>Short Answer</option>
                      <option value="long_answer" ${currentQ.question_type === 'long_answer' ? 'selected' : ''}>Long Answer / Essay</option>
                      <option value="numerical" ${currentQ.question_type === 'numerical' ? 'selected' : ''}>Numerical Problem</option>
                      <option value="mathematical" ${currentQ.question_type === 'mathematical' ? 'selected' : ''}>Mathematical Problem</option>
                      <option value="diagram_based" ${currentQ.question_type === 'diagram_based' ? 'selected' : ''}>Diagram-Based Question</option>
                      <option value="assertion_reason" ${currentQ.question_type === 'assertion_reason' ? 'selected' : ''}>Assertion & Reason</option>
                      <option value="case_study" ${currentQ.question_type === 'case_study' ? 'selected' : ''}>Case Study / Passage</option>
                    </select>
                  </div>

                  <div class="neo-input-group" style="margin:0;">
                    <label class="neo-label">Marks</label>
                    <input type="number" id="edit-q-marks" class="neo-input" value="${currentQ.marks}" step="0.5" min="0.5" />
                  </div>

                  <div class="neo-input-group" style="margin:0;">
                    <label class="neo-label">Negative Marks</label>
                    <input type="number" id="edit-q-negative" class="neo-input" value="${currentQ.negative_marks || 0}" step="0.25" min="0" />
                  </div>
                </div>

                <!-- Question Text with KaTeX Preview Toggle -->
                <div class="neo-input-group">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                    <label class="neo-label">Question Text (LaTeX supported: $E=mc^2$ or \\[ \\int x dx \\])</label>
                    <button id="btn-toggle-math-preview" class="neo-btn neo-btn-sm neo-btn-white" style="font-size:0.7rem; padding:2px 6px;">
                      👁 Toggle Math Preview
                    </button>
                  </div>
                  <textarea id="edit-q-text" class="neo-textarea" style="font-size:1rem; height:110px;">${currentQ.question_text}</textarea>
                  <div id="math-preview-box" style="display:none; margin-top:0.5rem; padding:0.85rem; background:var(--surface-low); border:2px solid #171717; border-radius:8px;"></div>
                </div>

                <!-- Dynamic Type-Specific Inputs -->
                <div id="dynamic-type-container">
                  ${renderTypeSpecificEditor(currentQ)}
                </div>

                <!-- Explanation Area -->
                <div class="neo-input-group" style="margin-top:1.5rem;">
                  <label class="neo-label">Explanation & Solution Working (Optional)</label>
                  <textarea id="edit-q-explanation" class="neo-textarea" style="height:70px;" placeholder="Explanation shown to students if enabled...">${currentQ.explanation || ''}</textarea>
                </div>

                <!-- Footer Action Buttons -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.5rem; padding-top:1rem; border-top:2px solid #171717;">
                  <button id="btn-mark-verified" class="neo-btn neo-btn-sm ${currentQ.review_status === 'verified' ? 'neo-btn-primary' : 'neo-btn-white'}">
                    ${currentQ.review_status === 'verified' ? '✓ Verified (Click to Flag)' : '⚠️ Mark as Verified'}
                  </button>
                  <button id="btn-save-current-q" class="neo-btn neo-btn-primary neo-btn-sm">Save Question</button>
                </div>
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- Tab 2: Settings -->
      <div id="editor-tab-settings" style="display:${currentTab === 'settings' ? 'block' : 'none'};">
        <div class="neo-card" style="max-width:800px; margin:0 auto;">
          <h3 style="font-size:1.4rem; font-weight:800; text-transform:uppercase; margin-bottom:1.5rem;">Examination Settings</h3>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem;">
            <div class="neo-input-group">
              <label class="neo-label">Title *</label>
              <input type="text" id="setting-title" class="neo-input" value="${activeExam.title}" />
            </div>

            <div class="neo-input-group">
              <label class="neo-label">Subject</label>
              <input type="text" id="setting-subject" class="neo-input" value="${activeExam.subject || ''}" />
            </div>

            <div class="neo-input-group">
              <label class="neo-label">Duration (Minutes)</label>
              <input type="number" id="setting-duration" class="neo-input" value="${activeExam.duration_minutes}" min="5" />
            </div>

            <div class="neo-input-group">
              <label class="neo-label">Access Passcode (Optional)</label>
              <input type="text" id="setting-passcode" class="neo-input" placeholder="Leave blank for public link" value="${activeExam.passcode || ''}" />
            </div>
          </div>

          <div class="neo-input-group">
            <label class="neo-label">Instructions for Candidates</label>
            <textarea id="setting-instructions" class="neo-textarea">${activeExam.instructions || ''}</textarea>
          </div>

          <h4 style="font-weight:800; text-transform:uppercase; margin:1.5rem 0 0.75rem;">Behavior & Evaluation</h4>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
            <label class="exam-option-card ${activeExam.shuffle_questions ? 'selected' : ''}" style="margin:0;">
              <input type="checkbox" id="setting-shuffle-q" class="exam-option-radio" ${activeExam.shuffle_questions ? 'checked' : ''} />
              <span style="font-weight:700; font-size:0.85rem;">Shuffle Questions</span>
            </label>

            <label class="exam-option-card ${activeExam.negative_marking_enabled ? 'selected' : ''}" style="margin:0;">
              <input type="checkbox" id="setting-negative" class="exam-option-radio" ${activeExam.negative_marking_enabled ? 'checked' : ''} />
              <span style="font-weight:700; font-size:0.85rem;">Enable Negative Marking</span>
            </label>

            <label class="exam-option-card ${activeExam.partial_marking_enabled ? 'selected' : ''}" style="margin:0;">
              <input type="checkbox" id="setting-partial" class="exam-option-radio" ${activeExam.partial_marking_enabled ? 'checked' : ''} />
              <span style="font-weight:700; font-size:0.85rem;">Enable Partial Credit (MCQ)</span>
            </label>

            <div class="neo-input-group" style="margin:0;">
              <label class="neo-label">Result Visibility</label>
              <select id="setting-result-visibility" class="neo-select">
                <option value="immediate" ${activeExam.result_visibility === 'immediate' ? 'selected' : ''}>Immediate Marks on Submit</option>
                <option value="manual" ${activeExam.result_visibility === 'manual' ? 'selected' : ''}>Manual Release by Teacher</option>
                <option value="scheduled" ${activeExam.result_visibility === 'scheduled' ? 'selected' : ''}>Scheduled Date</option>
              </select>
            </div>
          </div>

          <button id="btn-save-settings" class="neo-btn neo-btn-primary" style="width:100%;">Save Examination Settings</button>
        </div>
      </div>
    </div>
  `;
}

function formatQuestionType(type) {
  const map = {
    mcq_single: "MCQ",
    mcq_multiple: "MSQ",
    true_false: "True/False",
    fill_blank: "Fill Blank",
    match_following: "Match Pairs",
    short_answer: "Short Answer",
    long_answer: "Long Answer",
    numerical: "Numerical",
    mathematical: "Mathematical",
    diagram_based: "Diagram",
    assertion_reason: "Assert/Reason",
    case_study: "Case Study"
  };
  return map[type] || type;
}

function renderTypeSpecificEditor(q) {
  const type = q.question_type;
  const options = q.options || [];

  // Options-driven questions (MCQ, MSQ, True/False, Assertion & Reason, or questions that carry options)
  if (type === "mcq_single" || type === "mcq_multiple" || type === "true_false" || type === "assertion_reason" || options.length > 0) {
    const isMultiple = (type === "mcq_multiple");

    return `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <label class="neo-label">Answer Choices (Check correct answer${isMultiple ? 's' : ''})</label>
          ${type !== "true_false" ? `
            <button id="btn-add-option-row" class="neo-btn neo-btn-sm neo-btn-white">+ Add Option</button>
          ` : ''}
        </div>

        <div id="options-rows-container" style="display:flex; flex-direction:column; gap:0.6rem;">
          ${options.map((opt, idx) => `
            <div class="option-edit-row" data-id="${opt.id || ''}" style="display:flex; align-items:center; gap:0.75rem;">
              <input type="${isMultiple ? 'checkbox' : 'radio'}" name="correct_option_selector" class="exam-option-radio opt-correct-check" ${opt.is_correct ? 'checked' : ''} title="Mark as correct answer" />
              <span class="neo-badge neo-badge-sm" style="font-weight:900; width:32px; justify-content:center;">${opt.option_label || chr(65 + idx)}</span>
              <input type="text" class="neo-input opt-text-input" value="${opt.option_text || ''}" placeholder="Option text..." style="flex:1;" />
              ${type !== "true_false" && options.length > 2 ? `
                <button class="neo-btn neo-btn-sm neo-btn-danger btn-remove-opt-row" style="padding:4px 8px;">✕</button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Numerical & Mathematical Problems
  if (type === "numerical" || type === "mathematical") {
    return `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
        <div class="neo-input-group" style="margin:0;">
          <label class="neo-label">Expected Numeric / Value *</label>
          <input type="number" id="edit-numerical-expected" class="neo-input" value="${q.numerical_expected !== null && q.numerical_expected !== undefined ? q.numerical_expected : ''}" step="any" placeholder="e.g. 9.8" />
        </div>
        <div class="neo-input-group" style="margin:0;">
          <label class="neo-label">Absolute Tolerance (±)</label>
          <input type="number" id="edit-numerical-tolerance" class="neo-input" value="${q.numerical_tolerance || 0.01}" step="any" />
        </div>
      </div>
    `;
  }

  // Short Answer & Fill in the Blanks
  if (type === "short_answer" || type === "fill_blank") {
    const accepted = (q.accepted_answers || []).join(", ");
    return `
      <div class="neo-input-group">
        <label class="neo-label">Accepted Answers (Comma-separated exact / synonymous matches)</label>
        <input type="text" id="edit-short-accepted" class="neo-input" value="${accepted}" placeholder="e.g. Paris, City of Paris, Paris France" />
        <span style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">Examia auto-normalizes casing and trailing whitespace during grading.</span>
      </div>
    `;
  }

  // Long Answer, Case Study, Diagram-Based
  if (type === "long_answer" || type === "case_study" || type === "diagram_based" || type === "match_following") {
    return `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <div class="neo-input-group" style="margin:0;">
          <label class="neo-label">Sample Solution / Model Key Points</label>
          <textarea id="edit-descriptive-solution" class="neo-textarea" style="height:70px;" placeholder="Model answer, essential steps, or column pairings...">${q.sample_solution || ''}</textarea>
        </div>
        <div class="neo-input-group" style="margin:0;">
          <label class="neo-label">Gemini AI Evaluation Rubric</label>
          <textarea id="edit-descriptive-rubric" class="neo-textarea" style="height:70px;" placeholder="e.g. Award 3 marks for physical principle, 2 marks for derivation, 1 mark for correct units...">${q.descriptive_rubric || ''}</textarea>
        </div>
      </div>
    `;
  }

  return "";
}

function chr(code) {
  return String.fromCharCode(code);
}

export function attachExamEditorEvents() {
  if (!activeExam) return;

  const examId = activeExam.id;

  // Tab switcher
  const btnTabQ = document.getElementById("tab-btn-questions");
  const btnTabS = document.getElementById("tab-btn-settings");
  if (btnTabQ && btnTabS) {
    btnTabQ.onclick = () => {
      currentTab = "questions";
      window.router.renderCurrentRoute();
    };
    btnTabS.onclick = () => {
      currentTab = "settings";
      window.router.renderCurrentRoute();
    };
  }

  // Palette Filter buttons
  document.querySelectorAll(".palette-filter-btn").forEach(btn => {
    btn.onclick = () => {
      sound.playClick();
      paletteFilter = btn.dataset.filter;
      window.router.renderCurrentRoute();
    };
  });

  // Question item selection
  document.querySelectorAll(".editor-q-item").forEach(item => {
    item.onclick = () => {
      sound.playClick();
      selectedQuestionIndex = parseInt(item.dataset.index);
      window.router.renderCurrentRoute();
    };
  });

  // Math Preview Toggle
  const btnMathToggle = document.getElementById("btn-toggle-math-preview");
  const mathBox = document.getElementById("math-preview-box");
  const qTextArea = document.getElementById("edit-q-text");
  if (btnMathToggle && mathBox && qTextArea) {
    btnMathToggle.onclick = () => {
      if (mathBox.style.display === "none") {
        mathBox.innerHTML = qTextArea.value || "<em>Type equation in textarea...</em>";
        renderMathInElement(mathBox);
        mathBox.style.display = "block";
      } else {
        mathBox.style.display = "none";
      }
    };
  }

  // Question Type Dropdown Change
  const selectType = document.getElementById("edit-q-type");
  if (selectType) {
    selectType.onchange = () => {
      const q = activeExam.questions[selectedQuestionIndex];
      if (q) {
        q.question_type = selectType.value;
        const container = document.getElementById("dynamic-type-container");
        if (container) {
          container.innerHTML = renderTypeSpecificEditor(q);
          attachOptionRowDeleteEvents();
        }
      }
    };
  }

  // Add Question
  const btnAddQ = document.getElementById("btn-add-question");
  if (btnAddQ) {
    btnAddQ.onclick = async () => {
      sound.playClick();
      try {
        const nextNum = (activeExam.questions ? activeExam.questions.length : 0) + 1;
        const resp = await api.post(`/exams/${examId}/questions`, {
          question_number: nextNum,
          question_text: `New Question ${nextNum}`,
          question_type: "mcq_single",
          marks: 1.0,
          options: [
            { option_label: "A", option_text: "Option A", is_correct: true },
            { option_label: "B", option_text: "Option B", is_correct: false }
          ]
        });
        showToast("Question added!", "success");
        activeExam.questions.push(resp.question);
        selectedQuestionIndex = activeExam.questions.length - 1;
        window.router.renderCurrentRoute();
      } catch (err) {
        showToast("Error adding question: " + err.message, "error");
      }
    };
  }

  // Save current question
  const btnSaveQ = document.getElementById("btn-save-current-q");
  if (btnSaveQ) {
    btnSaveQ.onclick = () => saveCurrentQuestionData(true);
  }

  // Delete current question
  const btnDelQ = document.getElementById("btn-delete-current-q");
  if (btnDelQ) {
    btnDelQ.onclick = () => {
      const q = activeExam.questions[selectedQuestionIndex];
      if (!q) return;

      showModal({
        title: "Delete Question?",
        content: `Are you sure you want to delete Question #${q.question_number}?`,
        confirmText: "Delete Question",
        isDanger: true,
        onConfirm: async () => {
          try {
            await api.delete(`/questions/${q.id}`);
            showToast("Question deleted", "info");
            activeExam.questions.splice(selectedQuestionIndex, 1);
            selectedQuestionIndex = Math.max(0, selectedQuestionIndex - 1);
            window.router.renderCurrentRoute();
          } catch (err) {
            showToast("Delete failed: " + err.message, "error");
          }
        }
      });
    };
  }

  // Duplicate current question
  const btnDupQ = document.getElementById("btn-duplicate-current-q");
  if (btnDupQ) {
    btnDupQ.onclick = async () => {
      const q = activeExam.questions[selectedQuestionIndex];
      if (!q) return;
      try {
        const resp = await api.post(`/questions/${q.id}/duplicate`);
        showToast("Question duplicated!", "success");
        activeExam.questions.push(resp.question);
        selectedQuestionIndex = activeExam.questions.length - 1;
        window.router.renderCurrentRoute();
      } catch (err) {
        showToast("Duplicate failed: " + err.message, "error");
      }
    };
  }

  // Merge with Next Question
  const btnMerge = document.getElementById("btn-merge-with-next");
  if (btnMerge) {
    btnMerge.onclick = () => {
      const currentQ = activeExam.questions[selectedQuestionIndex];
      if (!currentQ) return;
      const nextCandidate = activeExam.questions[selectedQuestionIndex + 1];
      if (!nextCandidate) {
        showToast("There is no subsequent question to merge with.", "warning");
        return;
      }

      showModal({
        title: "Merge with Next Question?",
        content: `
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            <p>Merge <strong>Q#${currentQ.question_number}</strong> with <strong>Q#${nextCandidate.question_number}</strong>?</p>
            <div style="background:var(--surface-low); border:1.5px solid #171717; border-radius:6px; padding:0.6rem; font-size:0.8rem; font-family:var(--font-mono);">
              <div><strong>Q${currentQ.question_number}:</strong> ${currentQ.question_text.slice(0, 70)}...</div>
              <div style="margin-top:0.3rem;"><strong>Q${nextCandidate.question_number}:</strong> ${nextCandidate.question_text.slice(0, 70)}...</div>
            </div>
            <p style="font-size:0.8rem; color:var(--text-muted);">Their question texts, options, and marks (${currentQ.marks}m + ${nextCandidate.marks}m = ${parseFloat(currentQ.marks) + parseFloat(nextCandidate.marks)}m) will be combined.</p>
          </div>
        `,
        confirmText: "Merge Questions",
        onConfirm: async () => {
          try {
            const resp = await api.post(`/questions/${currentQ.id}/merge`);
            activeExam.questions = resp.questions;
            showToast("Questions merged successfully!", "success");
            window.router.renderCurrentRoute();
          } catch (err) {
            showToast("Merge failed: " + err.message, "error");
          }
        }
      });
    };
  }

  // Split Question
  const btnSplit = document.getElementById("btn-split-question");
  if (btnSplit) {
    btnSplit.onclick = () => {
      const currentQ = activeExam.questions[selectedQuestionIndex];
      if (!currentQ) return;

      const subqs = currentQ.subquestions || [];
      const hasSubqs = subqs.length >= 2;

      showModal({
        title: `Split Question #${currentQ.question_number}`,
        content: `
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            <p>Split this question into multiple separate questions.</p>
            ${hasSubqs ? `
              <label class="exam-option-card selected" style="margin:0;">
                <input type="radio" name="split_mode_choice" value="subquestions" class="exam-option-radio" checked />
                <div>
                  <span style="font-weight:700; font-size:0.85rem;">Split by Detected Sub-parts (${subqs.length} parts)</span>
                  <div style="font-size:0.75rem; color:var(--text-muted);">${subqs.map(s => s.label || '').join(', ')}</div>
                </div>
              </label>
            ` : ''}
            <label class="exam-option-card ${!hasSubqs ? 'selected' : ''}" style="margin:0;">
              <input type="radio" name="split_mode_choice" value="delimiter" class="exam-option-radio" ${!hasSubqs ? 'checked' : ''} />
              <div style="flex:1;">
                <span style="font-weight:700; font-size:0.85rem;">Split by Delimiter / Paragraphs</span>
                <input type="text" id="split-delimiter-input" class="neo-input" value="\\n\\n" style="margin-top:0.3rem; padding:4px 8px; font-size:0.8rem;" placeholder="e.g. \\n(b) or \\n\\n" />
              </div>
            </label>
          </div>
        `,
        confirmText: "Split Now",
        onConfirm: async () => {
          try {
            const checkedRadio = document.querySelector("input[name='split_mode_choice']:checked");
            const mode = checkedRadio ? checkedRadio.value : "auto";
            let payload = {};
            if (mode === "delimiter") {
              const rawDelim = document.getElementById("split-delimiter-input").value;
              const delim = rawDelim.replace(/\\n/g, "\n");
              payload = { split_mode: "delimiter", delimiter: delim };
            } else {
              payload = { split_mode: "subquestions" };
            }

            const resp = await api.post(`/questions/${currentQ.id}/split`, payload);
            activeExam.questions = resp.questions;
            showToast("Question split successfully!", "success");
            window.router.renderCurrentRoute();
          } catch (err) {
            showToast("Split failed: " + err.message, "error");
          }
        }
      });
    };
  }

  // Add option row
  const btnAddOpt = document.getElementById("btn-add-option-row");
  if (btnAddOpt) {
    btnAddOpt.onclick = () => {
      const container = document.getElementById("options-rows-container");
      if (!container) return;
      const count = container.querySelectorAll(".option-edit-row").length;
      const nextLabel = chr(65 + count);
      const row = document.createElement("div");
      row.className = "option-edit-row";
      row.style = "display:flex; align-items:center; gap:0.75rem;";
      row.innerHTML = `
        <input type="radio" name="correct_option_selector" class="exam-option-radio opt-correct-check" />
        <span class="neo-badge neo-badge-sm" style="font-weight:900; width:32px; justify-content:center;">${nextLabel}</span>
        <input type="text" class="neo-input opt-text-input" value="" placeholder="Option ${nextLabel}..." style="flex:1;" />
        <button class="neo-btn neo-btn-sm neo-btn-danger btn-remove-opt-row" style="padding:4px 8px;">✕</button>
      `;
      container.appendChild(row);
      attachOptionRowDeleteEvents();
    };
  }

  attachOptionRowDeleteEvents();

  // Mark Verified
  const btnVerify = document.getElementById("btn-mark-verified");
  if (btnVerify) {
    btnVerify.onclick = async () => {
      const q = activeExam.questions[selectedQuestionIndex];
      if (!q) return;
      const newStatus = (q.review_status === "verified") ? "needs_review" : "verified";
      try {
        await api.put(`/questions/${q.id}`, { review_status: newStatus });
        q.review_status = newStatus;
        showToast(newStatus === "verified" ? "Question verified!" : "Marked for review", "info");
        window.router.renderCurrentRoute();
      } catch (err) {
        showToast("Status update failed", "error");
      }
    };
  }

  // Save Settings
  const btnSaveSettings = document.getElementById("btn-save-settings");
  if (btnSaveSettings) {
    btnSaveSettings.onclick = async () => {
      sound.playClick();
      try {
        const payload = {
          title: document.getElementById("setting-title").value.trim(),
          subject: document.getElementById("setting-subject").value.trim(),
          duration_minutes: parseInt(document.getElementById("setting-duration").value) || 60,
          passcode: document.getElementById("setting-passcode").value.trim() || null,
          instructions: document.getElementById("setting-instructions").value.trim(),
          shuffle_questions: document.getElementById("setting-shuffle-q").checked,
          negative_marking_enabled: document.getElementById("setting-negative").checked,
          partial_marking_enabled: document.getElementById("setting-partial").checked,
          result_visibility: document.getElementById("setting-result-visibility").value
        };
        await api.put(`/exams/${examId}`, payload);
        showToast("Examination settings saved successfully!", "success");
      } catch (err) {
        showToast("Save settings failed: " + err.message, "error");
      }
    };
  }

  // Auto-Solve All Questions in Exam
  const btnAutoSolve = document.getElementById("btn-auto-solve-exam");
  if (btnAutoSolve) {
    btnAutoSolve.onclick = () => {
      sound.playClick();
      showModal({
        title: "Auto-Solve All Questions with AI?",
        content: `
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            <p>Examia's AI will analyze and set answers for all <strong>${activeExam.questions ? activeExam.questions.length : 0} questions</strong> in this exam:</p>
            <ul style="padding-left:1.25rem; font-size:0.85rem; line-height:1.5;">
              <li>Select correct options for MCQs, MSQs, and True/False</li>
              <li>Compute correct numerical values and tolerance</li>
              <li>Draft comprehensive sample solutions and rubrics for written questions</li>
              <li>Add clear pedagogical explanations for students</li>
            </ul>
            <p style="font-size:0.8rem; color:var(--text-muted);">You can review and override any AI answer at any time before publishing.</p>
          </div>
        `,
        confirmText: "Auto-Solve Now ⚡",
        onConfirm: async () => {
          try {
            btnAutoSolve.disabled = true;
            btnAutoSolve.innerHTML = `<span class="material-symbols-outlined animate-spin" style="font-size:18px;">sync</span> Solving...`;
            const resp = await api.post(`/exams/${examId}/auto-solve`);
            sound.playSuccess();
            showToast("AI answered all questions successfully!", "success");
            activeExam = resp.exam;
            window.router.renderCurrentRoute();
          } catch (err) {
            btnAutoSolve.disabled = false;
            btnAutoSolve.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px; color:var(--accent-secondary);">auto_awesome</span> Auto-Solve Answers`;
            showToast("Auto-solve failed: " + err.message, "error");
          }
        }
      });
    };
  }

  // Publish Exam
  const btnPublish = document.getElementById("btn-publish-exam");
  if (btnPublish) {
    btnPublish.onclick = async () => {
      sound.playClick();
      // First save current question
      await saveCurrentQuestionData(false);

      // Pre-publication check
      const questions = activeExam.questions || [];
      if (questions.length === 0) {
        showToast("Add at least one question before publishing.", "error");
        return;
      }

      showModal({
        title: "Ready to Publish Examination?",
        content: `
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            <p>Publishing <strong>"${activeExam.title}"</strong> will generate an interactive URL and QR Code for candidates.</p>
            <div style="background:var(--surface-low); border:1.5px solid #171717; border-radius:8px; font-size:0.85rem; font-family:var(--font-mono);">
              <div>Questions: <strong>${questions.length}</strong></div>
              <div>Duration: <strong>${activeExam.duration_minutes} Mins</strong></div>
              <div>Total Marks: <strong>${activeExam.total_marks}</strong></div>
              <div>Result Mode: <strong>${activeExam.result_visibility}</strong></div>
            </div>
          </div>
        `,
        confirmText: "Publish Now →",
        onConfirm: async () => {
          try {
            const resp = await api.post(`/exams/${examId}/publish`);
            showToast("Examination published successfully!", "success");
            activeExam.status = "published";
            openSharingModal(resp);
          } catch (err) {
            showToast("Publish error: " + err.message, "error");
          }
        }
      });
    };
  }
}

function attachOptionRowDeleteEvents() {
  document.querySelectorAll(".btn-remove-opt-row").forEach(btn => {
    btn.onclick = () => {
      btn.closest(".option-edit-row").remove();
    };
  });
}

async function saveCurrentQuestionData(showFeedback = true) {
  const q = activeExam.questions[selectedQuestionIndex];
  if (!q) return;

  const qType = document.getElementById("edit-q-type").value;
  const qText = document.getElementById("edit-q-text").value.trim();
  const marks = parseFloat(document.getElementById("edit-q-marks").value) || 1.0;
  const negMarks = parseFloat(document.getElementById("edit-q-negative").value) || 0.0;
  const explanation = document.getElementById("edit-q-explanation").value.trim();

  const payload = {
    question_type: qType,
    question_text: qText,
    marks: marks,
    negative_marks: negMarks,
    explanation: explanation
  };

  // Collect type-specific data
  if (qType === "mcq_single" || qType === "mcq_multiple" || qType === "true_false" || qType === "assertion_reason") {
    const rows = document.querySelectorAll(".option-edit-row");
    const options = [];
    rows.forEach((r, idx) => {
      const isCorrect = r.querySelector(".opt-correct-check").checked;
      const text = r.querySelector(".opt-text-input").value.trim();
      options.push({
        option_label: chr(65 + idx),
        option_text: text,
        is_correct: isCorrect,
        order_index: idx
      });
    });
    payload.options = options;
  } else if (qType === "numerical" || qType === "mathematical") {
    const expEl = document.getElementById("edit-numerical-expected");
    const tolEl = document.getElementById("edit-numerical-tolerance");
    payload.numerical_expected = expEl && expEl.value ? parseFloat(expEl.value) : null;
    payload.numerical_tolerance = tolEl && tolEl.value ? parseFloat(tolEl.value) : 0.01;
  } else if (qType === "short_answer" || qType === "fill_blank") {
    const accEl = document.getElementById("edit-short-accepted");
    if (accEl) {
      payload.accepted_answers = accEl.value.split(",").map(s => s.trim()).filter(Boolean);
    }
  } else if (qType === "long_answer" || qType === "case_study" || qType === "diagram_based" || qType === "match_following") {
    const solEl = document.getElementById("edit-descriptive-solution");
    const rubEl = document.getElementById("edit-descriptive-rubric");
    payload.sample_solution = solEl ? solEl.value.trim() : "";
    payload.descriptive_rubric = rubEl ? rubEl.value.trim() : "";
  }

  const indicator = document.getElementById("editor-save-indicator");
  if (indicator) indicator.textContent = "● Saving changes...";

  try {
    const resp = await api.put(`/questions/${q.id}`, payload);
    activeExam.questions[selectedQuestionIndex] = resp.question;
    if (indicator) indicator.textContent = `● All changes saved • ${activeExam.questions.length} Questions • ${activeExam.total_marks} Marks`;
    if (showFeedback) showToast("Question saved!", "success");
  } catch (err) {
    if (indicator) indicator.textContent = "● Error saving changes";
    if (showFeedback) showToast("Save failed: " + err.message, "error");
  }
}
