// =====================================================================
// EXAMIA STUDENT EXAMINATION ROOM & ENGINE
// Server-Authoritative Timer, Autosave, Question Palette, KaTeX Math
// =====================================================================

import { api } from '../api.js';
import { sound } from '../sound.js';
import { showToast } from '../notifications.js';
import { showModal } from '../components/modal.js';
import { renderMathInElement } from '../components/katex-helper.js';

let sessionData = null;
let currentQIndex = 0;
let timerInterval = null;
let remainingSeconds = 0;
let autosaveTimer = null;
let sequenceCounter = 1;

export async function renderExamRoom(sessionToken) {
  try {
    const data = await api.get(`/submissions/${sessionToken}`);
    sessionData = data;
    remainingSeconds = data.remaining_seconds;
  } catch (err) {
    return `
      <div class="neo-card" style="max-width:500px; margin:4rem auto; text-align:center;">
        <span class="material-symbols-outlined" style="font-size:48px; color:var(--color-error);">lock</span>
        <h2 style="font-weight:800; text-transform:uppercase; margin-top:0.5rem;">Access Denied</h2>
        <p style="color:var(--text-muted); margin:0.5rem 0 1.5rem;">${err.message}</p>
        <a href="#student-dashboard" class="neo-btn neo-btn-primary">Go to Dashboard</a>
      </div>
    `;
  }

  if (sessionData.status !== "in_progress") {
    return `
      <div class="neo-card" style="max-width:560px; margin:4rem auto; text-align:center;">
        <span class="material-symbols-outlined" style="font-size:56px; color:var(--color-success);">check_circle</span>
        <h2 style="font-weight:800; text-transform:uppercase; margin-top:0.5rem;">Examination Completed</h2>
        <p style="color:var(--text-muted); margin:0.5rem 0 1.5rem;">Your answers have already been submitted and secured on the examination server.</p>
        <a href="#my-results" class="neo-btn neo-btn-primary">View Results</a>
      </div>
    `;
  }

  const questions = sessionData.questions || [];
  const currentQ = questions[currentQIndex] || null;
  const savedAnswers = sessionData.saved_answers || {};

  return `
    <div class="exam-room-layout animate-fade-in">
      <!-- HUD Header Bar -->
      <header class="exam-hud">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div style="width:30px; height:30px; background:var(--accent-primary); border:2px solid #171717; border-radius:6px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.8rem;">E</div>
          <div>
            <h3 style="font-size:1.05rem; font-weight:800; text-transform:uppercase; margin:0;">${sessionData.exam_title}</h3>
            <span style="font-size:0.7rem; color:var(--text-muted); font-family:var(--font-mono);" id="exam-sync-status">● Live Sync • All answers saved</span>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:0.75rem;">
          <!-- Timer HUD -->
          <div id="exam-timer-widget" class="exam-timer-pill">
            <span class="material-symbols-outlined" style="font-size:18px;">timer</span>
            <span id="exam-timer-digits">${formatTime(remainingSeconds)}</span>
          </div>

          <button id="btn-exam-quick-submit" class="neo-btn neo-btn-danger neo-btn-sm">
            Submit Exam
          </button>
        </div>
      </header>

      <!-- Main Testing Arena -->
      <main class="exam-arena">
        <!-- Question Canvas -->
        <div class="exam-question-card" id="exam-question-card">
          ${!currentQ ? `
            <p>No questions found.</p>
          ` : `
            <div>
              <div class="exam-question-header">
                <div>
                  <span class="neo-badge neo-badge-primary">Question ${currentQIndex + 1} of ${questions.length}</span>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <span class="neo-badge neo-badge-sm" style="font-family:var(--font-mono);">${currentQ.marks} Mark${currentQ.marks > 1 ? 's' : ''}</span>
                  <span class="neo-badge neo-badge-sm" style="font-family:var(--font-mono); text-transform:uppercase;">${currentQ.question_type.replace('_', ' ')}</span>
                </div>
              </div>

              <!-- Question Text with KaTeX Formula Display -->
              <div class="exam-question-body" id="exam-question-text">
                ${currentQ.question_text}
              </div>

              <!-- Input Area -->
              <div id="exam-answer-input-container" style="margin-top:1.5rem;">
                ${renderStudentAnswerInput(currentQ, savedAnswers[currentQ.id])}
              </div>
            </div>

            <!-- Footer Action Controls -->
            <div class="exam-action-bar">
              <button id="btn-exam-prev" class="neo-btn neo-btn-white neo-btn-sm" ${currentQIndex === 0 ? 'disabled style="opacity:0.5;"' : ''}>
                ← Previous
              </button>

              <button id="btn-exam-flag" class="neo-btn neo-btn-sm ${isFlagged(currentQ.id) ? 'neo-btn-secondary' : 'neo-btn-white'}">
                <span class="material-symbols-outlined" style="font-size:16px;">bookmark</span>
                ${isFlagged(currentQ.id) ? 'Flagged' : 'Flag for Review'}
              </button>

              <button id="btn-exam-next" class="neo-btn neo-btn-primary neo-btn-sm">
                ${currentQIndex === questions.length - 1 ? 'Review & Submit →' : 'Save & Next →'}
              </button>
            </div>
          `}
        </div>

        <!-- Right Side: Question Matrix Palette -->
        <aside class="exam-palette-sidebar">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:0.75rem; border-bottom:2px solid #171717;">
              <span class="uppercase-label">Question Palette</span>
              <span style="font-family:var(--font-mono); font-size:0.75rem; font-weight:700;" id="palette-count-summary">
                ${countAnswered()}/${questions.length} Answered
              </span>
            </div>

            <!-- 5x5 Number Grid -->
            <div class="palette-grid">
              ${questions.map((q, idx) => {
                const ans = savedAnswers[q.id];
                const answered = hasAnswer(ans);
                const current = (idx === currentQIndex);
                const flagged = (ans && ans.is_flagged);

                let cls = "";
                if (current) cls = "current";
                else if (flagged) cls = "flagged";
                else if (answered) cls = "answered";

                return `
                  <button class="palette-cell ${cls}" data-index="${idx}">
                    ${idx + 1}
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Legend -->
            <div style="font-size:0.75rem; font-family:var(--font-mono); font-weight:700; display:flex; flex-direction:column; gap:0.4rem; padding-top:0.75rem; border-top:1px solid #171717;">
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <span style="width:14px; height:14px; background:var(--accent-primary); border:1.5px solid #171717; border-radius:3px; display:inline-block;"></span>
                <span>Answered</span>
              </div>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <span style="width:14px; height:14px; background:var(--accent-secondary); border:1.5px solid #171717; border-radius:3px; display:inline-block;"></span>
                <span>Current Question</span>
              </div>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <span style="width:14px; height:14px; background:var(--accent-secondary-light); border:1.5px dashed #171717; border-radius:3px; display:inline-block;"></span>
                <span>Flagged for Review</span>
              </div>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <span style="width:14px; height:14px; background:#FFF; border:1.5px solid #171717; border-radius:3px; display:inline-block;"></span>
                <span>Unvisited</span>
              </div>
            </div>
          </div>

          <button id="btn-palette-submit" class="neo-btn neo-btn-danger" style="width:100%; margin-top:1.5rem;">
            Submit Examination
          </button>
        </aside>
      </main>
    </div>
  `;
}

function renderStudentAnswerInput(q, saved) {
  const type = q.question_type;

  if (type === "mcq_single" || type === "true_false") {
    const selectedId = saved && saved.selected_option_ids ? saved.selected_option_ids[0] : null;
    return `
      <div style="display:flex; flex-direction:column; gap:0.6rem;">
        ${(q.options || []).map(opt => `
          <label class="exam-option-card ${selectedId === opt.id ? 'selected' : ''}">
            <input type="radio" name="student_mcq_choice" value="${opt.id}" class="exam-option-radio input-mcq-choice" ${selectedId === opt.id ? 'checked' : ''} />
            <span class="neo-badge neo-badge-sm" style="font-weight:900;">${opt.option_label}</span>
            <span style="font-size:1rem; font-weight:500;">${opt.option_text}</span>
          </label>
        `).join('')}
      </div>
    `;
  }

  if (type === "mcq_multiple") {
    const selectedIds = new Set(saved && saved.selected_option_ids ? saved.selected_option_ids : []);
    return `
      <div style="display:flex; flex-direction:column; gap:0.6rem;">
        ${(q.options || []).map(opt => `
          <label class="exam-option-card ${selectedIds.has(opt.id) ? 'selected' : ''}">
            <input type="checkbox" name="student_multi_choice" value="${opt.id}" class="exam-option-radio input-multi-choice" ${selectedIds.has(opt.id) ? 'checked' : ''} />
            <span class="neo-badge neo-badge-sm" style="font-weight:900;">${opt.option_label}</span>
            <span style="font-size:1rem; font-weight:500;">${opt.option_text}</span>
          </label>
        `).join('')}
      </div>
    `;
  }

  if (type === "numerical") {
    const val = saved && saved.numerical_answer !== null && saved.numerical_answer !== undefined ? saved.numerical_answer : "";
    return `
      <div class="neo-input-group">
        <label class="neo-label">Enter Numeric Answer</label>
        <input type="number" id="input-student-numerical" class="neo-input" value="${val}" step="any" placeholder="e.g. 11.2" style="font-size:1.15rem; font-family:var(--font-mono); max-width:300px;" />
      </div>
    `;
  }

  if (type === "short_answer") {
    const val = saved && saved.text_answer ? saved.text_answer : "";
    return `
      <div class="neo-input-group">
        <label class="neo-label">Your Answer</label>
        <input type="text" id="input-student-text" class="neo-input" value="${val}" placeholder="Type your answer here..." style="font-size:1.05rem;" />
      </div>
    `;
  }

  if (type === "descriptive") {
    const val = saved && saved.text_answer ? saved.text_answer : "";
    return `
      <div class="neo-input-group">
        <label class="neo-label">Descriptive Response / Working</label>
        <textarea id="input-student-descriptive" class="neo-textarea" style="height:200px; font-size:1rem; line-height:1.6;" placeholder="Provide your complete explanation, steps, or essay response...">${val}</textarea>
        <span style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono); margin-top:0.35rem;" id="word-count-indicator">Word count: ${val.split(/\s+/).filter(Boolean).length}</span>
      </div>
    `;
  }

  return "";
}

function hasAnswer(ans) {
  if (!ans) return false;
  if (ans.selected_option_ids && ans.selected_option_ids.length > 0) return true;
  if (ans.numerical_answer !== null && ans.numerical_answer !== undefined && ans.numerical_answer !== "") return true;
  if (ans.text_answer && ans.text_answer.trim().length > 0) return true;
  return false;
}

function isFlagged(qId) {
  const ans = sessionData && sessionData.saved_answers ? sessionData.saved_answers[qId] : null;
  return Boolean(ans && ans.is_flagged);
}

function countAnswered() {
  if (!sessionData || !sessionData.saved_answers) return 0;
  return Object.values(sessionData.saved_answers).filter(hasAnswer).length;
}

function formatTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function attachExamRoomEvents() {
  if (!sessionData) return;

  const sessionToken = sessionData.session_token;
  const questions = sessionData.questions || [];
  const currentQ = questions[currentQIndex];

  // Render LaTeX math
  const qTextEl = document.getElementById("exam-question-text");
  if (qTextEl) {
    renderMathInElement(qTextEl);
  }

  // Start Server Countdown Timer
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    remainingSeconds--;
    const timerDigits = document.getElementById("exam-timer-digits");
    const timerWidget = document.getElementById("exam-timer-widget");

    if (timerDigits) {
      timerDigits.textContent = formatTime(Math.max(0, remainingSeconds));
    }

    if (timerWidget) {
      if (remainingSeconds <= 300) {
        timerWidget.className = "exam-timer-pill danger";
      } else if (remainingSeconds <= 600) {
        timerWidget.className = "exam-timer-pill warning";
      }
    }

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      showToast("Time expired! Automatically submitting examination...", "warning");
      triggerSubmission(true);
    }
  }, 1000);

  // Palette navigation
  document.querySelectorAll(".palette-cell").forEach(cell => {
    cell.onclick = () => {
      sound.playClick();
      saveCurrentQuestionAnswer();
      currentQIndex = parseInt(cell.dataset.index);
      window.router.renderCurrentRoute();
    };
  });

  // Previous button
  const btnPrev = document.getElementById("btn-exam-prev");
  if (btnPrev && currentQIndex > 0) {
    btnPrev.onclick = () => {
      sound.playClick();
      saveCurrentQuestionAnswer();
      currentQIndex--;
      window.router.renderCurrentRoute();
    };
  }

  // Next / Save & Next button
  const btnNext = document.getElementById("btn-exam-next");
  if (btnNext) {
    btnNext.onclick = () => {
      sound.playClick();
      saveCurrentQuestionAnswer();
      if (currentQIndex < questions.length - 1) {
        currentQIndex++;
        window.router.renderCurrentRoute();
      } else {
        openSubmitModal();
      }
    };
  }

  // Flag for review button
  const btnFlag = document.getElementById("btn-exam-flag");
  if (btnFlag && currentQ) {
    btnFlag.onclick = () => {
      sound.playClick();
      if (!sessionData.saved_answers[currentQ.id]) {
        sessionData.saved_answers[currentQ.id] = { is_flagged: false };
      }
      const flagState = !sessionData.saved_answers[currentQ.id].is_flagged;
      sessionData.saved_answers[currentQ.id].is_flagged = flagState;
      saveCurrentQuestionAnswer();
      window.router.renderCurrentRoute();
    };
  }

  // Radio button selections -> immediate autosave
  document.querySelectorAll(".input-mcq-choice").forEach(radio => {
    radio.onchange = () => {
      sound.playClick();
      saveCurrentQuestionAnswer();
      // Update styling
      document.querySelectorAll(".exam-option-card").forEach(c => c.classList.remove("selected"));
      radio.closest(".exam-option-card").classList.add("selected");
    };
  });

  // Checkbox selections -> immediate autosave
  document.querySelectorAll(".input-multi-choice").forEach(cb => {
    cb.onchange = () => {
      sound.playClick();
      cb.closest(".exam-option-card").classList.toggle("selected", cb.checked);
      saveCurrentQuestionAnswer();
    };
  });

  // Numerical & Text inputs -> debounced autosave
  const numInput = document.getElementById("input-student-numerical");
  if (numInput) {
    numInput.oninput = debounce(() => saveCurrentQuestionAnswer(), 500);
  }

  const txtInput = document.getElementById("input-student-text");
  if (txtInput) {
    txtInput.oninput = debounce(() => saveCurrentQuestionAnswer(), 500);
  }

  const descInput = document.getElementById("input-student-descriptive");
  if (descInput) {
    descInput.oninput = () => {
      const words = descInput.value.split(/\s+/).filter(Boolean).length;
      const countEl = document.getElementById("word-count-indicator");
      if (countEl) countEl.textContent = `Word count: ${words}`;
      debounce(() => saveCurrentQuestionAnswer(), 700)();
    };
  }

  // Submit buttons
  const btnQuickSubmit = document.getElementById("btn-exam-quick-submit");
  if (btnQuickSubmit) btnQuickSubmit.onclick = openSubmitModal;

  const btnPaletteSubmit = document.getElementById("btn-palette-submit");
  if (btnPaletteSubmit) btnPaletteSubmit.onclick = openSubmitModal;
}

function debounce(fn, delay) {
  return function(...args) {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => fn.apply(this, args), delay);
  };
}

async function saveCurrentQuestionAnswer() {
  if (!sessionData) return;
  const currentQ = sessionData.questions[currentQIndex];
  if (!currentQ) return;

  const type = currentQ.question_type;
  let selectedIds = null;
  let numVal = null;
  let textVal = null;

  if (type === "mcq_single" || type === "true_false") {
    const checked = document.querySelector('input[name="student_mcq_choice"]:checked');
    if (checked) selectedIds = [checked.value];
  } else if (type === "mcq_multiple") {
    selectedIds = Array.from(document.querySelectorAll('input[name="student_multi_choice"]:checked')).map(cb => cb.value);
  } else if (type === "numerical") {
    const numEl = document.getElementById("input-student-numerical");
    if (numEl && numEl.value !== "") numVal = parseFloat(numEl.value);
  } else if (type === "short_answer") {
    const txtEl = document.getElementById("input-student-text");
    if (txtEl) textVal = txtEl.value.trim();
  } else if (type === "descriptive") {
    const descEl = document.getElementById("input-student-descriptive");
    if (descEl) textVal = descEl.value.trim();
  }

  const isFlaggedState = Boolean(sessionData.saved_answers[currentQ.id] && sessionData.saved_answers[currentQ.id].is_flagged);

  sessionData.saved_answers[currentQ.id] = {
    selected_option_ids: selectedIds,
    numerical_answer: numVal,
    text_answer: textVal,
    is_flagged: isFlaggedState
  };

  sequenceCounter++;

  // Sync to backend
  const syncStatus = document.getElementById("exam-sync-status");
  if (syncStatus) syncStatus.textContent = "● Saving answer...";

  try {
    await api.post(`/submissions/${sessionData.session_token}/save-answer`, {
      question_id: currentQ.id,
      selected_option_ids: selectedIds,
      numerical_answer: numVal,
      text_answer: textVal,
      is_flagged: isFlaggedState,
      sequence_number: sequenceCounter
    });
    if (syncStatus) syncStatus.textContent = "● Live Sync • All answers saved";
  } catch (err) {
    if (syncStatus) syncStatus.textContent = "⚠ Network offline • Buffering answer";
  }
}

function openSubmitModal() {
  sound.playClick();
  saveCurrentQuestionAnswer();

  const total = sessionData.questions.length;
  const answered = countAnswered();
  const unanswered = total - answered;

  showModal({
    title: "Submit Examination?",
    content: `
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        <p>Are you sure you are ready to conclude and submit your examination?</p>
        <div style="background:var(--surface-low); padding:1rem; border:2px solid #171717; border-radius:10px; font-family:var(--font-mono); font-size:0.9rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
            <span>Questions Answered:</span>
            <strong style="color:var(--color-success);">${answered} / ${total}</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Unanswered Questions:</span>
            <strong style="color:${unanswered > 0 ? 'var(--color-error)' : 'var(--text-muted)'};">${unanswered}</strong>
          </div>
        </div>
        ${unanswered > 0 ? `
          <p style="font-size:0.8rem; color:var(--color-error); font-weight:700;">
            ⚠️ You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}.
          </p>
        ` : ''}
      </div>
    `,
    confirmText: "Yes, Submit Exam Now",
    cancelText: "Return to Exam",
    onConfirm: () => triggerSubmission(false)
  });
}

async function triggerSubmission(isTimeout = false) {
  if (timerInterval) clearInterval(timerInterval);
  sound.playSubmit();

  try {
    const resp = await api.post(`/submissions/${sessionData.session_token}/submit`);
    showToast("Examination submitted successfully!", "success");

    if (resp.results_released) {
      window.location.hash = `#results/${resp.submission_id}`;
    } else {
      window.location.hash = `#student-dashboard`;
    }
  } catch (err) {
    showToast("Submission failed: " + err.message, "error");
  }
}
