// =====================================================================
// EXAMIA DETAILED SCORECARD & RESULTS REPORT
// =====================================================================

import { api } from '../api.js';
import { sound } from '../sound.js';
import { showToast } from '../notifications.js';
import { renderMathInElement } from '../components/katex-helper.js';

export async function renderResultsView(submissionId) {
  let report = null;

  try {
    report = await api.get(`/results/submissions/${submissionId}`);
  } catch (err) {
    return `
      <div class="neo-card" style="max-width:540px; margin:4rem auto; text-align:center;">
        <span class="material-symbols-outlined" style="font-size:48px; color:var(--color-error);">error</span>
        <h3 style="font-weight:800; text-transform:uppercase; margin-top:0.5rem;">Scorecard Unavailable</h3>
        <p style="color:var(--text-muted); margin:0.5rem 0 1.5rem;">${err.message}</p>
        <a href="#student-dashboard" class="neo-btn neo-btn-primary">Return to Dashboard</a>
      </div>
    `;
  }

  if (report.status === "pending_release") {
    return `
      <div class="neo-card" style="max-width:580px; margin:4rem auto; text-align:center; padding:3rem 2rem;">
        <div style="width:72px; height:72px; background:var(--accent-primary); border:2.5px solid #171717; border-radius:16px; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; box-shadow:4px 4px 0px #171717;">
          <span class="material-symbols-outlined" style="font-size:40px; color:#171717;">hourglass_top</span>
        </div>
        <span class="neo-badge neo-badge-warning">Results Pending Release</span>
        <h2 style="font-size:1.75rem; font-weight:800; text-transform:uppercase; margin:0.75rem 0 0.5rem;">${report.exam_title}</h2>
        <p style="color:var(--text-muted); max-width:440px; margin:0 auto 1.5rem; font-size:0.95rem;">
          Your responses have been successfully submitted and stored. Your teacher has configured manual or scheduled grade release for this evaluation.
        </p>
        <a href="#student-dashboard" class="neo-btn neo-btn-primary">Back to Dashboard</a>
      </div>
    `;
  }

  const questions = report.questions || [];

  return `
    <div class="animate-fade-in" style="max-width:1000px; margin:0 auto;">
      <!-- Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <a href="#student-dashboard" class="neo-btn neo-btn-sm neo-btn-white" style="margin-bottom:0.5rem;">← Dashboard</a>
          <h1 style="font-size:2rem; font-weight:800; text-transform:uppercase;">Performance Scorecard</h1>
          <p style="color:var(--text-muted); font-size:0.95rem;">${report.exam_title} • Candidate: <strong>${report.student_name}</strong></p>
        </div>

        <button onclick="window.print()" class="neo-btn neo-btn-white neo-btn-sm">
          <span class="material-symbols-outlined" style="font-size:18px;">print</span> Print Scorecard
        </button>
      </div>

      <!-- Scorecard High-Impact Hero Strip -->
      <div class="neo-card neo-card-accent" style="margin-bottom:2rem; padding:1.75rem;">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1.5rem; align-items:center;">
          <div>
            <span class="uppercase-label" style="color:#171717;">Total Score</span>
            <div style="font-size:2.5rem; font-family:var(--font-heading); font-weight:900; line-height:1; color:#171717;">
              ${report.score_obtained} <span style="font-size:1.5rem; font-weight:700;">/ ${report.total_possible}</span>
            </div>
          </div>

          <div>
            <span class="uppercase-label" style="color:#171717;">Percentage</span>
            <div style="font-size:2.5rem; font-family:var(--font-heading); font-weight:900; line-height:1; color:#171717;">
              ${report.percentage}%
            </div>
          </div>

          <div>
            <span class="uppercase-label" style="color:#171717;">Final Status</span>
            <div style="margin-top:0.25rem;">
              <span class="neo-badge ${report.passed ? 'neo-badge-success' : 'neo-badge-danger'}" style="font-size:0.95rem; padding:4px 12px;">
                ${report.passed ? '✓ PASSED' : '✗ FAILED'}
              </span>
            </div>
          </div>

          <div>
            <span class="uppercase-label" style="color:#171717;">Time Spent</span>
            <div style="font-family:var(--font-mono); font-size:1.15rem; font-weight:800; margin-top:0.25rem; color:#171717;">
              ${Math.round(report.time_spent_seconds / 60)} Minutes
            </div>
          </div>
        </div>
      </div>

      <!-- Item by Item Review -->
      <div style="margin-bottom:1.5rem;">
        <h3 style="font-size:1.35rem; font-weight:800; text-transform:uppercase; margin-bottom:1rem;">Question-Wise Breakdown</h3>
      </div>

      <div style="display:flex; flex-direction:column; gap:1.25rem;">
        ${questions.map((q, idx) => {
          const isCorrect = (q.score_awarded >= q.marks);
          const isPartial = (q.score_awarded > 0 && q.score_awarded < q.marks);

          return `
            <div class="neo-card" style="padding:1.5rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; padding-bottom:0.5rem; border-bottom:1.5px solid #171717;">
                <span style="font-weight:800; font-family:var(--font-heading); font-size:1.05rem;">
                  Question #${q.question_number || idx + 1}
                </span>
                <span class="neo-badge ${isCorrect ? 'neo-badge-success' : (isPartial ? 'neo-badge-warning' : 'neo-badge-danger')}">
                  ${q.score_awarded || 0} / ${q.marks} Marks
                </span>
              </div>

              <div class="math-renderable-content" style="font-size:1.05rem; font-weight:500; margin-bottom:1rem;">
                ${q.question_text}
              </div>

              <!-- Candidate Response -->
              <div style="background:var(--surface-low); border:1.5px solid #171717; border-radius:8px; padding:0.85rem; font-size:0.9rem; margin-bottom:0.75rem;">
                <span class="uppercase-label" style="display:block; margin-bottom:0.25rem; font-size:0.7rem;">Your Answer:</span>
                <div style="font-family:var(--font-mono); font-weight:600;">
                  ${renderStudentAnswerDisplay(q)}
                </div>
              </div>

              <!-- Correct Key (If Allowed) -->
              ${q.options && q.options.some(o => o.is_correct) ? `
                <div style="background:var(--color-success-bg); border:1.5px solid var(--color-success); border-radius:8px; padding:0.85rem; font-size:0.85rem; margin-bottom:0.75rem;">
                  <span class="uppercase-label" style="display:block; margin-bottom:0.25rem; color:var(--color-success);">Correct Option:</span>
                  ${q.options.filter(o => o.is_correct).map(o => `
                    <div style="font-weight:700;">${o.option_label}) ${o.option_text}</div>
                  `).join('')}
                </div>
              ` : ''}

              <!-- Reference / Original Answer for Manual Entry Questions -->
              ${(q.sample_solution || (q.accepted_answers && q.accepted_answers.length > 0) || (q.numerical_expected !== undefined && q.numerical_expected !== null)) && (!q.options || !q.options.some(o => o.is_correct)) ? `
                <div style="background:var(--color-success-bg); border:1.5px solid var(--color-success); border-radius:8px; padding:0.85rem; font-size:0.85rem; margin-bottom:0.75rem;">
                  <span class="uppercase-label" style="display:block; margin-bottom:0.25rem; color:var(--color-success);">Reference / Original Answer:</span>
                  <div style="font-weight:700;">
                    ${q.numerical_expected !== undefined && q.numerical_expected !== null ? `Expected Value: ${q.numerical_expected} ${q.numerical_tolerance ? `(±${q.numerical_tolerance})` : ''}` : (q.sample_solution || (q.accepted_answers || []).join(' • '))}
                  </div>
                </div>
              ` : ''}

              <!-- Explanation (If Allowed) -->
              ${q.explanation ? `
                <div style="background:var(--surface-white); border:1.5px dashed #171717; border-radius:8px; padding:0.85rem; font-size:0.85rem;">
                  <span class="uppercase-label" style="display:block; margin-bottom:0.25rem;">Solution Explanation:</span>
                  <div class="math-renderable-content">${q.explanation}</div>
                </div>
              ` : ''}

              <!-- Teacher Notes -->
              ${q.evaluation_notes ? `
                <div style="margin-top:0.75rem; padding:0.6rem; background:var(--accent-secondary-light); border:1.5px solid #171717; border-radius:6px; font-size:0.85rem;">
                  <strong>Teacher Commentary:</strong> ${q.evaluation_notes}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderStudentAnswerDisplay(q) {
  if (q.question_type === "mcq_single" || q.question_type === "true_false") {
    const selId = q.student_selected_option_ids ? q.student_selected_option_ids[0] : null;
    const opt = (q.options || []).find(o => o.id === selId);
    return opt ? `${opt.option_label}) ${opt.option_text}` : "<em>No selection made</em>";
  }

  if (q.question_type === "mcq_multiple") {
    const selSet = new Set(q.student_selected_option_ids || []);
    const opts = (q.options || []).filter(o => selSet.has(o.id));
    return opts.length ? opts.map(o => `${o.option_label}) ${o.option_text}`).join(" | ") : "<em>No selection made</em>";
  }

  if (q.question_type === "numerical") {
    return q.student_numerical_answer !== null && q.student_numerical_answer !== undefined ? `${q.student_numerical_answer}` : "<em>Blank</em>";
  }

  return q.student_text_answer || "<em>No response provided</em>";
}

export function attachResultsEvents() {
  document.querySelectorAll(".math-renderable-content").forEach(el => {
    renderMathInElement(el);
  });
}
