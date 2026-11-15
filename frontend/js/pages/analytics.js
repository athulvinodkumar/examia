// =====================================================================
// EXAMIA EXAMINATION ANALYTICS & ITEM DIFFICULTY SUITE
// =====================================================================

import { api } from '../api.js';
import { sound } from '../sound.js';
import { showToast } from '../notifications.js';

let activeExamId = null;

export async function renderAnalyticsView(examId) {
  activeExamId = examId;
  let data = null;

  try {
    data = await api.get(`/analytics/exams/${examId}`);
  } catch (err) {
    return `
      <div class="neo-card" style="text-align:center; padding:3rem;">
        <h3 style="color:var(--color-error);">Could not load analytics</h3>
        <p>${err.message}</p>
        <a href="#exams" class="neo-btn neo-btn-primary" style="margin-top:1rem;">Back to Exams</a>
      </div>
    `;
  }

  const { summary, score_distribution, questions_analysis, difficult_questions, student_reports } = data;

  return `
    <div class="animate-fade-in">
      <!-- Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <a href="#exams/${examId}/submissions" class="neo-btn neo-btn-sm neo-btn-white" style="margin-bottom:0.5rem;">← Submissions</a>
          <h1 style="font-size:2rem; font-weight:800; text-transform:uppercase;">Analytics: ${data.exam_title}</h1>
          <p style="color:var(--text-muted); font-size:0.95rem;">Cohort performance breakdown, item difficulty index, and statistical distributions.</p>
        </div>

        <button id="btn-export-csv" class="neo-btn neo-btn-primary">
          <span class="material-symbols-outlined" style="font-size:20px;">download</span> Export Full CSV
        </button>
      </div>

      <!-- High-Level Metrics Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-card-label">Total Submissions</span>
          <div class="stat-card-value">${summary.total_submissions}</div>
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Completed Evaluations</span>
        </div>

        <div class="stat-card" style="background:var(--accent-primary);">
          <span class="stat-card-label" style="color:#171717;">Average Score</span>
          <div class="stat-card-value" style="color:#171717;">${summary.average_score} <span style="font-size:1.25rem;">/ ${data.total_marks}</span></div>
          <span style="font-size:0.75rem; color:#171717; font-weight:700;">Cohort Mean</span>
        </div>

        <div class="stat-card">
          <span class="stat-card-label">Pass Percentage</span>
          <div class="stat-card-value">${summary.pass_rate}%</div>
          <span style="font-size:0.75rem; color:var(--color-success); font-weight:700;">Standard Threshold (≥40%)</span>
        </div>

        <div class="stat-card">
          <span class="stat-card-label">High / Low Score</span>
          <div class="stat-card-value" style="font-size:1.75rem;">${summary.highest_score} <span style="font-size:1.15rem; color:var(--text-muted);">/ ${summary.lowest_score}</span></div>
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Score Range</span>
        </div>
      </div>

      <!-- Charts & Breakdown Grid -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.75rem; margin-bottom:2rem;">
        <!-- Score Distribution Histogram -->
        <div class="neo-card">
          <h3 style="font-size:1.15rem; font-weight:800; text-transform:uppercase; margin-bottom:1rem;">Score Distribution</h3>
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            ${Object.entries(score_distribution).map(([bin, count]) => {
              const total = summary.total_submissions || 1;
              const pct = Math.round((count / total) * 100);
              return `
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-family:var(--font-mono); font-weight:700; margin-bottom:0.25rem;">
                    <span>${bin}</span>
                    <span>${count} candidates (${pct}%)</span>
                  </div>
                  <div style="width:100%; height:18px; background:var(--surface-low); border:1.5px solid #171717; border-radius:4px; overflow:hidden;">
                    <div style="width:${pct}%; height:100%; background:var(--accent-primary); border-right:${pct > 0 ? '1.5px solid #171717' : 'none'};"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Most Difficult Questions -->
        <div class="neo-card">
          <h3 style="font-size:1.15rem; font-weight:800; text-transform:uppercase; margin-bottom:1rem;">Most Challenging Questions</h3>
          ${difficult_questions.length === 0 ? `
            <p style="color:var(--text-muted); font-size:0.85rem; padding:1.5rem 0;">No difficult questions flagged (all success rates ≥ 50%).</p>
          ` : `
            <div style="display:flex; flex-direction:column; gap:0.75rem;">
              ${difficult_questions.map(dq => `
                <div style="padding:0.75rem; border:1.5px solid #171717; border-radius:8px; background:var(--surface-low);">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                    <strong>Question #${dq.question_number}</strong>
                    <span class="neo-badge neo-badge-sm neo-badge-danger">${dq.success_rate}% Success</span>
                  </div>
                  <p style="font-size:0.8rem; color:var(--text-muted); margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${dq.question_text}</p>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>

      <!-- Question Item Analysis Table -->
      <div class="neo-card" style="margin-bottom:2rem; padding:1.5rem;">
        <h3 style="font-size:1.2rem; font-weight:800; text-transform:uppercase; margin-bottom:1rem;">Item-by-Item Analysis</h3>
        <div class="neo-table-container">
          <table class="neo-table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Type</th>
                <th>Marks</th>
                <th>Attempts</th>
                <th>Avg Score</th>
                <th>Success Rate</th>
              </tr>
            </thead>
            <tbody>
              ${questions_analysis.map(qa => `
                <tr>
                  <td><strong>Q${qa.question_number}:</strong> ${qa.question_text}</td>
                  <td style="font-family:var(--font-mono); font-size:0.8rem;">${qa.question_type}</td>
                  <td style="font-family:var(--font-mono); font-weight:700;">${qa.marks}m</td>
                  <td style="font-family:var(--font-mono);">${qa.total_attempts}</td>
                  <td style="font-family:var(--font-mono); font-weight:700;">${qa.average_score}</td>
                  <td>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                      <div style="width:70px; height:10px; background:var(--surface-low); border:1px solid #171717; border-radius:3px; overflow:hidden;">
                        <div style="width:${qa.success_rate}%; height:100%; background:${qa.success_rate >= 60 ? 'var(--color-success)' : (qa.success_rate >= 40 ? 'var(--color-warning)' : 'var(--color-error)')};"></div>
                      </div>
                      <span style="font-size:0.8rem; font-family:var(--font-mono); font-weight:700;">${qa.success_rate}%</span>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Individual Student Results Table -->
      <div class="neo-card" style="padding:1.5rem;">
        <h3 style="font-size:1.2rem; font-weight:800; text-transform:uppercase; margin-bottom:1rem;">Candidate Rankings</h3>
        <div class="neo-table-container">
          <table class="neo-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Candidate Name</th>
                <th>Email</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Result</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${student_reports.map((sr, idx) => `
                <tr>
                  <td style="font-weight:900; font-family:var(--font-mono);">#${idx + 1}</td>
                  <td><strong>${sr.student_name}</strong></td>
                  <td style="font-size:0.8rem; color:var(--text-muted); font-family:var(--font-mono);">${sr.student_email || 'Candidate'}</td>
                  <td style="font-family:var(--font-mono); font-weight:800;">${sr.score_obtained} / ${sr.total_possible}</td>
                  <td style="font-family:var(--font-mono); font-weight:800;">${sr.percentage}%</td>
                  <td>
                    <span class="neo-badge neo-badge-sm ${sr.passed ? 'neo-badge-success' : 'neo-badge-danger'}">
                      ${sr.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </td>
                  <td>
                    <a href="#results/${sr.submission_id}" class="neo-btn neo-btn-sm neo-btn-white">
                      Scorecard
                    </a>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function attachAnalyticsEvents() {
  const btnExport = document.getElementById("btn-export-csv");
  if (btnExport) {
    btnExport.onclick = async () => {
      sound.playClick();
      btnExport.textContent = "Downloading CSV...";
      try {
        const blob = await api.get(`/analytics/exams/${activeExamId}/export-csv`);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `examia_results_${activeExamId}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        sound.playSuccess();
        showToast("CSV export downloaded successfully!", "success");
      } catch (err) {
        showToast("Failed to download CSV: " + err.message, "error");
      } finally {
        btnExport.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px;">download</span> Export Full CSV`;
      }
    };
  }
}
