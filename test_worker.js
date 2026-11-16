/**
 * Automated test suite for Examia Cloudflare Worker Edge Engine
 */

import fs from "fs";
import { handleRequest } from "./src/worker.js";

const mockEnv = {
  APP_ENV: "development",
  APP_SECRET_KEY: "test_secret_for_cloudflare_worker_12345",
  GEMINI_API_KEY: "test_dummy_key",
  GEMINI_MODEL: "gemini-2.0-flash",
  PUBLIC_DOMAIN: "https://examia.athulvinodkumar08.workers.dev",
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_ANON_KEY: "sb_anon_test_key",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_service_role_test",
  GOOGLE_CLIENT_ID: "test_google_client_id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test_google_secret"
};

async function testWorker() {
  console.log("============================================================");
  console.log(" EXAMIA CLOUDFLARE WORKER EDGE API VERIFICATION TEST SUITE");
  console.log("============================================================\n");

  let passed = 0;
  let total = 0;

  async function assertReq(desc, method, path, body = null, headers = {}, expectStatus = 200, checkFn = null) {
    total++;
    process.stdout.write(`[${total}] Testing ${desc}... `);
    try {
      const reqHeaders = new Headers(headers);
      if (body && !reqHeaders.has("Content-Type")) {
        reqHeaders.set("Content-Type", "application/json");
      }
      const req = new Request(`https://examia.athulvinodkumar08.workers.dev${path}`, {
        method,
        headers: reqHeaders,
        body: body ? JSON.stringify(body) : undefined
      });

      const res = await handleRequest(req, mockEnv, {});
      if (res.status !== expectStatus) {
        throw new Error(`Expected status ${expectStatus}, got ${res.status}`);
      }

      const data = await res.json().catch(() => ({}));
      if (checkFn) {
        checkFn(data);
      }
      passed++;
      console.log("✓ PASSED");
      return data;
    } catch (err) {
      console.log(`✗ FAILED: ${err.message}`);
      throw err;
    }
  }

  // 1. Health check
  await assertReq("Health Endpoint", "GET", "/api/v1/health", null, {}, 200, (d) => {
    if (d.status !== "healthy") throw new Error("Unhealthy status");
    if (!d.runtime.includes("Cloudflare")) throw new Error("Invalid runtime signature");
  });

  // 2. Public config (Security check: NO SECRETS LEAKED!)
  await assertReq("Public Config Security Check", "GET", "/api/v1/auth/public-config", null, {}, 200, (d) => {
    if (d.supabase_url !== mockEnv.SUPABASE_URL) throw new Error("Missing public supabase url");
    if (d.google_client_id !== mockEnv.GOOGLE_CLIENT_ID) throw new Error("Missing public google client id");
    // Verify sensitive secrets are NOT leaked:
    if (d.gemini_api_key || d.GEMINI_API_KEY) throw new Error("LEAK DETECTED: GEMINI_API_KEY exposed in public config!");
    if (d.supabase_service_role_key || d.SUPABASE_SERVICE_ROLE_KEY) throw new Error("LEAK DETECTED: Service role key exposed!");
    if (d.google_client_secret || d.GOOGLE_CLIENT_SECRET) throw new Error("LEAK DETECTED: Google OAuth secret exposed!");
    if (d.app_secret_key || d.APP_SECRET_KEY) throw new Error("LEAK DETECTED: App secret key exposed!");
  });

  // 3. Demo login
  let teacherToken = "";
  const loginRes = await assertReq("Demo Login (Teacher)", "POST", "/api/v1/auth/demo-login", {
    email: "teacher@examia.io",
    role: "teacher"
  }, {}, 200, (d) => {
    if (!d.access_token) throw new Error("Missing access_token");
    if (d.user.email !== "teacher@examia.io") throw new Error("Invalid user");
  });
  teacherToken = loginRes.access_token;

  // 4. Auth Me with Token
  await assertReq("Session Validation (/auth/me)", "GET", "/api/v1/auth/me", null, {
    "Authorization": `Bearer ${teacherToken}`
  }, 200, (d) => {
    if (d.user.email !== "teacher@examia.io") throw new Error("Invalid session profile");
  });

  // 5. Username check
  await assertReq("Check Username Availability", "GET", "/api/v1/auth/check-username?username=dr_jenkins", null, {}, 200, (d) => {
    if (d.available !== false) throw new Error("Should report taken username as unavailable");
  });

  // 6. Manual Registration & Login
  const testRegEmail = `test_edge_${Date.now()}@examia.io`;
  const regRes = await assertReq("Manual Account Registration", "POST", "/api/v1/auth/register", {
    email: testRegEmail,
    password: "Password123!",
    username: `edge_user_${Date.now().toString().slice(-4)}`,
    full_name: "Edge Tester"
  }, {}, 200, (d) => {
    if (!d.access_token) throw new Error("Missing registration token");
  });

  await assertReq("Manual Account Login", "POST", "/api/v1/auth/login", {
    login: testRegEmail,
    password: "Password123!"
  }, {}, 200, (d) => {
    if (!d.access_token) throw new Error("Missing login token");
  });

  // 7. List Exams
  await assertReq("List Exams", "GET", "/api/v1/exams", null, {}, 200, (d) => {
    if (!Array.isArray(d) && !Array.isArray(d.exams)) throw new Error("Exams should be an array");
  });

  // 8. Create Exam
  const examRes = await assertReq("Create Exam", "POST", "/api/v1/exams", {
    title: "Cloudflare Edge Test Examination",
    subject: "Distributed Systems",
    duration_minutes: 60
  }, {
    "Authorization": `Bearer ${teacherToken}`
  }, 201, (d) => {
    if (!d.id) throw new Error("Missing exam id");
  });

  // 8b. Get Exam Details For Editor
  await assertReq("Get Exam Details For Editor", "GET", `/api/v1/exams/${examRes.id}`, null, {
    "Authorization": `Bearer ${teacherToken}`
  }, 200, (d) => {
    if (!d.exam || !Array.isArray(d.exam.questions)) throw new Error("Missing exam.questions in response");
    if (d.exam.id !== examRes.id) throw new Error("Exam ID mismatch");
  });

  // 8c. Add Question To Exam
  const addQRes = await assertReq("Add Question To Exam", "POST", `/api/v1/exams/${examRes.id}/questions`, {
    question_text: "What protocol operates at Layer 3 of OSI model?",
    question_type: "mcq_single",
    marks: 2,
    options: [
      { option_label: "A", option_text: "IP", is_correct: true },
      { option_label: "B", option_text: "TCP", is_correct: false }
    ]
  }, {
    "Authorization": `Bearer ${teacherToken}`
  }, 201, (d) => {
    if (!d.question || !d.question.id) throw new Error("Question was not created");
  });

  // 8d. Update Question
  await assertReq("Update Question Details", "PUT", `/api/v1/questions/${addQRes.question.id}`, {
    marks: 3,
    explanation: "Internet Protocol operates at Network Layer."
  }, {
    "Authorization": `Bearer ${teacherToken}`
  }, 200, (d) => {
    if (d.question.marks !== 3) throw new Error("Question marks were not updated");
  });

  // 9. Publish Exam
  const pubRes = await assertReq("Publish Exam & Generate Invite Token", "POST", `/api/v1/exams/${examRes.id}/publish`, {}, {
    "Authorization": `Bearer ${teacherToken}`
  }, 200, (d) => {
    if (!d.invitation_token) throw new Error("Missing invitation token");
    if (!d.invitation_url || !d.invitation_url.startsWith("https://examia.athulvinodkumar08.workers.dev")) {
      throw new Error(`Invitation URL should use caller origin, got: ${d.invitation_url}`);
    }
  });

  await assertReq("Retrieve Exam Sharing Details", "GET", `/api/v1/exams/${examRes.id}/sharing`, null, {
    "Authorization": `Bearer ${teacherToken}`
  }, 200, (d) => {
    if (!d.sharing || !d.sharing.invitation_url.startsWith("https://examia.athulvinodkumar08.workers.dev")) {
      throw new Error(`Sharing payload should use caller origin, got: ${d.sharing?.invitation_url}`);
    }
  });

  // 10. Public Exam Candidate View (Security check: NO LEAKED ANSWERS)
  await assertReq("Public Candidate View (Secure)", "GET", `/api/v1/exams/public/${pubRes.invitation_token}`, null, {}, 200, (d) => {
    if (!d.questions) throw new Error("Questions missing");
    for (const q of d.questions) {
      if (q.options) {
        for (const opt of q.options) {
          if (opt.is_correct !== undefined) {
            throw new Error("SECURITY LEAK: is_correct found in candidate public view!");
          }
        }
      }
    }
  });

  // 11. Start Exam Session with Invitation Token & Authenticated Profile
  const subRes = await assertReq("Start Candidate Submission via Invitation Token", "POST", "/api/v1/submissions/start", {
    invitation_token: "exm_cf_demo_token_12345",
    student_name: "Alice Tester",
    student_email: "alice@student.io"
  }, {}, 201, (d) => {
    if (!d.session_token) throw new Error("Missing session_token");
    if (d.status !== "in_progress") throw new Error(`Expected status 'in_progress', got '${d.status}'`);
    if (!d.remaining_seconds || d.remaining_seconds <= 0) throw new Error("Invalid remaining_seconds");
    if (!d.exam_title) throw new Error("Missing exam_title");
    if (!Array.isArray(d.questions) || d.questions.length === 0) throw new Error("Missing questions array");
  });

  // 11b. Verify Ongoing Exam Session via GET /submissions/:sessionToken
  await assertReq("Fetch Ongoing Exam Session Details", "GET", `/api/v1/submissions/${subRes.session_token}`, null, {}, 200, (d) => {
    if (d.status !== "in_progress") throw new Error(`Expected status 'in_progress', got '${d.status}'`);
    if (!d.remaining_seconds || d.remaining_seconds <= 0) throw new Error("Invalid remaining_seconds");
    if (!d.exam_title) throw new Error("Missing exam_title");
    if (!Array.isArray(d.questions) || d.questions.length === 0) throw new Error("Missing questions array");
  });

  // 12. Save Answer
  await assertReq("Save Student Answer", "POST", `/api/v1/submissions/${subRes.session_token}/save-answer`, {
    question_id: "q_demo_01",
    selected_option_id: "opt_2", // Farad (Correct!)
    selected_option_ids: ["opt_2"],
    text_answer: ""
  }, {}, 200);

  // 13. Submit & Auto-Grade
  await assertReq("Submit Exam & Automatic Edge Grading", "POST", `/api/v1/submissions/${subRes.session_token}/submit`, {}, {}, 200, (d) => {
    if (d.status !== "completed") throw new Error("Submission not marked completed");
    if (d.total_score <= 0) throw new Error("Grading failed: score should be > 0");
    if (d.results_released !== true) throw new Error("Results should be released");
  });

  // 13b. Fetch Detailed Scorecard Report
  await assertReq("Fetch Detailed Scorecard Report", "GET", `/api/v1/results/submissions/${subRes.submission_id}`, null, {}, 200, (d) => {
    if (d.status !== "success") throw new Error("Status should be success");
    if (!d.exam_title) throw new Error("Missing exam_title in scorecard");
    if (!d.student_name) throw new Error("Missing student_name in scorecard");
    if (typeof d.score_obtained !== "number") throw new Error("Missing score_obtained");
    if (typeof d.total_possible !== "number") throw new Error("Missing total_possible");
    if (typeof d.percentage !== "number") throw new Error("Missing percentage");
    if (typeof d.passed !== "boolean") throw new Error("Missing passed");
    if (typeof d.time_spent_seconds !== "number" || isNaN(d.time_spent_seconds)) throw new Error("Invalid time_spent_seconds");
    if (!Array.isArray(d.questions) || d.questions.length === 0) throw new Error("Questions list must not be empty");
    if (d.questions[0].score_awarded === undefined) throw new Error("Missing score_awarded in question");
  });

  // 13c. Resilient Scorecard for sub_wtc96819
  await assertReq("Resilient Scorecard for sub_wtc96819", "GET", "/api/v1/results/submissions/sub_wtc96819", null, {}, 200, (d) => {
    if (d.status !== "success") throw new Error("Status should be success");
    if (!d.exam_title || !d.student_name) throw new Error("Missing exam/student metadata");
    if (typeof d.score_obtained !== "number" || isNaN(d.score_obtained)) throw new Error("Invalid score_obtained");
    if (!Array.isArray(d.questions) || d.questions.length === 0) throw new Error("Questions should be populated");
  });

  // 14. Teacher Overview Analytics
  await assertReq("Teacher Analytics Overview", "GET", "/api/v1/analytics/teacher-overview", null, {
    "Authorization": `Bearer ${teacherToken}`
  }, 200, (d) => {
    if (d.total_exams === undefined) throw new Error("Missing analytics stats");
  });

  // 15. AI Syllabus Content Analysis
  const analysisRes = await assertReq("AI Syllabus & Content Analysis", "POST", "/api/v1/generator/analyze-content", {
    content_text: "Quantum Computing Principles: Superposition, Entanglement, Qubits, Quantum Gates, Shor Algorithm.",
    filename: "quantum_syllabus.txt"
  }, {
    "Authorization": `Bearer ${teacherToken}`
  }, 200, (d) => {
    if (!d.analysis) throw new Error("Missing analysis object");
    if (!Array.isArray(d.analysis.topics)) throw new Error("Topics should be an array");
  });

  // 16. AI Exam Generator
  await assertReq("AI Exam Synthesis & Generation", "POST", "/api/v1/generator/generate-exam", {
    paper_id: analysisRes.paper_id,
    title: "Quantum Computing Midterm Exam",
    duration_minutes: 60,
    total_marks: 20
  }, {
    "Authorization": `Bearer ${teacherToken}`
  }, 200, (d) => {
    if (!d.exam_id) throw new Error("Missing exam_id");
    if (!Array.isArray(d.questions) || d.questions.length === 0) throw new Error("Questions not generated");
  });

  // 17. Paper Upload with PDF / Form Data
  const realPdfBytes = fs.readFileSync("uploads/0a4d9828-8920-4f31-8559-b3a3f5ca9889_Examia_Test_Question_Paper.pdf");
  const formData = new FormData();
  const file = new File([realPdfBytes], "Examia_Test_Question_Paper.pdf", { type: "application/pdf" });
  formData.append("file", file);
  formData.append("auto_solve", "true");

  total++;
  process.stdout.write(`[${total}] Testing Paper Upload & Question Extraction... `);
  const uploadReq = new Request("https://examia.athulvinodkumar08.workers.dev/api/v1/papers/upload?auto_solve=true", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${teacherToken}`
    },
    body: formData
  });
  const uploadRes = await handleRequest(uploadReq, mockEnv, {});
  if (uploadRes.status !== 201) {
    const errText = await uploadRes.text();
    throw new Error(`Expected status 201, got ${uploadRes.status}: ${errText}`);
  }
  const uploadData = await uploadRes.json();
  if (!uploadData.paper || !uploadData.paper.id) throw new Error("Missing uploaded paper");
  if (!Array.isArray(uploadData.extracted_questions) || uploadData.extracted_questions.length === 0) {
    throw new Error("No questions extracted");
  }
  const paperId = uploadData.paper.id;
  passed++;
  console.log("✓ PASSED");

  // 18. List Papers
  await assertReq("List Uploaded Papers", "GET", "/api/v1/papers", null, {
    "Authorization": `Bearer ${teacherToken}`
  }, 200, (d) => {
    if (!Array.isArray(d.papers) || d.papers.length === 0) throw new Error("Papers array empty");
  });

  // 19. Get Paper By ID
  await assertReq("Get Paper Details By ID", "GET", `/api/v1/papers/${paperId}`, null, {
    "Authorization": `Bearer ${teacherToken}`
  }, 200, (d) => {
    if (!d.paper || d.paper.id !== paperId) throw new Error("Paper ID mismatch");
  });

  // 20. Update Verified Questions
  const updatedQuestions = [...uploadData.extracted_questions];
  updatedQuestions[0].sample_solution = "Teacher verified manual solution update.";
  await assertReq("Update Verified Questions", "PUT", `/api/v1/papers/${paperId}/update-questions`, {
    questions: updatedQuestions
  }, {
    "Authorization": `Bearer ${teacherToken}`
  }, 200, (d) => {
    if (!d.teacher_verified) throw new Error("Teacher verified flag not set");
  });

  // 21. Create Exam from Paper
  await assertReq("Create Interactive Exam from Paper", "POST", `/api/v1/papers/${paperId}/create-exam`, {}, {
    "Authorization": `Bearer ${teacherToken}`
  }, 201, (d) => {
    if (!d.exam_id) throw new Error("Missing exam_id");
    if (!d.exam || !Array.isArray(d.exam.questions) || d.exam.questions.length === 0) {
      throw new Error("Created exam missing questions");
    }
  });

  // 22. Delete Paper
  await assertReq("Delete Paper", "DELETE", `/api/v1/papers/${paperId}`, null, {
    "Authorization": `Bearer ${teacherToken}`
  }, 200, (d) => {
    if (d.status !== "success") throw new Error("Failed deleting paper");
  });

  console.log("\n============================================================");
  console.log(` ALL ${passed}/${total} CLOUDFLARE WORKER TESTS PASSED WITH 100% SUCCESS!`);
  console.log("============================================================\n");
}

testWorker().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
