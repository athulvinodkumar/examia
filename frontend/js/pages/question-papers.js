// =====================================================================
// EXAMIA DOCUMENT LIBRARY & AI EXTRACTION PIPELINE
// Supports intelligent question extraction, automatic answer solving,
// and pre-upload / pre-publish teacher answer verification.
// =====================================================================

import { api } from '../api.js';
import { sound } from '../sound.js';
import { showToast } from '../notifications.js';
import { showModal } from '../components/modal.js';

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatQuestionType(type) {
  const map = {
    "mcq_single": "Single-Choice MCQ",
    "mcq_multiple": "Multiple-Select (MSQ)",
    "true_false": "True / False",
    "fill_in_the_blanks": "Fill in the Blanks",
    "short_answer": "Short Answer",
    "long_answer": "Long Answer",
    "numerical": "Numerical Problem",
    "math_problem": "Mathematical Problem",
    "case_study": "Case Study / Passage",
    "assertion_reason": "Assertion & Reason",
    "match_the_following": "Match the Following",
    "diagram_based": "Diagram-Based"
  };
  return map[type] || type || "Question";
}

export async function renderQuestionPapers() {
  let papers = [];
  try {
    const resp = await api.get("/papers");
    papers = resp.papers || [];
  } catch (err) {
    showToast("Could not load uploaded papers: " + err.message, "error");
  }

  return `
    <div class="animate-fade-in">
      <div style="margin-bottom:2rem;">
        <span class="neo-badge neo-badge-primary">AI Question Extraction</span>
        <h1 style="font-size:2rem; font-weight:800; text-transform:uppercase; margin-top:0.25rem;">Question Paper Library</h1>
        <p style="color:var(--text-muted); font-size:0.95rem;">Upload static exam PDFs or Word documents. Examia AI extracts questions, options, marks, and auto-solves answers with teacher verification.</p>
      </div>

      <!-- Drag & Drop Zone -->
      <div class="neo-card" style="margin-bottom:2rem;">
        <div id="paper-dropzone" class="upload-dropzone">
          <input type="file" id="paper-file-input" accept=".pdf,.docx,.doc" style="display:none;" />
          <div style="display:flex; flex-direction:column; align-items:center; gap:0.75rem;">
            <div style="width:64px; height:64px; border-radius:12px; background:var(--accent-primary); border:2.5px solid #171717; display:flex; align-items:center; justify-content:center; box-shadow:3px 3px 0px #171717;">
              <span class="material-symbols-outlined" style="font-size:36px; color:#171717;">cloud_upload</span>
            </div>
            <h3 style="font-size:1.25rem; font-weight:800; text-transform:uppercase;">Drag & Drop Question Paper Here</h3>
            <p style="color:var(--text-muted); font-size:0.9rem; max-width:420px;">
              Supports <strong>.pdf</strong> and <strong>.docx</strong> files up to 25 MB.
            </p>
            <button id="btn-browse-file" class="neo-btn neo-btn-primary" type="button">
              Browse Computer
            </button>

            <!-- AI Answer Auto-Solve Pre-Upload Toggle -->
            <div id="toggle-auto-solve-card" style="margin-top:1rem; width:100%; max-width:500px; padding:0.85rem 1.15rem; background:#FFFFFF; border:2.5px solid #171717; border-radius:10px; box-shadow:3px 3px 0px #171717; display:flex; justify-content:space-between; align-items:center; cursor:pointer; text-align:left; transition:transform 0.1s ease;">
              <div style="display:flex; align-items:center; gap:0.75rem;">
                <div style="width:36px; height:36px; border-radius:8px; background:var(--accent-primary); border:2px solid #171717; display:flex; align-items:center; justify-content:center; box-shadow:2px 2px 0px #171717; flex-shrink:0;">
                  <span class="material-symbols-outlined" style="font-size:20px; color:#171717;">auto_awesome</span>
                </div>
                <div>
                  <div style="display:flex; align-items:center; gap:0.4rem;">
                    <strong style="font-size:0.88rem; text-transform:uppercase; letter-spacing:0.02em;">Auto-Set Answers with AI</strong>
                    <span class="neo-badge neo-badge-sm neo-badge-primary" style="font-size:0.58rem; padding:1px 5px;">RECOMMENDED</span>
                  </div>
                  <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-top:2px;">
                    AI selects MCQ answers and drafts rubrics for verification before upload/exam creation
                  </span>
                </div>
              </div>
              <input type="checkbox" id="chk-auto-solve-upload" checked style="width:22px; height:22px; accent-color:var(--accent-secondary); cursor:pointer; margin-left:0.5rem;" />
            </div>
          </div>
        </div>

        <div id="upload-progress-card" style="display:none; margin-top:1.5rem; padding:1.25rem; background:var(--surface-low); border:2px solid #171717; border-radius:10px; box-shadow:3px 3px 0px #171717;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <span style="font-weight:700; font-family:var(--font-heading); text-transform:uppercase;" id="upload-filename-txt">Uploading Document...</span>
            <span class="neo-badge neo-badge-sm animate-ai-pulse" id="upload-status-badge">AI Parsing...</span>
          </div>
          <div style="width:100%; height:12px; background:#FFFFFF; border:2px solid #171717; border-radius:6px; overflow:hidden;">
            <div id="upload-progress-bar" style="width:65%; height:100%; background:var(--accent-primary); border-right:2px solid #171717; transition:width 0.3s ease;"></div>
          </div>
          <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.5rem; font-family:var(--font-mono);">
            Step: Question detection → MCQ option segregation → AI Answer Solver → Verification Studio
          </p>
        </div>
      </div>

      <!-- Uploaded Documents Table -->
      <div class="neo-card" style="padding:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
          <h3 style="font-size:1.2rem; font-weight:800; text-transform:uppercase;">Document History</h3>
          <span style="font-size:0.8rem; font-family:var(--font-mono); color:var(--text-muted);">${papers.length} Documents</span>
        </div>

        ${papers.length === 0 ? `
          <div style="text-align:center; padding:3rem; color:var(--text-muted);">
            <span class="material-symbols-outlined" style="font-size:48px; margin-bottom:0.5rem;">description</span>
            <p>No question papers uploaded yet. Drag and drop your first PDF above.</p>
          </div>
        ` : `
          <div class="neo-table-container">
            <table class="neo-table">
              <thead>
                <tr>
                  <th>Document Name</th>
                  <th>File Size</th>
                  <th>Upload Date</th>
                  <th>Status</th>
                  <th>Questions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${papers.map(p => `
                  <tr>
                    <td>
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span class="material-symbols-outlined" style="color:var(--accent-secondary); font-size:20px;">
                          ${p.original_filename.endsWith('.pdf') ? 'picture_as_pdf' : 'article'}
                        </span>
                        <strong style="font-size:0.9rem;">${p.original_filename}</strong>
                      </div>
                    </td>
                    <td style="font-family:var(--font-mono); font-size:0.8rem;">
                      ${(p.file_size / (1024 * 1024)).toFixed(2)} MB
                    </td>
                    <td style="font-family:var(--font-mono); font-size:0.8rem;">
                      ${p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Recent'}
                    </td>
                    <td>
                      <span class="neo-badge neo-badge-sm ${p.status === 'extracted' ? 'neo-badge-success' : (p.status === 'failed' ? 'neo-badge-danger' : 'neo-badge-warning')}">
                        ${p.status}
                      </span>
                    </td>
                    <td style="font-family:var(--font-mono); font-weight:700;">
                      ${p.extracted_question_count}
                    </td>
                    <td>
                      <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                        ${p.status === 'extracted' ? `
                          <button class="neo-btn neo-btn-sm neo-btn-white btn-preview-paper" data-id="${p.id}" title="Preview Document">
                            <span class="material-symbols-outlined" style="font-size:16px;">visibility</span> Preview
                          </button>
                          <button class="neo-btn neo-btn-sm neo-btn-white btn-verify-paper-answers" data-id="${p.id}" title="Verify & Edit AI Answers">
                            <span class="material-symbols-outlined" style="font-size:16px; color:var(--accent-secondary);">fact_check</span> Verify Answers
                          </button>
                          <button class="neo-btn neo-btn-sm neo-btn-primary btn-create-exam-from-paper" data-id="${p.id}" title="Create Exam">
                            <span class="material-symbols-outlined" style="font-size:16px;">bolt</span> Create Exam
                          </button>
                        ` : ''}

                        ${p.status === 'failed' ? `
                          <button class="neo-btn neo-btn-sm neo-btn-white btn-retry-paper" data-id="${p.id}" title="Retry Extraction">
                            <span class="material-symbols-outlined" style="font-size:16px;">refresh</span> Retry
                          </button>
                        ` : ''}

                        <button class="neo-btn neo-btn-sm neo-btn-white btn-delete-paper" data-id="${p.id}" data-name="${p.original_filename}" title="Delete Document">
                          <span class="material-symbols-outlined" style="font-size:16px; color:var(--color-error);">delete</span>
                        </button>
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

export function attachQuestionPapersEvents() {
  const dropzone = document.getElementById("paper-dropzone");
  const fileInput = document.getElementById("paper-file-input");
  const browseBtn = document.getElementById("btn-browse-file");
  const toggleCard = document.getElementById("toggle-auto-solve-card");
  const chkAutoSolve = document.getElementById("chk-auto-solve-upload");

  if (toggleCard && chkAutoSolve) {
    toggleCard.onclick = (e) => {
      if (e.target !== chkAutoSolve) {
        chkAutoSolve.checked = !chkAutoSolve.checked;
      }
    };
  }

  if (browseBtn && fileInput) {
    browseBtn.onclick = () => fileInput.click();
  }

  if (fileInput) {
    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        uploadFile(e.target.files[0]);
      }
    };
  }

  if (dropzone) {
    dropzone.ondragover = (e) => {
      e.preventDefault();
      dropzone.classList.add("drag-active");
    };
    dropzone.ondragleave = () => {
      dropzone.classList.remove("drag-active");
    };
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag-active");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        uploadFile(e.dataTransfer.files[0]);
      }
    };
  }

  // Preview Paper Extraction Intelligence
  document.querySelectorAll(".btn-preview-paper").forEach(btn => {
    btn.onclick = async () => {
      sound.playClick();
      const paperId = btn.dataset.id;
      try {
        const resp = await api.get(`/papers/${paperId}`);
        const paper = resp.paper;
        const data = resp.extracted_data || {};
        const meta = data.metadata || {};
        const questions = data.questions || [];
        const confScore = data.confidence_score !== undefined ? data.confidence_score : 0.95;

        showModal({
          title: `AI Extraction Audit: ${paper.original_filename}`,
          content: `
            <div style="display:flex; flex-direction:column; gap:1rem; max-height:65vh; overflow-y:auto; padding-right:4px;">
              <!-- Metadata Overview -->
              <div style="background:var(--surface-low); border:2px solid #171717; border-radius:8px; padding:0.75rem 1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                  <strong style="font-size:0.95rem; text-transform:uppercase;">${meta.title || paper.original_filename}</strong>
                  <span class="neo-badge neo-badge-sm ${confScore >= 0.9 ? 'neo-badge-primary' : (confScore >= 0.7 ? 'neo-badge-warning' : 'neo-badge-danger')}">
                    ${Math.round(confScore * 100)}% Extraction Confidence
                  </span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:0.5rem; font-size:0.8rem; font-family:var(--font-mono); color:var(--text-muted); margin-top:0.4rem;">
                  <div>Subject: <strong style="color:var(--text-color);">${meta.subject || 'General'}</strong></div>
                  <div>Questions: <strong style="color:var(--text-color);">${questions.length}</strong></div>
                  <div>Duration: <strong style="color:var(--text-color);">${meta.duration_minutes || 60}m</strong></div>
                  <div>Marks: <strong style="color:var(--text-color);">${data.total_marks || meta.total_marks || 100}</strong></div>
                </div>
                ${meta.sections && meta.sections.length > 0 ? `
                  <div style="margin-top:0.5rem; font-size:0.75rem;">
                    <span style="font-weight:700;">Sections Detected:</span>
                    <div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.25rem;">
                      ${meta.sections.map(s => `<span class="neo-badge neo-badge-sm" style="font-size:0.65rem; background:#FFF;">${s}</span>`).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>

              <!-- Question Stream Preview -->
              <div>
                <h4 style="font-size:0.9rem; font-weight:800; text-transform:uppercase; margin-bottom:0.5rem;">Extracted Questions (${questions.length})</h4>
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                  ${questions.slice(0, 8).map((q, idx) => `
                    <div style="border:1.5px solid #171717; border-radius:6px; padding:0.6rem; background:#FFFFFF; display:flex; flex-direction:column; gap:0.25rem;">
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:800; font-family:var(--font-mono); font-size:0.8rem;">Q${q.question_number || idx + 1}</span>
                        <div style="display:flex; gap:0.3rem;">
                          <span class="neo-badge neo-badge-sm" style="font-size:0.65rem;">${formatQuestionType(q.question_type)}</span>
                          <span class="neo-badge neo-badge-sm" style="font-size:0.65rem;">${q.marks}m</span>
                        </div>
                      </div>
                      <div style="font-size:0.8rem; color:var(--text-color); line-height:1.3;">
                        ${escapeHtml(q.question_text.slice(0, 140))}${q.question_text.length > 140 ? '...' : ''}
                      </div>
                      ${q.options && q.options.length > 0 ? `
                        <div style="font-size:0.72rem; color:var(--text-muted); font-family:var(--font-mono); margin-top:0.15rem;">
                          Choices: ${q.options.map(o => `(${o.option_label}) ${escapeHtml(o.option_text)} ${o.is_correct ? '✓' : ''}`).join(' • ')}
                        </div>
                      ` : ''}
                    </div>
                  `).join('')}
                  ${questions.length > 8 ? `
                    <div style="text-align:center; font-size:0.75rem; color:var(--text-muted); padding:0.25rem;">
                      + ${questions.length - 8} more questions in this examination
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
          `,
          confirmText: "Verify Answers & Create Exam →",
          cancelText: "Close Preview",
          onConfirm: async () => {
            openAnswerVerificationModal(paper, questions);
          }
        });

      } catch (err) {
        showToast("Failed to load paper details: " + err.message, "error");
      }
    };
  });

  // Verify Answers Button (from table)
  document.querySelectorAll(".btn-verify-paper-answers").forEach(btn => {
    btn.onclick = async () => {
      sound.playClick();
      const paperId = btn.dataset.id;
      try {
        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin" style="font-size:16px;">sync</span> Loading...`;

        const resp = await api.get(`/papers/${paperId}`);
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:var(--accent-secondary);">fact_check</span> Verify Answers`;

        const paper = resp.paper;
        const data = resp.extracted_data || {};
        let questions = data.questions || [];

        if (questions.length === 0) {
          showToast("No questions extracted for this document.", "warning");
          return;
        }

        const hasSolvedAnswers = questions.some(q => 
          (q.options && q.options.some(o => o.is_correct)) || 
          q.sample_solution || 
          q.numerical_expected !== null || 
          q.ai_solved
        );

        if (!hasSolvedAnswers) {
          showToast("AI is automatically solving answers for verification...", "info");
          try {
            const solveResp = await api.post(`/papers/${paperId}/auto-solve`);
            questions = solveResp.extracted_questions || questions;
          } catch (e) {
            // continue with questions
          }
        }

        openAnswerVerificationModal(paper, questions);
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:var(--accent-secondary);">fact_check</span> Verify Answers`;
        showToast("Failed to load paper for verification: " + err.message, "error");
      }
    };
  });

  // Create Exam from paper
  document.querySelectorAll(".btn-create-exam-from-paper").forEach(btn => {
    btn.onclick = async () => {
      sound.playClick();
      const paperId = btn.dataset.id;
      try {
        btn.disabled = true;
        btn.textContent = "Creating...";
        const resp = await api.post(`/papers/${paperId}/create-exam`);
        sound.playSuccess();
        showToast("Interactive examination generated! Opening editor...", "success");
        window.location.hash = `#exam-editor/${resp.exam_id}`;
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">bolt</span> Create Exam`;
        showToast("Failed to create exam: " + err.message, "error");
      }
    };
  });

  // Retry Paper
  document.querySelectorAll(".btn-retry-paper").forEach(btn => {
    btn.onclick = async () => {
      sound.playClick();
      const paperId = btn.dataset.id;
      try {
        await api.post(`/papers/${paperId}/retry`);
        showToast("Processing restarted...", "info");
        window.router.renderCurrentRoute();
      } catch (err) {
        showToast("Retry failed: " + err.message, "error");
      }
    };
  });

  // Delete Paper
  document.querySelectorAll(".btn-delete-paper").forEach(btn => {
    btn.onclick = () => {
      const paperId = btn.dataset.id;
      const paperName = btn.dataset.name;

      showModal({
        title: "Delete Paper?",
        content: `Delete document <strong>"${paperName}"</strong>?`,
        confirmText: "Delete",
        isDanger: true,
        onConfirm: async () => {
          try {
            await api.delete(`/papers/${paperId}`);
            showToast("Document deleted", "info");
            window.router.renderCurrentRoute();
          } catch (err) {
            showToast("Delete failed: " + err.message, "error");
          }
        }
      });
    };
  });
}

