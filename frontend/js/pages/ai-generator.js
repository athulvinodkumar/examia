// =====================================================================
// EXAMIA AI EXAMINATION GENERATOR FROM SYLLABUS & CONTENT
// Analyzes course syllabus/notes, detects topics, and synthesizes
// complete interactive examinations in Autonomous AI or Custom mode.
// =====================================================================

import { api } from '../api.js';
import { sound } from '../sound.js';
import { showToast } from '../notifications.js';

let state = {
  activeStep: 1, // 1 = Upload / Select, 2 = Analyze & Configure, 3 = Generating
  paperId: null,
  filename: "",
  analysis: null,
  mode: "auto", // "auto" | "custom"
  examTitle: "",
  subject: "",
  targetTotalMarks: 50,
  durationMinutes: 60,
  difficulty: "medium", // "easy" | "medium" | "hard"
  selectedTopics: new Set(),
  questionTypesConfig: {
    mcq_single: { label: "Single-Choice MCQ", count: 8, marks: 1.0, icon: "radio_button_checked" },
    mcq_multiple: { label: "Multiple-Select (MSQ)", count: 2, marks: 2.0, icon: "check_box" },
    true_false: { label: "True / False", count: 4, marks: 1.0, icon: "flaky" },
    fill_blank: { label: "Fill in the Blanks", count: 4, marks: 1.0, icon: "edit_note" },
    short_answer: { label: "Short Answer", count: 4, marks: 3.0, icon: "short_text" },
    long_answer: { label: "Long / Descriptive", count: 2, marks: 5.0, icon: "subject" },
    numerical: { label: "Numerical Problem", count: 1, marks: 5.0, icon: "calculate" },
    case_study: { label: "Case Study / Scenario", count: 0, marks: 8.0, icon: "menu_book" }
  },
  historyItems: [],
  isAnalyzing: false,
  isGenerating: false
};

const SAMPLE_OS_SYLLABUS = `COMPUTER SCIENCE 301: OPERATING SYSTEMS & DISTRIBUTED SYSTEMS
Course Syllabus & Curriculum Specification

Module 1: Process Management & CPU Scheduling
- Process Control Block (PCB), Context Switching, Process Lifecycle States (New, Ready, Running, Waiting, Terminated).
- CPU Scheduling Algorithms: First-Come First-Served (FCFS), Shortest Job First (SJF), Round Robin (RR) with quantum, Priority Scheduling.
- Inter-Process Communication (IPC): Shared memory and message passing architectures.
- Process Synchronization: Race conditions, Critical Section Problem, Peterson's Solution, Semaphores (Counting and Binary), Mutex locks, and Condition Variables.

Module 2: Deadlocks & Concurrency Control
- The four Coffman conditions for deadlock: Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait.
- Deadlock Handling Strategies: Deadlock Prevention, Deadlock Avoidance with Dijkstra's Banker's Algorithm.
- Deadlock Detection: Resource Allocation Graphs (RAG) and cycle detection algorithms.

Module 3: Memory Management & Virtual Memory Architecture
- Address binding, Logical vs Physical address spaces, Memory Management Unit (MMU).
- Contiguous Memory Allocation: First-Fit, Best-Fit, Worst-Fit, Internal vs External Fragmentation.
- Non-contiguous Allocation: Paging, Page Tables, Translation Lookaside Buffer (TLB), Inverted Page Tables, Segmentation.
- Virtual Memory: Demand Paging, Page Fault handling routine.
- Page Replacement Algorithms: FIFO, Least Recently Used (LRU), Optimal Page Replacement (OPT).
- Formulas: Effective Memory Access Time EMAT = (1 - p) * ma + p * page_fault_service_time. Thrashing and Working Set Model.

Module 4: Storage Systems & File Systems
- Disk Structure & Scheduling: FCFS, SSTF, SCAN (Elevator Algorithm), C-SCAN, LOOK.
- File System Interface: File attributes, Directory hierarchies (Single, Two-level, Tree, Acyclic Graph).
- File Allocation Methods: Contiguous, Linked List, Indexed Allocation (UNIX Inode structure).
- Free Space Management: Bitmaps, Linked Lists, Grouping, and Counting.`;

