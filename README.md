# Examia — AI-Powered Online Examination Platform
> **"Your Question Paper. Now Interactive."**

Examia transforms traditional static question papers (PDF, DOCX) into interactive, automatically graded, secure online examinations using AI. It bridges teachers and students in a unified workspace with real-time analytics, instant auto-grading, AI-assisted descriptive answer evaluation, and distraction-free candidate assessment rooms.

---

## Table of Contents
1. [Product Overview](#product-overview)
2. [Design Language — Modern Neo-Brutalism](#design-language--modern-neo-brutalism)
3. [System Architecture](#system-architecture)
4. [Quick Start (Local Development)](#quick-start-local-development)
5. [Demo Sign-In & Development Accounts](#demo-sign-in--development-accounts)
6. [Credentials & Production Configuration Guide](#credentials--production-configuration-guide)
   - [1. Supabase Setup](#1-supabase-setup)
   - [2. Google OAuth 2.0 Setup](#2-google-oauth-20-setup)
   - [3. Google Gemini AI Setup](#3-google-gemini-ai-setup)
7. [Cloudflare Workers & Pages Deployment](#cloudflare-workers--pages-deployment)
8. [Running Tests & Verifications](#running-tests--verifications)
9. [Examination Lifecycle & Workflows](#examination-lifecycle--workflows)
10. [API Reference](#api-reference)
11. [Folder Structure](#folder-structure)

---

## Product Overview

Examia eliminates the hours spent by educators manually copying and formatting questions from PDFs into quiz tools. By integrating Google Gemini AI with high-precision heuristic document segmenters, Examia allows teachers to upload an existing physical or digital exam paper and immediately produce a structured, multi-section examination.

### Key Capabilities
- **Universal Question Paper Ingestion:** Drag-and-drop parsing for PDF and DOCX files.
- **Hybrid AI & Heuristic Parser:** Extracts MCQs (single & multiple select), True/False, Numerical Problems, Short Answers, and Essays with automated marks, section classification, and option detection.
- **Visual Examination Editor:** Reorder questions, edit LaTeX math formulas with real-time KaTeX rendering, update point values, configure negative marking, and define grading rubrics.
- **Secure Candidate Access:** Cryptographic invitation tokens (`exm_...`), QR codes, optional exam passcodes, and randomized question/option shuffling.
- **Restrained Neo-Brutalist Exam Room:** Distraction-free interface with server-synchronized countdown timers, autosave buffers, full-screen mode, and unvisited/flagged/answered question matrices.
- **Zero Answer Leakage:** Public examination endpoints sanitize all answer keys, correct option flags, numerical targets, and descriptive rubrics.
- **Automated & AI Grading Engine:** Instant deterministic evaluation for objective questions; Google Gemini 2.0 Flash rubric-based evaluation for subjective essays.
- **Actionable Analytics:** Score distribution histograms, question difficulty indices, student performance summaries, and one-click CSV gradebook export.

---

## Design Language — Modern Neo-Brutalism

Examia strictly adheres to a **Modern Neo-Brutalism** design system across all pages:

| Design Token | Specification | Purpose |
|---|---|---|
| **Main Background** | `#FBF9F3` | Warm, high-contrast retro paper canvas |
| **Primary Text** | `#171717` | Crisp deep charcoal/black |
| **Primary Accent** | `#E9FF55` | High-visibility Neo-Brutalist lime yellow |
| **Secondary Accent** | `#023DE5` | Bold electric cobalt blue |
| **Surfaces** | `#FFFFFF` | High-contrast white card containers |
| **Borders** | `2px - 3px solid #171717` | Structural neo-brutalist delineations |
| **Hard Shadows** | `4px 4px 0px #171717` | Tactile, unblurred offset depth |
| **Typography** | `Space Grotesk` / `Inter` / `JetBrains Mono` | Expressive headers, legible body, mono code/math |

> [!NOTE]
> The Student Examination Room utilizes a **restrained neo-brutalist aesthetic** (`#FFFFFF` clean paper card, muted accents, crisp high-contrast timer) to ensure candidate concentration and eliminate visual fatigue during timed assessments.
> Subtle audio feedback (clicks, publish chimes, submission confirmations) is powered by the Web Audio API, **disabled by default**, and controllable via the user settings toggle.

---

## System Architecture

```
                                  ┌────────────────────────┐
                                  │   Browser Frontend     │
                                  │ (Tailwind, ES Modules, │
                                  │  KaTeX, Web Audio API) │
                                  └───────────┬────────────┘
                                              │
                      REST API / JSON         │  Supabase OAuth
                    (Bearer JWT / Session)    │  (Google Sign-In)
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FastAPI Backend Service                           │
│                                                                             │
│  ┌─────────────────┐   ┌────────────────────┐   ┌────────────────────────┐  │
│  │   Auth Router   │   │  Exam & Questions  │   │  Grading & Submissions │  │
│  │ (RBAC: Teacher, │   │ (CRUD, Reordering, │   │  (Deterministic Engine │  │
│  │  Student, Admin)│   │  QR & Token Gen)   │   │  & Gemini Evaluator)   │  │
│  └────────┬────────┘   └─────────┬──────────┘   └───────────┬────────────┘  │
│           │                      │                          │               │
│  ┌────────▼──────────────────────▼──────────────────────────▼────────────┐  │
│  │                    Document Processing Pipeline                       │  │
│  │      PyMuPDF (fitz) + python-docx + Gemini 2.0 Flash Extraction       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                      SQLAlchemy 2.0 Dialect-Agnostic
                                       │
                     ┌─────────────────┴─────────────────┐
                     ▼                                   ▼
          Local Development Mode              Production Cloud Mode
          SQLite (`examia.db`)                Supabase PostgreSQL (RLS)
```

---

## Quick Start (Local Development)

Examia runs out-of-the-box in local development mode without requiring any external cloud services or API keys upfront.

### 1. Prerequisites
- Linux (Ubuntu, Debian, Linux Mint) or macOS / WSL2
- Python 3.10+
- `curl`

### 2. Automated Setup
Run the automated setup script from the project root:
```bash
./setup.sh
```
This script will:
1. Verify Python 3.10+.
2. Create an isolated virtual environment in `backend/venv`.
3. Install all backend dependencies (FastAPI, PyMuPDF, python-docx, Google GenAI SDK, Pydantic v2, Pytest).
4. Initialize the database schema (`backend/examia.db`).
5. Synthesize a 7-question multi-section physics & computing PDF exam paper (`sample_data/sample_exam.pdf`).
6. Run the automated verification test suite.

### 3. Launching Examia
Start both the backend API and frontend dev server with a single command:
```bash
./start.sh
```

### 4. Platform Endpoints
| Service | URL | Notes |
|---|---|---|
| **Landing Page** | [http://localhost:3000/index.html](http://localhost:3000/index.html) | Product landing page with live interactive preview |
| **Sign-In Portal** | [http://localhost:3000/login.html](http://localhost:3000/login.html) | Google OAuth & 1-click developer accounts |
| **Application Hub** | [http://localhost:3000/app.html](http://localhost:3000/app.html) | Teacher Dashboard, Exam Editor, Student Room |
| **Interactive API Docs**| [http://localhost:8000/docs](http://localhost:8000/docs) | OpenAPI / Swagger interactive documentation |
| **Backend Health** | [http://localhost:8000/health](http://localhost:8000/health) | System health & status check |

---

## Demo Sign-In & Development Accounts

For instant local testing without configuring Google OAuth or Supabase, use the one-click demo profiles available on the [Login Portal](http://localhost:3000/login.html):

| Role | Name | Email | Permissions |
|---|---|---|---|
| **Teacher** | Dr. Sarah Jenkins | `teacher@examia.io` | Create, upload papers, edit exams, publish, grade submissions, view analytics |
| **Student** | Alex Rivera | `student@examia.io` | Take exams, view released scorecards, answer questions |
| **Administrator** | Examia Administrator | `admin@examia.io` | Global oversight, all teacher & student privileges |

---

## Credentials & Production Configuration Guide

When ready to connect external cloud services, populate `backend/.env`.

### 1. Supabase Setup
Examia uses Supabase for production PostgreSQL database hosting, Row Level Security (RLS), and Authentication.

1. **Create Project**: Sign in to [Supabase](https://supabase.com/) and create a new project.
2. **Retrieve API Keys**: In the Supabase dashboard, navigate to **Project Settings** → **API**:
   - `Project URL`: Copy to `SUPABASE_URL` in `backend/.env`.
   - `anon public`: Copy to `SUPABASE_ANON_KEY` in `backend/.env`.
   - `service_role`: Copy to `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`.
   - `JWT Secret`: Under **Config** → **Auth**, copy the JWT Secret to `SUPABASE_JWT_SECRET` in `backend/.env`.
3. **Retrieve Database Connection String**:
   - Under **Project Settings** → **Database**, copy the URI (Mode: Transaction or Session) to `DATABASE_URL` in `backend/.env`.
   - Example: `DATABASE_URL=postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres`
4. **Run SQL Migrations**:
   In the Supabase **SQL Editor**, execute the contents of:
   - `backend/migrations/001_initial_schema.sql` (Creates normalized tables and indexes).
   - `backend/migrations/002_rls_policies.sql` (Applies Row-Level Security policies).
5. **Storage Bucket**:
   - Under **Storage**, create a new bucket named `exam-papers` (public or authenticated read).

---

### 2. Google OAuth 2.0 Setup
Examia supports Google Authentication through Supabase Auth.

1. **Google Cloud Console**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
   - Click **Create Credentials** → **OAuth client ID**.
   - Application Type: **Web application**.
   - Name: `Examia Production`.
2. **Authorized JavaScript Origins**:
   - `http://localhost:3000` (for local development)
   - `https://your-domain.com` (for production)
3. **Authorized Redirect URIs**:
   - Add your Supabase auth callback URL:
     `https://<YOUR-SUPABASE-PROJECT-REF>.supabase.co/auth/v1/callback`
   - Add your frontend callback URL:
     `http://localhost:3000/login.html` (and `https://your-domain.com/login.html`)
4. **Configure in Supabase**:
   - In Supabase Dashboard, navigate to **Authentication** → **Providers** → **Google**.
   - Toggle **Enable Google**.
   - Paste the **Client ID** and **Client Secret** obtained from Google Cloud.
5. **Configure in Examia Backend**:
   - Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `backend/.env`.

---

### 3. Google Gemini AI Setup
Examia uses Google Gemini 2.0 Flash for structured question paper extraction and automated evaluation of student descriptive answers against rubrics.

1. **Obtain Gemini API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com/).
   - Click **Get API key** and generate a key for your project.
2. **Configure in Examia**:
   - In `backend/.env`, set:
     ```env
     GEMINI_API_KEY=AIzaSy...YourKeyHere
     GEMINI_MODEL=gemini-2.0-flash
     ```
   - When `GEMINI_API_KEY` is set, question papers are extracted using structured JSON schema extraction. If empty, Examia automatically falls back to its offline regex/heuristic parsing engine.

---

## Cloudflare Workers & Pages Deployment

Examia is natively compatible with **Cloudflare Pages** and **Cloudflare Workers**:
- **Cloudflare Pages (`functions/` + `frontend`)**: Hosts the client static application while serving server-side edge API routes.
- **Cloudflare Workers (`src/worker.js` + `wrangler.toml`)**: Edge serverless execution with Web Crypto authentication and Google Gemini AI intelligence.
- **Server-Side Environment Variables & Secrets**: `GEMINI_API_KEY`, `APP_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `GOOGLE_CLIENT_SECRET` are protected on the server side via Cloudflare bindings.

### Deploying via Wrangler CLI:
```bash
# 1. Install dependencies
npm install

# 2. Test configuration
npm run test:worker

# 3. Dry-run verification
npx wrangler deploy --dry-run

# 4. Deploy live to Cloudflare
npm run deploy
```

For complete Cloudflare deployment instructions, see [CLOUDFLARE_DEPLOYMENT.md](file:///home/athul/Desktop/Project-E/CLOUDFLARE_DEPLOYMENT.md).

---

## Running Tests & Verifications

Examia comes with a comprehensive diagnostic tool, a unit test suite, and an end-to-end integration test runner.

### 1. Configuration & Connectivity Check
Run the diagnostic CLI to inspect database connectivity, Supabase config, and Gemini status:
```bash
PYTHONPATH=backend backend/venv/bin/python -m app.check_config
```

### 2. Pytest Unit Suite
Run the unit test suite covering authentication tokens, document parsing, token & QR generation, and deterministic grading logic:
```bash
backend/venv/bin/pytest -v
```

### 3. Full End-to-End Workflow Verification
Execute the 14-step end-to-end integration test simulating the entire user and candidate lifecycle:
```bash
backend/venv/bin/python test_e2e_flow.py
```
**E2E Test Steps Executed:**
1. Health check verification.
2. Teacher authentication & profile verification.
3. PDF question paper upload & AI extraction.
4. Examination generation from parsed questions.
5. Examination editor question & option updates.
6. Publishing examination, token issuance (`exm_...`) & QR code generation.
7. Public invitation validation.
8. Student candidate session start (`ses_...`) with security verification ensuring zero answer leakage.
9. Real-time candidate autosave buffer sync.
10. Exam submission and automated deterministic grading.
11. Gemini AI descriptive rubric evaluation.
12. Official results release by teacher.
13. Student detailed scorecard & breakdown view.
14. Teacher aggregate analytics & CSV export.

---

## Examination Lifecycle & Workflows

### Teacher Workflow
1. **Upload Paper**: Upload PDF/DOCX via the Question Papers library. The document is segmented into sections and questions.
2. **Review & Refine**: In the Examination Editor, adjust question wording, reorder items, preview KaTeX math formulas, specify correct answers, set partial credit for multi-select MCQs, and configure negative marking.
3. **Configure Rules**: Set time limit, passing percentage, shuffle questions/options, and choose results visibility mode (`Immediate`, `After Exam Closes`, or `Manual Teacher Release`).
4. **Publish & Share**: Publishing locks the draft and generates an invitation token, a direct link, and a downloadable high-resolution QR code with ready-made WhatsApp and Email templates.
5. **Monitor & Grade**: View live submissions, invoke Gemini AI evaluation for subjective answers, adjust marks manually, and add teacher feedback.
6. **Release & Analyze**: Release scores to students with a single click and review score distributions, question difficulty metrics, and export CSVs.

### Student Workflow
1. **Join**: Follow invitation link or scan QR code. Enter name and optional passcode.
2. **Examination Room**: Clean paper-style card layout, server-synchronized countdown timer, question palette showing answered/unvisited/flagged states.
3. **Autosave**: Every choice and essay draft is debounced and synchronized with the backend.
4. **Submit & Review**: Confirm submission and view final score and question review according to teacher release policy.

---

## API Reference

Comprehensive Swagger documentation is accessible at `http://localhost:8000/docs`. Key routes include:

| Method | Endpoint | Description | Role / Auth |
|---|---|---|---|
| `GET` | `/health` | Service health status | Public |
| `GET` | `/api/v1/auth/public-config` | Public client config for Supabase | Public |
| `POST` | `/api/v1/auth/demo-login` | 1-click dev login | Public |
| `POST` | `/api/v1/auth/callback` | Supabase OAuth callback | Public |
| `GET` | `/api/v1/auth/me` | Current authenticated profile | Bearer Token |
| `POST` | `/api/v1/papers/upload` | Upload PDF/DOCX paper | Teacher |
| `POST` | `/api/v1/papers/{id}/generate-exam` | Generate exam from paper | Teacher |
| `GET` | `/api/v1/exams` | List teacher's exams | Teacher |
| `POST` | `/api/v1/exams/{id}/publish` | Publish exam & generate QR | Teacher |
| `GET` | `/api/v1/exams/public/{token}` | Public exam info (Sanitized) | Public |
| `POST` | `/api/v1/submissions/start` | Start student candidate session | Public / Candidate |
| `POST` | `/api/v1/submissions/autosave` | Autosave candidate answer | Candidate Session |
| `POST` | `/api/v1/submissions/submit` | Submit exam & trigger auto-grading | Candidate Session |
| `GET` | `/api/v1/results/session/{token}` | View candidate scorecard | Candidate Session |
| `POST` | `/api/v1/grading/evaluate-descriptive` | Trigger Gemini AI evaluation | Teacher |
| `POST` | `/api/v1/grading/exams/{id}/release-results` | Release results to candidates | Teacher |
| `GET` | `/api/v1/analytics/exams/{id}` | Examination analytics & breakdown | Teacher |
| `GET` | `/api/v1/analytics/exams/{id}/export-csv` | Export gradebook to CSV | Teacher |

---

## Folder Structure

```
Project-E/
├── backend/
│   ├── app/
│   │   ├── auth/              # JWT handler, RBAC dependencies
│   │   ├── models/            # SQLAlchemy models (User, Exam, Question, Submission, etc.)
│   │   ├── routers/           # Versioned REST API routers
│   │   ├── schemas/           # Pydantic v2 validation schemas
│   │   ├── services/          # DocumentProcessor, GeminiService, GradingService, ExamService
│   │   ├── config.py          # Pydantic settings & environment management
│   │   ├── database.py        # SQLAlchemy engine, session maker, SQLite/Postgres helpers
│   │   └── main.py            # FastAPI main app, CORS, static routes, exceptions
│   ├── migrations/            # Production SQL DDL & Supabase RLS policies
│   ├── tests/                 # Pytest automated test suite
│   ├── check_config.py        # CLI diagnostic tool
│   ├── Dockerfile             # Container definition for backend
│   ├── requirements.txt       # Python dependencies
│   └── .env.example           # Backend environment template
├── frontend/
│   ├── assets/                # Logos, icons, sound cues
│   ├── css/                   # Modern Neo-Brutalism styles (variables, components, animations)
│   ├── js/
│   │   ├── components/        # Sidebar, Modal, QRModal, KaTeX helper
│   │   ├── pages/             # Dashboard, Editor, ExamRoom, Submissions, Analytics, Bank
│   │   ├── api.js             # Fetch wrapper with Bearer token authentication
│   │   ├── auth.js            # Auth manager (Supabase OAuth & 1-click demo login)
│   │   ├── config.js          # Runtime frontend config
│   │   ├── router.js          # Client-side hash router
│   │   └── sound.js           # Web Audio API sound effects synthesizer
│   ├── app.html               # Main Single-Page Application container
│   ├── index.html             # Neo-Brutalist landing page
│   ├── login.html             # Authentication portal
│   └── .env.example           # Frontend environment template
├── sample_data/               # Sample synthesized exam papers for testing
├── docker-compose.yml         # Multi-container orchestration (Backend + Frontend)
├── setup.sh                   # One-command installation & test runner
├── start.sh                   # Application launcher script
├── test_e2e_flow.py           # 14-step integration test runner
└── README.md                  # Master documentation
```

---

## License
MIT License. Built with passion for educators and students.