// =====================================================================
// INTERACTIVE ANSWER VERIFICATION STUDIO MODAL
// Allows teacher to verify, review, and override AI-set answers before
// generating or publishing the interactive examination.
// =====================================================================
export function openAnswerVerificationModal(paper, initialQuestions) {
  let questions = JSON.parse(JSON.stringify(initialQuestions || []));

  function buildModalHtml() {
    const solvedCount = questions.filter(q => {
      const hasCorrectOpt = q.options && q.options.some(o => o.is_correct);
      const hasSolution = !!(q.sample_solution || q.descriptive_rubric || (q.numerical_expected !== null && q.numerical_expected !== undefined));
      return hasCorrectOpt || hasSolution || q.ai_solved;
    }).length;

    return `
      <div style="display:flex; flex-direction:column; gap:1.25rem; max-height:68vh; overflow-y:auto; padding-right:6px;" id="verification-modal-scroll">
        <!-- AI Intelligence Banner -->
        <div style="background:var(--surface-low); border:2.5px solid #171717; border-radius:10px; padding:1rem 1.25rem; box-shadow:3px 3px 0px #171717; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div style="width:40px; height:40px; border-radius:8px; background:var(--accent-primary); border:2px solid #171717; display:flex; align-items:center; justify-content:center; box-shadow:2px 2px 0px #171717;">
              <span class="material-symbols-outlined" style="font-size:24px; color:#171717;">fact_check</span>
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <strong style="font-size:1.05rem; text-transform:uppercase;">AI Answer Verification Studio</strong>
                <span class="neo-badge neo-badge-sm neo-badge-primary">AI Solved: ${solvedCount}/${questions.length}</span>
              </div>
              <p style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">
                Review AI-selected answers below. Click any option to change it, or edit written solutions & rubrics before creating your interactive exam.
              </p>
            </div>
          </div>
          <button id="btn-re-solve-paper-answers" class="neo-btn neo-btn-sm neo-btn-white" type="button" style="display:flex; align-items:center; gap:0.35rem;">
            <span class="material-symbols-outlined" style="font-size:16px; color:var(--accent-secondary);">auto_awesome</span> Re-Solve with AI
          </button>
        </div>

        <!-- Questions List -->
        <div style="display:flex; flex-direction:column; gap:1rem;" id="verif-questions-container">
          ${questions.map((q, qIdx) => {
            const isSingle = q.question_type === 'mcq_single' || !q.question_type;
            const isMulti = q.question_type === 'mcq_multiple';
            const isTrueFalse = q.question_type === 'true_false';
            const isNumerical = q.question_type === 'numerical' || q.question_type === 'math_problem';
            const hasOptions = q.options && q.options.length > 0;

            return `
              <div class="verification-q-card" data-qidx="${qIdx}">
                <!-- Header -->
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #171717; padding-bottom:0.5rem;">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span class="neo-badge" style="background:#171717; color:#FFF; font-family:var(--font-mono); font-weight:900;">
                      Q${q.question_number || qIdx + 1}
                    </span>
                    <span class="neo-badge neo-badge-sm">${formatQuestionType(q.question_type)}</span>
                    <span class="neo-badge neo-badge-sm" style="background:var(--accent-primary);">${q.marks || 1} Marks</span>
                  </div>
                  <span style="font-size:0.75rem; font-family:var(--font-mono); color:var(--text-muted);">
                    ${hasOptions ? 'Click option to toggle correct answer' : 'Editable Rubric & Solution'}
                  </span>
                </div>

                <!-- Question Text -->
                <div style="font-size:0.95rem; font-weight:700; line-height:1.4; color:var(--text-color);">
                  ${escapeHtml(q.question_text || '')}
                </div>

                <!-- Answer Selection Area -->
                ${(hasOptions && (isSingle || isMulti)) ? `
                  <div style="display:flex; flex-direction:column; gap:0.4rem; margin-top:0.25rem;">
                    <div style="font-size:0.75rem; font-weight:800; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.03em;">
                      Answer Choices (Click to Set Correct):
                    </div>
                    ${q.options.map((opt, optIdx) => {
                      const isCorrect = !!opt.is_correct;
                      return `
                        <div class="verification-option-row ${isCorrect ? 'selected-correct' : ''}" data-qidx="${qIdx}" data-oidx="${optIdx}">
                          <input type="${isSingle ? 'radio' : 'checkbox'}" name="verif_opt_${qIdx}" class="exam-option-radio" ${isCorrect ? 'checked' : ''} style="pointer-events:none;" />
                          <span class="neo-badge neo-badge-sm" style="font-weight:900; width:28px; justify-content:center; flex-shrink:0;">
                            ${opt.option_label || String.fromCharCode(65 + optIdx)}
                          </span>
                          <span style="flex:1; font-size:0.875rem; font-weight:600;">
                            ${escapeHtml(opt.option_text || '')}
                          </span>
                          ${isCorrect ? `
                            <span class="neo-badge neo-badge-sm neo-badge-primary verif-correct-badge" style="font-size:0.65rem; border-width:1.5px;">
                              ✓ Correct Answer
                            </span>
                          ` : `
                            <span class="verif-correct-badge" style="font-size:0.65rem; color:var(--text-muted); display:none;"></span>
                          `}
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : ''}

                ${isTrueFalse ? `
                  <div style="margin-top:0.25rem;">
                    <div style="font-size:0.75rem; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.4rem;">
                      Correct Value:
                    </div>
                    <div style="display:flex; gap:0.75rem;">
                      ${['True', 'False'].map(val => {
                        const isSelected = (q.options && q.options.some(o => o.option_text.toLowerCase() === val.toLowerCase() && o.is_correct)) ||
                                           (q.sample_solution && q.sample_solution.toLowerCase().includes(val.toLowerCase()));
                        return `
                          <button type="button" class="neo-btn neo-btn-sm ${isSelected ? 'neo-btn-primary' : 'neo-btn-white'} btn-verif-tf" data-qidx="${qIdx}" data-val="${val}" style="flex:1; padding:0.6rem; font-weight:800;">
                            ${val === 'True' ? '✓ TRUE' : '✕ FALSE'}
                          </button>
                        `;
                      }).join('')}
                    </div>
                  </div>
                ` : ''}

                ${isNumerical ? `
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-top:0.25rem;">
                    <div>
                      <label style="font-size:0.75rem; font-weight:800; text-transform:uppercase; display:block; margin-bottom:0.25rem;">
                        Expected Value
                      </label>
                      <input type="number" step="any" class="neo-input verif-numerical-val" data-qidx="${qIdx}" value="${q.numerical_expected !== null && q.numerical_expected !== undefined ? q.numerical_expected : (q.correct_numerical_value || '')}" placeholder="e.g. 42" style="font-family:var(--font-mono); font-size:0.85rem;" />
                    </div>
                    <div>
                      <label style="font-size:0.75rem; font-weight:800; text-transform:uppercase; display:block; margin-bottom:0.25rem;">
                        Tolerance (±)
                      </label>
                      <input type="number" step="any" class="neo-input verif-numerical-tol" data-qidx="${qIdx}" value="${q.numerical_tolerance || 0}" placeholder="0.0" style="font-family:var(--font-mono); font-size:0.85rem;" />
                    </div>
                  </div>
                ` : ''}

                ${(!hasOptions && !isTrueFalse && !isNumerical) ? `
                  <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.25rem;">
                    <div>
                      <label style="font-size:0.75rem; font-weight:800; text-transform:uppercase; display:block; margin-bottom:0.25rem;">
                        Model / Sample Solution (AI Drafted)
                      </label>
                      <textarea class="neo-input verif-solution-input" data-qidx="${qIdx}" rows="2" style="font-size:0.82rem; width:100%;" placeholder="Provide ideal student answer...">${escapeHtml(q.sample_solution || '')}</textarea>
                    </div>
                    <div>
                      <label style="font-size:0.75rem; font-weight:800; text-transform:uppercase; display:block; margin-bottom:0.25rem;">
                        Grading Rubric / Evaluation Criteria
                      </label>
                      <textarea class="neo-input verif-rubric-input" data-qidx="${qIdx}" rows="2" style="font-size:0.82rem; width:100%;" placeholder="Key criteria for full and partial credit...">${escapeHtml(q.descriptive_rubric || '')}</textarea>
                    </div>
                  </div>
                ` : ''}

                <!-- Pedagogical Explanation Section -->
                <div style="margin-top:0.35rem; background:var(--surface-low); border:1.5px solid #171717; border-radius:6px; padding:0.5rem 0.75rem;">
                  <div style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:var(--text-muted); display:flex; align-items:center; gap:0.3rem; margin-bottom:0.25rem;">
                    <span class="material-symbols-outlined" style="font-size:14px; color:var(--accent-secondary);">lightbulb</span>
                    Explanation & Learning Notes:
                  </div>
                  <textarea class="neo-input verif-explanation-input" data-qidx="${qIdx}" rows="1" style="font-size:0.78rem; width:100%; background:#FFFFFF;" placeholder="Explanation shown to students in review mode...">${escapeHtml(q.explanation || '')}</textarea>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function attachEvents(container) {
    // 1. MCQ Option click:
    container.querySelectorAll(".verification-option-row").forEach(row => {
      row.onclick = () => {
        sound.playClick();
        const qIdx = parseInt(row.dataset.qidx);
        const oIdx = parseInt(row.dataset.oidx);
        const q = questions[qIdx];
        if (!q || !q.options) return;

        const isSingle = q.question_type === 'mcq_single' || !q.question_type;
        if (isSingle) {
          q.options.forEach((opt, idx) => {
            opt.is_correct = (idx === oIdx);
          });
          const qCard = container.querySelector(`.verification-q-card[data-qidx="${qIdx}"]`);
          if (qCard) {
            qCard.querySelectorAll(".verification-option-row").forEach((r, idx) => {
              const chk = r.querySelector("input");
              const isCorr = (idx === oIdx);
              if (chk) chk.checked = isCorr;
              if (isCorr) {
                r.classList.add("selected-correct");
                let badge = r.querySelector(".verif-correct-badge");
                if (badge) {
                  badge.className = "neo-badge neo-badge-sm neo-badge-primary verif-correct-badge";
                  badge.style.display = "inline-flex";
                  badge.style.fontSize = "0.65rem";
                  badge.style.borderWidth = "1.5px";
                  badge.textContent = "✓ Correct Answer";
                }
              } else {
                r.classList.remove("selected-correct");
                let badge = r.querySelector(".verif-correct-badge");
                if (badge) badge.style.display = "none";
              }
            });
          }
        } else {
          // Multiple choice
          q.options[oIdx].is_correct = !q.options[oIdx].is_correct;
          const isCorr = q.options[oIdx].is_correct;
          const chk = row.querySelector("input");
          if (chk) chk.checked = isCorr;
          if (isCorr) {
            row.classList.add("selected-correct");
            let badge = row.querySelector(".verif-correct-badge");
            if (badge) {
              badge.className = "neo-badge neo-badge-sm neo-badge-primary verif-correct-badge";
              badge.style.display = "inline-flex";
              badge.style.fontSize = "0.65rem";
              badge.style.borderWidth = "1.5px";
              badge.textContent = "✓ Correct Answer";
            }
          } else {
            row.classList.remove("selected-correct");
            let badge = row.querySelector(".verif-correct-badge");
            if (badge) badge.style.display = "none";
          }
        }
      };
    });

    // 2. True / False buttons:
    container.querySelectorAll(".btn-verif-tf").forEach(btn => {
      btn.onclick = () => {
        sound.playClick();
        const qIdx = parseInt(btn.dataset.qidx);
        const val = btn.dataset.val;
        const q = questions[qIdx];
        if (!q) return;

        if (!q.options || q.options.length === 0) {
          q.options = [
            { option_label: "A", option_text: "True", is_correct: val === "True" },
            { option_label: "B", option_text: "False", is_correct: val === "False" }
          ];
        } else {
          q.options.forEach(o => {
            o.is_correct = (o.option_text.toLowerCase() === val.toLowerCase());
          });
        }
        q.sample_solution = val;

        const qCard = container.querySelector(`.verification-q-card[data-qidx="${qIdx}"]`);
        if (qCard) {
          qCard.querySelectorAll(".btn-verif-tf").forEach(b => {
            if (b.dataset.val === val) {
              b.className = "neo-btn neo-btn-sm neo-btn-primary btn-verif-tf";
            } else {
              b.className = "neo-btn neo-btn-sm neo-btn-white btn-verif-tf";
            }
          });
        }
      };
    });

    // 3. Re-solve with AI button:
    const btnReSolve = container.querySelector("#btn-re-solve-paper-answers");
    if (btnReSolve) {
      btnReSolve.onclick = async () => {
        sound.playClick();
        try {
          btnReSolve.disabled = true;
          btnReSolve.innerHTML = `<span class="material-symbols-outlined animate-spin" style="font-size:16px;">sync</span> Solving...`;
          const resp = await api.post(`/papers/${paper.id}/auto-solve`);
          sound.playSuccess();
          showToast("AI answered all questions! Refreshing view...", "success");
          questions = resp.extracted_questions || [];
          const modalBody = document.querySelector("#active-neo-modal .neo-modal-body");
          if (modalBody) {
            modalBody.innerHTML = buildModalHtml();
            attachEvents(modalBody);
          }
        } catch (err) {
          btnReSolve.disabled = false;
          btnReSolve.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:var(--accent-secondary);">auto_awesome</span> Re-Solve with AI`;
          showToast("Failed to re-solve answers: " + err.message, "error");
        }
      };
    }
  }

  function collectFormValues() {
    const modalEl = document.getElementById("active-neo-modal");
    if (!modalEl) return questions;

    // Collect numerical inputs
    modalEl.querySelectorAll(".verif-numerical-val").forEach(input => {
      const qIdx = parseInt(input.dataset.qidx);
      if (questions[qIdx]) {
        const val = input.value.trim();
        questions[qIdx].numerical_expected = val !== "" ? parseFloat(val) : null;
      }
    });
    modalEl.querySelectorAll(".verif-numerical-tol").forEach(input => {
      const qIdx = parseInt(input.dataset.qidx);
      if (questions[qIdx]) {
        const tol = input.value.trim();
        questions[qIdx].numerical_tolerance = tol !== "" ? parseFloat(tol) : 0.0;
      }
    });

    // Collect solution textareas
    modalEl.querySelectorAll(".verif-solution-input").forEach(ta => {
      const qIdx = parseInt(ta.dataset.qidx);
      if (questions[qIdx]) {
        questions[qIdx].sample_solution = ta.value.trim();
      }
    });

    // Collect rubric textareas
    modalEl.querySelectorAll(".verif-rubric-input").forEach(ta => {
      const qIdx = parseInt(ta.dataset.qidx);
      if (questions[qIdx]) {
        questions[qIdx].descriptive_rubric = ta.value.trim();
      }
    });

    // Collect explanation textareas
    modalEl.querySelectorAll(".verif-explanation-input").forEach(ta => {
      const qIdx = parseInt(ta.dataset.qidx);
      if (questions[qIdx]) {
        questions[qIdx].explanation = ta.value.trim();
      }
    });

    return questions;
  }

  showModal({
    title: `Verify AI Answers: ${paper.original_filename}`,
    content: buildModalHtml(),
    modalClass: "neo-modal-lg",
    confirmText: "Confirm Answers & Create Exam →",
    cancelText: "Close",
    extraFooterHtml: `
      <button id="btn-modal-save-library" class="neo-btn neo-btn-white" type="button" style="margin-right:auto;">
        <span class="material-symbols-outlined" style="font-size:16px;">save</span> Save in Library
      </button>
    `,
    onConfirm: async () => {
      sound.playClick();
      try {
        const updatedQs = collectFormValues();
        // 1. Save updated questions with teacher verifications
        await api.put(`/papers/${paper.id}/update-questions`, { questions: updatedQs });
        // 2. Generate interactive exam
        const createResp = await api.post(`/papers/${paper.id}/create-exam`);
        sound.playSuccess();
        showToast("Interactive examination created with verified answers!", "success");
        window.location.hash = `#exam-editor/${createResp.exam_id}`;
      } catch (err) {
        showToast("Failed to create exam: " + err.message, "error");
        return false;
      }
    }
  });

  const modalBody = document.querySelector("#active-neo-modal .neo-modal-body");
  if (modalBody) {
    attachEvents(modalBody);
  }

  const btnSaveLib = document.getElementById("btn-modal-save-library");
  if (btnSaveLib) {
    btnSaveLib.onclick = async () => {
      sound.playClick();
      try {
        btnSaveLib.disabled = true;
        btnSaveLib.textContent = "Saving...";
        const updatedQs = collectFormValues();
        await api.put(`/papers/${paper.id}/update-questions`, { questions: updatedQs });
        sound.playSuccess();
        showToast("Verified answers saved to question paper!", "success");
        const existingModal = document.getElementById("active-neo-modal");
        if (existingModal) existingModal.remove();
        window.router.renderCurrentRoute();
      } catch (err) {
        btnSaveLib.disabled = false;
        btnSaveLib.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">save</span> Save in Library`;
        showToast("Save failed: " + err.message, "error");
      }
    };
  }
}

async function uploadFile(file) {
  const progressCard = document.getElementById("upload-progress-card");
  const filenameTxt = document.getElementById("upload-filename-txt");
  const progressBar = document.getElementById("upload-progress-bar");
  const statusBadge = document.getElementById("upload-status-badge");
  const chkAutoSolve = document.getElementById("chk-auto-solve-upload");

  const shouldAutoSolve = chkAutoSolve ? chkAutoSolve.checked : true;

  if (progressCard) {
    progressCard.style.display = "block";
    filenameTxt.textContent = `Uploading: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
    progressBar.style.width = "30%";
    statusBadge.textContent = "Uploading Document...";
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("auto_solve", shouldAutoSolve ? "true" : "false");

  try {
    if (progressBar) progressBar.style.width = "65%";
    if (statusBadge) statusBadge.textContent = shouldAutoSolve ? "Extracting & Solving with AI..." : "Extracting Questions...";

    const resp = await api.post(`/papers/upload?auto_solve=${shouldAutoSolve}`, formData);
    
    if (progressBar) progressBar.style.width = "100%";
    if (statusBadge) statusBadge.textContent = "Processing Complete!";

    sound.playSuccess();
    const qCount = resp.extracted_questions ? resp.extracted_questions.length : 0;
    showToast(`Success! Extracted ${qCount} questions from "${file.name}".`, "success");

    // Open answer verification studio modal directly so teacher can review answers
    if (resp.extracted_questions && resp.extracted_questions.length > 0) {
      openAnswerVerificationModal(resp.paper, resp.extracted_questions);
    } else {
      window.router.renderCurrentRoute();
    }

  } catch (err) {
    if (statusBadge) {
      statusBadge.textContent = "Upload Failed";
      statusBadge.className = "neo-badge neo-badge-danger";
    }
    showToast("Upload failed: " + err.message, "error");
  }
}