export async function renderAIGenerator() {
  // Load previous syllabus history
  try {
    const historyResp = await api.get("/generator/history");
    state.historyItems = historyResp.items || [];
  } catch (e) {
    state.historyItems = [];
  }

  return `
    <div class="animate-fade-in" style="max-width:1150px; margin:0 auto; padding-bottom:3rem;">
      <!-- Page Header -->
      <div style="margin-bottom:2rem; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
        <div>
          <span class="neo-badge neo-badge-primary">AI Curriculum Synthesis</span>
          <h1 style="font-size:2.25rem; font-weight:800; text-transform:uppercase; margin-top:0.25rem; letter-spacing:-0.02em;">
            AI Examination Generator
          </h1>
          <p style="color:var(--text-muted); font-size:0.95rem; max-width:680px;">
            Upload your course syllabus, textbook chapter, or lecture notes. Examia AI reads and analyzes every topic, then synthesizes a complete interactive examination with fully solved answer keys and grading rubrics.
          </p>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <a href="#papers" class="neo-btn neo-btn-sm neo-btn-white">
            <span class="material-symbols-outlined" style="font-size:18px;">description</span> Question Papers
          </a>
          <a href="#exams" class="neo-btn neo-btn-sm neo-btn-white">
            <span class="material-symbols-outlined" style="font-size:18px;">assignment</span> My Exams
          </a>
        </div>
      </div>

      <!-- Stepper Indicator -->
      <div class="neo-card" style="padding:1rem 1.5rem; margin-bottom:2rem; display:flex; justify-content:space-between; align-items:center; background:#FFFFFF;">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div class="step-bubble ${state.activeStep >= 1 ? 'step-active' : ''}">1</div>
          <div>
            <div style="font-weight:800; font-size:0.88rem; text-transform:uppercase;">Upload Syllabus / Notes</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">PDF, Word DOCX, or Text notes</div>
          </div>
        </div>
        <span class="material-symbols-outlined" style="color:var(--text-muted);">arrow_forward</span>
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div class="step-bubble ${state.activeStep >= 2 ? 'step-active' : ''}">2</div>
          <div>
            <div style="font-weight:800; font-size:0.88rem; text-transform:uppercase;">Topic Analysis & Scope</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Curriculum depth & concepts</div>
          </div>
        </div>
        <span class="material-symbols-outlined" style="color:var(--text-muted);">arrow_forward</span>
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div class="step-bubble ${state.activeStep >= 2 ? 'step-active' : ''}">3</div>
          <div>
            <div style="font-weight:800; font-size:0.88rem; text-transform:uppercase;">Exam Blueprint & Synthesize</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">AI Does Everything vs Custom</div>
          </div>
        </div>
      </div>

      <!-- MAIN CONTAINER: STEP 1 UPLOAD -->
      <div id="section-step-1" style="${state.activeStep === 1 ? 'display:block;' : 'display:none;'}">
        <div class="neo-card" style="margin-bottom:2rem;">
          <div id="syllabus-dropzone" class="upload-dropzone">
            <input type="file" id="syllabus-file-input" accept=".pdf,.docx,.doc,.txt" style="display:none;" />
            <div style="display:flex; flex-direction:column; align-items:center; gap:0.85rem; text-align:center;">
              <div style="width:72px; height:72px; border-radius:12px; background:var(--accent-primary); border:2.5px solid #171717; display:flex; align-items:center; justify-content:center; box-shadow:3px 3px 0px #171717;">
                <span class="material-symbols-outlined" style="font-size:40px; color:#171717;">auto_stories</span>
              </div>
              <div>
                <h3 style="font-size:1.35rem; font-weight:800; text-transform:uppercase;">
                  Upload Syllabus or Learning Content
                </h3>
                <p style="color:var(--text-muted); font-size:0.9rem; max-width:480px; margin-top:0.25rem;">
                  Drag & drop course syllabus, lecture notes, textbook chapters, or topic outlines (PDF, DOCX, TXT up to 25 MB).
                </p>
              </div>

              <div style="display:flex; gap:0.75rem; flex-wrap:wrap; justify-content:center; margin-top:0.5rem;">
                <button id="btn-browse-syllabus" class="neo-btn neo-btn-primary" type="button">
                  <span class="material-symbols-outlined" style="font-size:18px;">upload_file</span> Browse Document
                </button>
                <button id="btn-load-sample-syllabus" class="neo-btn neo-btn-white" type="button" title="Load sample Operating Systems syllabus to test instantly">
                  <span class="material-symbols-outlined" style="font-size:18px; color:var(--accent-secondary);">bolt</span> Try Sample Syllabus
                </button>
              </div>
            </div>
          </div>

          <!-- Document History / Recent Syllabi -->
          ${state.historyItems.length > 0 ? `
            <div style="margin-top:1.5rem; border-top:2px dashed #171717; padding-top:1.25rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                <span class="uppercase-label" style="font-size:0.75rem; color:var(--text-muted);">Or Select Previously Uploaded Syllabus:</span>
                <span class="neo-badge neo-badge-sm">${state.historyItems.length} Materials</span>
              </div>
              <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:0.75rem;">
                ${state.historyItems.map(item => `
                  <div class="neo-card neo-card-clickable btn-select-history" data-paper-id="${item.id}" style="padding:0.75rem 1rem; display:flex; align-items:center; justify-content:space-between;">
                    <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:0.5rem;">
                      <div style="font-weight:700; font-size:0.85rem; text-overflow:ellipsis; overflow:hidden;">${item.filename}</div>
                      <span style="font-size:0.7rem; color:var(--text-muted);">${(item.analysis && item.analysis.subject) ? item.analysis.subject : 'Curriculum Document'}</span>
                    </div>
                    <span class="neo-btn neo-btn-sm neo-btn-white" style="padding:2px 8px; font-size:0.75rem;">Use →</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- LOADING ANALYSIS STATE -->
      <div id="section-analyzing" class="neo-card" style="display:none; text-align:center; padding:3.5rem 2rem; margin-bottom:2rem;">
        <div style="width:70px; height:70px; margin:0 auto 1.5rem; background:var(--accent-primary); border:2.5px solid #171717; border-radius:12px; display:flex; align-items:center; justify-content:center; box-shadow:4px 4px 0px #171717;">
          <span class="material-symbols-outlined animate-spin" style="font-size:38px; color:#171717;">sync</span>
        </div>
        <h2 style="font-size:1.6rem; font-weight:800; text-transform:uppercase;">AI Reading & Analyzing Curriculum...</h2>
        <p style="color:var(--text-muted); font-size:0.95rem; max-width:500px; margin:0.5rem auto 1.5rem;" id="analysis-status-ticker">
          Extracting learning modules, identifying core concepts, and drafting examination blueprint...
        </p>
        <div style="max-width:350px; margin:0 auto; height:8px; background:var(--surface-low); border:2px solid #171717; border-radius:99px; overflow:hidden;">
          <div style="height:100%; width:60%; background:var(--accent-secondary); animation:pulse 1.5s infinite;"></div>
        </div>
      </div>

      <!-- MAIN CONTAINER: STEP 2 & 3 CONFIGURE & GENERATE -->
      <div id="section-step-2" style="${state.activeStep >= 2 ? 'display:block;' : 'display:none;'}">
        <!-- TOPIC ANALYSIS CARD -->
        <div class="neo-card" style="margin-bottom:2rem; background:#FFFFFF;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem;">
            <div style="flex:1; min-width:280px;">
              <span class="neo-badge neo-badge-sm neo-badge-primary" style="margin-bottom:0.4rem;">Analyzed Learning Content</span>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <input type="text" id="input-subject-title" class="neo-input" style="font-size:1.25rem; font-weight:800; text-transform:uppercase; font-family:var(--font-heading); padding:0.4rem 0.75rem;" value="${state.subject || 'Operating Systems'}" placeholder="Subject / Course Title" />
              </div>
              <p style="color:var(--text-muted); font-size:0.88rem; margin-top:0.4rem;" id="analysis-summary-text">
                ${state.analysis ? (state.analysis.summary || '') : 'Comprehensive course curriculum covering core concepts and applied problems.'}
              </p>
            </div>
            <button id="btn-reupload-syllabus" class="neo-btn neo-btn-sm neo-btn-white">
              <span class="material-symbols-outlined" style="font-size:16px;">cached</span> Change Document
            </button>
          </div>

          <!-- TOPIC TAGS (Selectable) -->
          <div style="background:var(--bg-main); border:2px solid #171717; border-radius:8px; padding:1rem; margin-top:0.75rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
              <span class="uppercase-label" style="font-size:0.75rem; color:var(--text-muted);">
                Detected Curriculum Topics (Click to Toggle Focus):
              </span>
              <button id="btn-select-all-topics" class="neo-btn neo-btn-sm neo-btn-white" style="padding:2px 8px; font-size:0.7rem;">
                Select All
              </button>
            </div>
            <div id="topics-badges-container" style="display:flex; flex-wrap:wrap; gap:0.5rem;">
              <!-- Topic Badges rendered here -->
            </div>
          </div>
        </div>

        <!-- GENERATION MODE SELECTOR -->
        <div style="margin-bottom:1.5rem;">
          <h3 style="font-size:1.2rem; font-weight:800; text-transform:uppercase; margin-bottom:0.75rem;">
            Choose Generation Strategy
          </h3>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem;">
            <!-- Option A: AI Does Everything -->
            <div id="mode-card-auto" class="mode-select-card ${state.mode === 'auto' ? 'active' : ''}">
              <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.5rem;">
                <div style="width:38px; height:38px; border-radius:8px; background:var(--accent-primary); border:2px solid #171717; display:flex; align-items:center; justify-content:center; box-shadow:2px 2px 0px #171717;">
                  <span class="material-symbols-outlined" style="font-size:22px; color:#171717;">bolt</span>
                </div>
                <div>
                  <h4 style="font-size:1.1rem; font-weight:800; text-transform:uppercase; margin:0;">AI Does Everything</h4>
                  <span class="neo-badge neo-badge-sm neo-badge-primary" style="font-size:0.6rem; padding:1px 5px;">AUTONOMOUS MODE</span>
                </div>
              </div>
              <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.5rem;">
                Examia AI reads the topics and automatically decides the optimal balance of MCQs, Short Answers, Numericals, and Long Questions.
              </p>
              <div style="font-size:0.75rem; font-weight:700; color:var(--accent-secondary);">
                Recommended for fast, complete exam synthesis
              </div>
            </div>

            <!-- Option B: Custom Question Setup -->
            <div id="mode-card-custom" class="mode-select-card ${state.mode === 'custom' ? 'active' : ''}">
              <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.5rem;">
                <div style="width:38px; height:38px; border-radius:8px; background:var(--surface-low); border:2px solid #171717; display:flex; align-items:center; justify-content:center; box-shadow:2px 2px 0px #171717;">
                  <span class="material-symbols-outlined" style="font-size:22px; color:#171717;">tune</span>
                </div>
                <div>
                  <h4 style="font-size:1.1rem; font-weight:800; text-transform:uppercase; margin:0;">Custom Question Setup</h4>
                  <span class="neo-badge neo-badge-sm" style="font-size:0.6rem; padding:1px 5px;">TEACHER CONTROLLED</span>
                </div>
              </div>
              <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.5rem;">
                Specify exactly how many questions of each type (MCQ, MSQ, True/False, Short Answer, Numerical, Descriptive) and their marks.
              </p>
              <div style="font-size:0.75rem; font-weight:700; color:#171717;">
                Full control over question distribution & grading points
              </div>
            </div>
          </div>
        </div>

        <!-- MODE A CONFIGURATION VIEW (AUTONOMOUS) -->
        <div id="config-view-auto" class="neo-card" style="margin-bottom:2rem; ${state.mode === 'auto' ? 'display:block;' : 'display:none;'}">
          <div style="margin-bottom:1.25rem;">
            <label class="uppercase-label" style="display:block; margin-bottom:0.5rem;">Target Total Marks</label>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              ${[25, 50, 75, 100].map(m => `
                <button type="button" class="neo-btn neo-btn-sm btn-marks-preset ${state.targetTotalMarks === m ? 'neo-btn-primary' : 'neo-btn-white'}" data-marks="${m}">
                  ${m} Marks
                </button>
              `).join('')}
              <div style="display:inline-flex; align-items:center; gap:0.25rem; margin-left:0.5rem;">
                <input type="number" id="input-custom-target-marks" class="neo-input neo-input-sm" style="width:80px; text-align:center;" value="${state.targetTotalMarks}" min="10" max="200" />
                <span style="font-size:0.8rem; font-weight:700;">pts</span>
              </div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; margin-bottom:1.25rem;">
            <div>
              <label class="uppercase-label" style="display:block; margin-bottom:0.4rem;">Examination Duration</label>
              <select id="select-auto-duration" class="neo-select" style="width:100%;">
                <option value="30" ${state.durationMinutes === 30 ? 'selected' : ''}>30 Minutes</option>
                <option value="45" ${state.durationMinutes === 45 ? 'selected' : ''}>45 Minutes</option>
                <option value="60" ${state.durationMinutes === 60 ? 'selected' : ''}>60 Minutes (Standard)</option>
                <option value="90" ${state.durationMinutes === 90 ? 'selected' : ''}>90 Minutes</option>
                <option value="120" ${state.durationMinutes === 120 ? 'selected' : ''}>120 Minutes (2 Hours)</option>
                <option value="180" ${state.durationMinutes === 180 ? 'selected' : ''}>180 Minutes (3 Hours)</option>
              </select>
            </div>
            <div>
              <label class="uppercase-label" style="display:block; margin-bottom:0.4rem;">Academic Difficulty</label>
              <select id="select-auto-difficulty" class="neo-select" style="width:100%;">
                <option value="easy" ${state.difficulty === 'easy' ? 'selected' : ''}>Foundational / Conceptual</option>
                <option value="medium" ${state.difficulty === 'medium' ? 'selected' : ''}>Balanced (Recommended)</option>
                <option value="hard" ${state.difficulty === 'hard' ? 'selected' : ''}>Rigorous / Advanced Problem Solving</option>
              </select>
            </div>
          </div>

          <!-- Preview of Blueprint -->
          <div style="background:var(--bg-main); border:2px solid #171717; border-radius:8px; padding:1rem;">
            <div style="font-size:0.8rem; font-weight:800; text-transform:uppercase; margin-bottom:0.4rem; display:flex; justify-content:space-between;">
              <span>AI Autonomous Question Blueprint:</span>
              <span id="auto-blueprint-total-badge" class="neo-badge neo-badge-sm neo-badge-primary">~${state.targetTotalMarks} Marks</span>
            </div>
            <div id="auto-blueprint-preview" style="display:flex; flex-wrap:wrap; gap:0.5rem; font-size:0.8rem;">
              <!-- Dynamic preview items -->
            </div>
          </div>
        </div>

        <!-- MODE B CONFIGURATION VIEW (CUSTOM) -->
        <div id="config-view-custom" class="neo-card" style="margin-bottom:2rem; ${state.mode === 'custom' ? 'display:block;' : 'display:none;'}">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h4 style="font-size:1.1rem; font-weight:800; text-transform:uppercase; margin:0;">Configure Question Counts & Marks</h4>
              <p style="font-size:0.85rem; color:var(--text-muted);">Set the number of questions and marks allocated for each question type.</p>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button id="btn-quick-quiz-preset" class="neo-btn neo-btn-sm neo-btn-white" type="button">Quiz Preset</button>
              <button id="btn-midterm-preset" class="neo-btn neo-btn-sm neo-btn-white" type="button">Midterm Preset</button>
              <button id="btn-clear-counts" class="neo-btn neo-btn-sm neo-btn-white" type="button">Clear All</button>
            </div>
          </div>

          <!-- Grid of Question Types -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
            ${Object.entries(state.questionTypesConfig).map(([qType, cfg]) => `
              <div class="qtype-config-card" data-qtype="${qType}">
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
                  <span class="material-symbols-outlined" style="font-size:20px; color:#171717;">${cfg.icon}</span>
                  <strong style="font-size:0.88rem; text-transform:uppercase;">${cfg.label}</strong>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                  <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Question Count:</span>
                  <div style="display:inline-flex; align-items:center; border:2px solid #171717; border-radius:6px; background:#FFFFFF;">
                    <button type="button" class="btn-stepper btn-decrement" data-qtype="${qType}" style="border:none; background:transparent; padding:2px 8px; font-weight:bold; cursor:pointer;">-</button>
                    <input type="number" class="input-count" data-qtype="${qType}" value="${cfg.count}" min="0" max="50" style="width:38px; text-align:center; border:none; font-weight:bold; font-size:0.85rem;" />
                    <button type="button" class="btn-stepper btn-increment" data-qtype="${qType}" style="border:none; background:transparent; padding:2px 8px; font-weight:bold; cursor:pointer;">+</button>
                  </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Marks per Q:</span>
                  <div style="display:inline-flex; align-items:center; gap:0.25rem;">
                    <input type="number" step="0.5" class="neo-input neo-input-sm input-marks" data-qtype="${qType}" value="${cfg.marks}" min="0.5" max="50" style="width:58px; text-align:center; padding:2px 4px;" />
                    <span style="font-size:0.75rem; font-weight:bold;">pts</span>
                  </div>
                </div>

                <div style="margin-top:0.5rem; padding-top:0.4rem; border-top:1px dashed #171717; display:flex; justify-content:space-between; font-size:0.75rem;">
                  <span style="color:var(--text-muted);">Subtotal:</span>
                  <strong class="qtype-subtotal" data-qtype="${qType}">${(cfg.count * cfg.marks).toFixed(1)} pts</strong>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Custom Mode Duration & Difficulty -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem;">
            <div>
              <label class="uppercase-label" style="display:block; margin-bottom:0.4rem;">Exam Duration</label>
              <select id="select-custom-duration" class="neo-select" style="width:100%;">
                <option value="30">30 Minutes</option>
                <option value="45">45 Minutes</option>
                <option value="60" selected>60 Minutes</option>
                <option value="90">90 Minutes</option>
                <option value="120">120 Minutes</option>
              </select>
            </div>
            <div>
              <label class="uppercase-label" style="display:block; margin-bottom:0.4rem;">Academic Difficulty</label>
              <select id="select-custom-difficulty" class="neo-select" style="width:100%;">
                <option value="easy">Foundational</option>
                <option value="medium" selected>Balanced (Standard)</option>
                <option value="hard">Rigorous / Advanced</option>
              </select>
            </div>
          </div>
        </div>

        <!-- EXAM METADATA INPUTS & LIVE SUMMARY BAR -->
        <div class="neo-card" style="margin-bottom:2rem; background:var(--accent-primary);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
            <div>
              <span class="uppercase-label" style="font-size:0.75rem; color:#171717;">Ready to Synthesize:</span>
              <div style="display:flex; align-items:center; gap:1.25rem; margin-top:0.25rem; font-family:var(--font-heading);">
                <div>
                  <span style="font-size:0.8rem; font-weight:700; color:#171717; display:block;">QUESTIONS</span>
                  <strong style="font-size:1.6rem; color:#171717;" id="summary-total-questions">25</strong>
                </div>
                <div style="font-size:1.4rem; color:#171717;">•</div>
                <div>
                  <span style="font-size:0.8rem; font-weight:700; color:#171717; display:block;">TOTAL MARKS</span>
                  <strong style="font-size:1.6rem; color:#171717;" id="summary-total-marks">50.0 pts</strong>
                </div>
                <div style="font-size:1.4rem; color:#171717;">•</div>
                <div>
                  <span style="font-size:0.8rem; font-weight:700; color:#171717; display:block;">TIME LIMIT</span>
                  <strong style="font-size:1.6rem; color:#171717;" id="summary-duration">60 mins</strong>
                </div>
              </div>
            </div>

            <!-- Generate Button -->
            <button id="btn-generate-exam" class="neo-btn" style="background:#FFFFFF; font-size:1.05rem; padding:0.85rem 1.75rem;">
              <span class="material-symbols-outlined" style="font-size:24px; color:var(--accent-secondary);">auto_awesome</span>
              <strong>Generate Interactive Exam →</strong>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function attachAIGeneratorEvents() {
  const fileInput = document.getElementById("syllabus-file-input");
  const browseBtn = document.getElementById("btn-browse-syllabus");
  const sampleBtn = document.getElementById("btn-load-sample-syllabus");
  const dropzone = document.getElementById("syllabus-dropzone");

  // File Upload Handlers
  if (browseBtn && fileInput) {
    browseBtn.onclick = () => fileInput.click();
  }

  if (fileInput) {
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) handleFileUpload(file);
    };
  }

  if (dropzone) {
    dropzone.ondragover = (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    };
    dropzone.ondragleave = () => dropzone.classList.remove("dragover");
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    };
  }

  // Sample Syllabus Handler
  if (sampleBtn) {
    sampleBtn.onclick = () => handleSampleSyllabus();
  }

  // History Selection
  document.querySelectorAll(".btn-select-history").forEach(card => {
    card.onclick = async () => {
      const paperId = card.getAttribute("data-paper-id");
      await loadExistingAnalysis(paperId);
    };
  });

  // Re-upload Handler
  const reuploadBtn = document.getElementById("btn-reupload-syllabus");
  if (reuploadBtn) {
    reuploadBtn.onclick = () => {
      state.activeStep = 1;
      updateUI();
    };
  }

  // Mode Selection
  const modeAuto = document.getElementById("mode-card-auto");
  const modeCustom = document.getElementById("mode-card-custom");
  if (modeAuto && modeCustom) {
    modeAuto.onclick = () => {
      state.mode = "auto";
      modeAuto.classList.add("active");
      modeCustom.classList.remove("active");
      document.getElementById("config-view-auto").style.display = "block";
      document.getElementById("config-view-custom").style.display = "none";
      updateLiveSummary();
    };

    modeCustom.onclick = () => {
      state.mode = "custom";
      modeCustom.classList.add("active");
      modeAuto.classList.remove("active");
      document.getElementById("config-view-auto").style.display = "none";
      document.getElementById("config-view-custom").style.display = "block";
      updateLiveSummary();
    };
  }

  // Marks Presets for Auto Mode
  document.querySelectorAll(".btn-marks-preset").forEach(btn => {
    btn.onclick = () => {
      const marks = parseInt(btn.getAttribute("data-marks"));
      state.targetTotalMarks = marks;
      document.getElementById("input-custom-target-marks").value = marks;
      document.querySelectorAll(".btn-marks-preset").forEach(b => {
        b.className = (parseInt(b.getAttribute("data-marks")) === marks) ? "neo-btn neo-btn-sm btn-marks-preset neo-btn-primary" : "neo-btn neo-btn-sm btn-marks-preset neo-btn-white";
      });
      renderAutoBlueprintPreview();
      updateLiveSummary();
    };
  });

  const customMarksInput = document.getElementById("input-custom-target-marks");
  if (customMarksInput) {
    customMarksInput.oninput = (e) => {
      const val = parseFloat(e.target.value) || 50;
      state.targetTotalMarks = val;
      renderAutoBlueprintPreview();
      updateLiveSummary();
    };
  }

  // Duration and Difficulty
  const autoDur = document.getElementById("select-auto-duration");
  if (autoDur) {
    autoDur.onchange = (e) => {
      state.durationMinutes = parseInt(e.target.value);
      updateLiveSummary();
    };
  }

  const customDur = document.getElementById("select-custom-duration");
  if (customDur) {
    customDur.onchange = (e) => {
      state.durationMinutes = parseInt(e.target.value);
      updateLiveSummary();
    };
  }

  // Steppers and Inputs for Custom Mode
  document.querySelectorAll(".btn-increment").forEach(btn => {
    btn.onclick = () => {
      const qtype = btn.getAttribute("data-qtype");
      if (state.questionTypesConfig[qtype]) {
        state.questionTypesConfig[qtype].count += 1;
        document.querySelector(`.input-count[data-qtype="${qtype}"]`).value = state.questionTypesConfig[qtype].count;
        updateQTypeSubtotal(qtype);
        updateLiveSummary();
      }
    };
  });

  document.querySelectorAll(".btn-decrement").forEach(btn => {
    btn.onclick = () => {
      const qtype = btn.getAttribute("data-qtype");
      if (state.questionTypesConfig[qtype] && state.questionTypesConfig[qtype].count > 0) {
        state.questionTypesConfig[qtype].count -= 1;
        document.querySelector(`.input-count[data-qtype="${qtype}"]`).value = state.questionTypesConfig[qtype].count;
        updateQTypeSubtotal(qtype);
        updateLiveSummary();
      }
    };
  });

  document.querySelectorAll(".input-count").forEach(inp => {
    inp.oninput = () => {
      const qtype = inp.getAttribute("data-qtype");
      const val = Math.max(0, parseInt(inp.value) || 0);
      state.questionTypesConfig[qtype].count = val;
      updateQTypeSubtotal(qtype);
      updateLiveSummary();
    };
  });

  document.querySelectorAll(".input-marks").forEach(inp => {
    inp.oninput = () => {
      const qtype = inp.getAttribute("data-qtype");
      const val = Math.max(0.5, parseFloat(inp.value) || 1.0);
      state.questionTypesConfig[qtype].marks = val;
      updateQTypeSubtotal(qtype);
      updateLiveSummary();
    };
  });

  // Presets
  const btnQuiz = document.getElementById("btn-quick-quiz-preset");
  if (btnQuiz) {
    btnQuiz.onclick = () => applyPreset({
      mcq_single: { count: 10, marks: 1.0 },
      mcq_multiple: { count: 2, marks: 2.0 },
      true_false: { count: 5, marks: 1.0 },
      fill_blank: { count: 4, marks: 1.0 },
      short_answer: { count: 2, marks: 2.5 },
      long_answer: { count: 0, marks: 5.0 },
      numerical: { count: 0, marks: 5.0 },
      case_study: { count: 0, marks: 8.0 }
    });
  }

  const btnMidterm = document.getElementById("btn-midterm-preset");
  if (btnMidterm) {
    btnMidterm.onclick = () => applyPreset({
      mcq_single: { count: 10, marks: 1.0 },
      mcq_multiple: { count: 2, marks: 2.0 },
      true_false: { count: 4, marks: 1.0 },
      fill_blank: { count: 4, marks: 1.0 },
      short_answer: { count: 4, marks: 3.0 },
      long_answer: { count: 2, marks: 6.0 },
      numerical: { count: 1, marks: 6.0 },
      case_study: { count: 0, marks: 8.0 }
    });
  }

  const btnClear = document.getElementById("btn-clear-counts");
  if (btnClear) {
    btnClear.onclick = () => {
      Object.keys(state.questionTypesConfig).forEach(k => state.questionTypesConfig[k].count = 0);
      document.querySelectorAll(".input-count").forEach(inp => inp.value = 0);
      Object.keys(state.questionTypesConfig).forEach(k => updateQTypeSubtotal(k));
      updateLiveSummary();
    };
  }

  // Select all topics
  const btnAllTopics = document.getElementById("btn-select-all-topics");
  if (btnAllTopics) {
    btnAllTopics.onclick = () => {
      if (state.analysis && state.analysis.topics) {
        state.analysis.topics.forEach(t => state.selectedTopics.add(t.name));
        renderTopicBadges();
      }
    };
  }

  // Generate Button Handler
  const generateBtn = document.getElementById("btn-generate-exam");
  if (generateBtn) {
    generateBtn.onclick = () => handleGenerateExam();
  }

  // Initial UI Render if step 2 is active
  if (state.activeStep >= 2) {
    renderTopicBadges();
    renderAutoBlueprintPreview();
    updateLiveSummary();
  }
}

async function handleFileUpload(file) {
  showAnalyzing(true);
  try {
    const formData = new FormData();
    formData.append("file", file);

    const resp = await api.post("/generator/analyze-content", formData);
    state.paperId = resp.paper_id;
    state.filename = resp.filename;
    state.analysis = resp.analysis;
    state.subject = resp.analysis.subject || file.name.replace(/\.[^/.]+$/, "");
    state.examTitle = `${state.subject} Examination`;

    // Populate topics
    state.selectedTopics.clear();
    if (state.analysis.topics) {
      state.analysis.topics.forEach(t => state.selectedTopics.add(t.name));
    }

    // Apply suggested blueprint if available
    if (state.analysis.suggested_blueprint) {
      Object.entries(state.analysis.suggested_blueprint).forEach(([qtype, spec]) => {
        if (state.questionTypesConfig[qtype]) {
          state.questionTypesConfig[qtype].count = spec.count || 0;
          state.questionTypesConfig[qtype].marks = spec.marks_per_question || 1.0;
        }
      });
    }

    if (state.analysis.suggested_total_marks) {
      state.targetTotalMarks = state.analysis.suggested_total_marks;
    }
    if (state.analysis.suggested_duration_minutes) {
      state.durationMinutes = state.analysis.suggested_duration_minutes;
    }

    sound.playSuccess();
    showToast(`Successfully analyzed curriculum: ${state.subject}`, "success");
    state.activeStep = 2;
    updateUI();
  } catch (err) {
    sound.playError();
    showToast(`Failed to analyze document: ${err.message}`, "error");
  } finally {
    showAnalyzing(false);
  }
}

async function handleSampleSyllabus() {
  showAnalyzing(true);
  try {
    // Create text file blob
    const blob = new Blob([SAMPLE_OS_SYLLABUS], { type: "text/plain" });
    const file = new File([blob], "Operating_Systems_Syllabus.txt", { type: "text/plain" });
    await handleFileUpload(file);
  } catch (err) {
    showToast("Error loading sample syllabus: " + err.message, "error");
    showAnalyzing(false);
  }
}

async function loadExistingAnalysis(paperId) {
  showAnalyzing(true);
  try {
    const resp = await api.get(`/generator/papers/${paperId}/analysis`);
    state.paperId = paperId;
    state.filename = resp.filename;
    state.analysis = resp.analysis;
    state.subject = resp.analysis.subject || resp.filename;
    state.examTitle = `${state.subject} Examination`;

    state.selectedTopics.clear();
    if (state.analysis.topics) {
      state.analysis.topics.forEach(t => state.selectedTopics.add(t.name));
    }

    state.activeStep = 2;
    updateUI();
    sound.playSuccess();
    showToast("Loaded syllabus analysis", "success");
  } catch (err) {
    showToast("Failed to load analysis: " + err.message, "error");
  } finally {
    showAnalyzing(false);
  }
}

function showAnalyzing(show) {
  state.isAnalyzing = show;
  const analyzingSection = document.getElementById("section-analyzing");
  const step1Section = document.getElementById("section-step-1");
  const step2Section = document.getElementById("section-step-2");

  if (analyzingSection) analyzingSection.style.display = show ? "block" : "none";
  if (show) {
    if (step1Section) step1Section.style.display = "none";
    if (step2Section) step2Section.style.display = "none";
  }
}

function updateUI() {
  const step1 = document.getElementById("section-step-1");
  const step2 = document.getElementById("section-step-2");
  const subjectInput = document.getElementById("input-subject-title");
  const summaryText = document.getElementById("analysis-summary-text");

  if (step1) step1.style.display = (state.activeStep === 1) ? "block" : "none";
  if (step2) step2.style.display = (state.activeStep >= 2) ? "block" : "none";

  if (subjectInput && state.subject) {
    subjectInput.value = state.subject;
  }
  if (summaryText && state.analysis) {
    summaryText.innerText = state.analysis.summary || "";
  }

  // Update step bubbles
  document.querySelectorAll(".step-bubble").forEach((bubble, idx) => {
    if (idx + 1 <= state.activeStep) {
      bubble.classList.add("step-active");
    } else {
      bubble.classList.remove("step-active");
    }
  });

  if (state.activeStep >= 2) {
    renderTopicBadges();
    renderAutoBlueprintPreview();
    updateLiveSummary();
  }
}

function renderTopicBadges() {
  const container = document.getElementById("topics-badges-container");
  if (!container || !state.analysis || !state.analysis.topics) return;

  container.innerHTML = state.analysis.topics.map(t => {
    const isSelected = state.selectedTopics.has(t.name);
    return `
      <div class="topic-tag ${isSelected ? 'selected' : ''}" data-topic="${t.name}" style="cursor:pointer; display:inline-flex; align-items:center; gap:0.4rem; padding:4px 10px; border-radius:6px; border:2px solid #171717; font-size:0.8rem; font-weight:700; background:${isSelected ? 'var(--accent-primary)' : '#FFFFFF'}; box-shadow:${isSelected ? '2px 2px 0px #171717' : 'none'};">
        <span class="material-symbols-outlined" style="font-size:16px;">${isSelected ? 'check_box' : 'check_box_outline_blank'}</span>
        <span>${t.name}</span>
      </div>
    `;
  }).join('');

  container.querySelectorAll(".topic-tag").forEach(tag => {
    tag.onclick = () => {
      const tName = tag.getAttribute("data-topic");
      if (state.selectedTopics.has(tName)) {
        state.selectedTopics.delete(tName);
      } else {
        state.selectedTopics.add(tName);
      }
      renderTopicBadges();
    };
  });
}

function renderAutoBlueprintPreview() {
  const container = document.getElementById("auto-blueprint-preview");
  const badge = document.getElementById("auto-blueprint-total-badge");
  if (!container) return;

  const marks = state.targetTotalMarks;
  if (badge) badge.innerText = `${marks} Total Marks`;

  let previewItems = [];
  if (marks <= 25) {
    previewItems = [
      { type: "5 MCQs (1 pt)", icon: "radio_button_checked" },
      { type: "2 True/False (1 pt)", icon: "flaky" },
      { type: "3 Fill Blanks (1 pt)", icon: "edit_note" },
      { type: "3 Short Answers (3 pts)", icon: "short_text" },
      { type: "1 Numerical (6 pts)", icon: "calculate" }
    ];
  } else if (marks <= 50) {
    previewItems = [
      { type: "10 MCQs (1 pt)", icon: "radio_button_checked" },
      { type: "2 Multi-Select (2 pts)", icon: "check_box" },
      { type: "4 True/False (1 pt)", icon: "flaky" },
      { type: "4 Fill Blanks (1 pt)", icon: "edit_note" },
      { type: "4 Short Answers (3 pts)", icon: "short_text" },
      { type: "2 Long Form (5 pts)", icon: "subject" },
      { type: "1 Numerical (6 pts)", icon: "calculate" }
    ];
  } else if (marks <= 75) {
    previewItems = [
      { type: "15 MCQs (1 pt)", icon: "radio_button_checked" },
      { type: "4 Multi-Select (2 pts)", icon: "check_box" },
      { type: "5 True/False (1 pt)", icon: "flaky" },
      { type: "5 Fill Blanks (1 pt)", icon: "edit_note" },
      { type: "6 Short Answers (3 pts)", icon: "short_text" },
      { type: "3 Long Form (6 pts)", icon: "subject" },
      { type: "2 Numericals (5 pts)", icon: "calculate" }
    ];
  } else {
    previewItems = [
      { type: "20 MCQs (1 pt)", icon: "radio_button_checked" },
      { type: "5 Multi-Select (2 pts)", icon: "check_box" },
      { type: "6 True/False (1 pt)", icon: "flaky" },
      { type: "6 Fill Blanks (1 pt)", icon: "edit_note" },
      { type: "8 Short Answers (3 pts)", icon: "short_text" },
      { type: "4 Long Form (6 pts)", icon: "subject" },
      { type: "2 Numericals (5 pts)", icon: "calculate" }
    ];
  }

  container.innerHTML = previewItems.map(p => `
    <span style="display:inline-flex; align-items:center; gap:0.3rem; padding:3px 8px; background:#FFFFFF; border:1.5px solid #171717; border-radius:5px; font-weight:700;">
      <span class="material-symbols-outlined" style="font-size:14px; color:var(--accent-secondary);">${p.icon}</span>
      ${p.type}
    </span>
  `).join('');
}

function updateQTypeSubtotal(qtype) {
  const cfg = state.questionTypesConfig[qtype];
  if (!cfg) return;
  const subtotalElem = document.querySelector(`.qtype-subtotal[data-qtype="${qtype}"]`);
  if (subtotalElem) {
    subtotalElem.innerText = `${(cfg.count * cfg.marks).toFixed(1)} pts`;
  }
}

function applyPreset(preset) {
  Object.entries(preset).forEach(([qtype, spec]) => {
    if (state.questionTypesConfig[qtype]) {
      state.questionTypesConfig[qtype].count = spec.count;
      state.questionTypesConfig[qtype].marks = spec.marks;
      const countInput = document.querySelector(`.input-count[data-qtype="${qtype}"]`);
      const marksInput = document.querySelector(`.input-marks[data-qtype="${qtype}"]`);
      if (countInput) countInput.value = spec.count;
      if (marksInput) marksInput.value = spec.marks;
      updateQTypeSubtotal(qtype);
    }
  });
  updateLiveSummary();
}

function updateLiveSummary() {
  const qElem = document.getElementById("summary-total-questions");
  const mElem = document.getElementById("summary-total-marks");
  const dElem = document.getElementById("summary-duration");

  let totalQ = 0;
  let totalMarks = 0;

  if (state.mode === "auto") {
    totalMarks = state.targetTotalMarks;
    totalQ = (totalMarks <= 25) ? 14 : ((totalMarks <= 50) ? 27 : ((totalMarks <= 75) ? 40 : 51));
  } else {
    Object.values(state.questionTypesConfig).forEach(cfg => {
      totalQ += cfg.count;
      totalMarks += (cfg.count * cfg.marks);
    });
  }

  if (qElem) qElem.innerText = `${totalQ}`;
  if (mElem) mElem.innerText = `${totalMarks.toFixed(1)} pts`;
  if (dElem) dElem.innerText = `${state.durationMinutes} mins`;
}

async function handleGenerateExam() {
  const subjectInput = document.getElementById("input-subject-title");
  const subject = subjectInput ? subjectInput.value.trim() : state.subject;
  const examTitle = `${subject} Examination`;

  if (state.mode === "custom") {
    const totalQ = Object.values(state.questionTypesConfig).reduce((acc, c) => acc + c.count, 0);
    if (totalQ === 0) {
      showToast("Please select at least 1 question to synthesize the exam.", "warning");
      return;
    }
  }

  const btn = document.getElementById("btn-generate-exam");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <span class="material-symbols-outlined animate-spin" style="font-size:22px;">sync</span>
      <strong>Synthesizing Questions & Keys...</strong>
    `;
  }

  try {
    const payload = {
      paper_id: state.paperId,
      exam_title: examTitle,
      subject: subject,
      mode: state.mode,
      target_total_marks: state.targetTotalMarks,
      duration_minutes: state.durationMinutes,
      difficulty: state.difficulty,
      selected_topics: Array.from(state.selectedTopics),
      question_types_config: state.questionTypesConfig
    };

    const resp = await api.post("/generator/generate-exam", payload);
    sound.playSuccess();
    showToast(`Exam "${resp.exam.title}" created with ${resp.question_count} questions!`, "success");

    // Redirect to the exam editor where the teacher can review all solved questions & keys!
    setTimeout(() => {
      window.location.hash = `#exam-editor/${resp.exam_id}`;
    }, 600);
  } catch (err) {
    sound.playError();
    showToast(`Synthesis failed: ${err.message}`, "error");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <span class="material-symbols-outlined" style="font-size:24px; color:var(--accent-secondary);">auto_awesome</span>
        <strong>Generate Interactive Exam →</strong>
      `;
    }
  }
}
