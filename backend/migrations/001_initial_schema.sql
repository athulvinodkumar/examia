-- =====================================================================
-- EXAMIA DATABASE SCHEMA — SUPABASE POSTGRESQL MIGRATION 001
-- =====================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES TABLE
-- Connected to Supabase auth.users or standalone UUIDs
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'student' CHECK (role IN ('teacher', 'student', 'admin', 'user')),
    school_organization VARCHAR(255),
    department VARCHAR(100),
    phone VARCHAR(50),
    is_onboarded BOOLEAN NOT NULL DEFAULT FALSE,
    preferences JSONB DEFAULT '{"sound_enabled": false, "dark_mode": false, "email_notifications": true}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 2. UPLOADED PAPERS (Document Library)
CREATE TABLE IF NOT EXISTS uploaded_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_path TEXT NOT NULL,
    document_type VARCHAR(50) NOT NULL DEFAULT 'question_paper',
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'extracted', 'analyzed', 'failed')),
    extracted_data JSONB,
    extracted_question_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_papers_teacher ON uploaded_papers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_papers_status ON uploaded_papers(status);

-- 3. EXAMS TABLE
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    paper_id UUID REFERENCES uploaded_papers(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    subject VARCHAR(100),
    class_group VARCHAR(100),
    instructions TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'processing', 'ready_for_review', 'published', 'scheduled', 'active', 'completed', 'archived', 'failed')
    ),
    total_marks DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    invitation_token VARCHAR(64) UNIQUE,
    passcode VARCHAR(100),
    access_policy VARCHAR(50) NOT NULL DEFAULT 'public_link' CHECK (
        access_policy IN ('public_link', 'passcode', 'restricted', 'invitation_only')
    ),
    max_attempts INTEGER NOT NULL DEFAULT 1,
    late_submission_policy VARCHAR(50) NOT NULL DEFAULT 'disallow' CHECK (
        late_submission_policy IN ('disallow', 'allow_with_flag', 'penalty')
    ),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE,
    shuffle_options BOOLEAN NOT NULL DEFAULT FALSE,
    allow_navigation BOOLEAN NOT NULL DEFAULT TRUE,
    show_marks_per_question BOOLEAN NOT NULL DEFAULT TRUE,
    negative_marking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    partial_marking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    grading_mode VARCHAR(50) NOT NULL DEFAULT 'automatic' CHECK (
        grading_mode IN ('automatic', 'manual', 'ai_assisted')
    ),
    numerical_tolerance DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    result_visibility VARCHAR(50) NOT NULL DEFAULT 'immediate' CHECK (
        result_visibility IN ('immediate', 'manual', 'scheduled')
    ),
    result_release_time TIMESTAMPTZ,
    show_correct_answers BOOLEAN NOT NULL DEFAULT TRUE,
    show_explanations BOOLEAN NOT NULL DEFAULT TRUE,
    show_question_marks BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exams_teacher ON exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);
CREATE INDEX IF NOT EXISTS idx_exams_invitation_token ON exams(invitation_token);

-- 4. EXAM SECTIONS
CREATE TABLE IF NOT EXISTS exam_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_sections_exam ON exam_sections(exam_id);

-- 5. QUESTIONS
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    section_id UUID REFERENCES exam_sections(id) ON DELETE SET NULL,
    question_number INTEGER NOT NULL DEFAULT 1,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL CHECK (
        question_type IN ('mcq_single', 'mcq_multiple', 'true_false', 'numerical', 'short_answer', 'descriptive', 'fill_blank')
    ),
    marks DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    negative_marks DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    numerical_expected DOUBLE PRECISION,
    numerical_tolerance DOUBLE PRECISION DEFAULT 0.0,
    accepted_answers JSONB,
    descriptive_rubric TEXT,
    sample_solution TEXT,
    explanation TEXT,
    image_url TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    subquestions JSONB,
    source_metadata JSONB,
    review_status VARCHAR(50) NOT NULL DEFAULT 'needs_review' CHECK (
        review_status IN ('needs_review', 'verified')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_section ON questions(section_id);

-- 6. QUESTION OPTIONS (for MCQs and multiple-choice)
CREATE TABLE IF NOT EXISTS question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_label VARCHAR(10) NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_question_options_question ON question_options(question_id);

-- 7. SUBMISSIONS
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_token VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress' CHECK (
        status IN ('in_progress', 'submitted', 'graded', 'pending_review')
    ),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    score_obtained DOUBLE PRECISION,
    total_possible DOUBLE PRECISION,
    percentage DOUBLE PRECISION,
    passed BOOLEAN,
    feedback TEXT,
    results_released BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_exam ON submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_session ON submissions(session_token);

-- 8. STUDENT ANSWERS
CREATE TABLE IF NOT EXISTS student_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    selected_option_ids JSONB,
    text_answer TEXT,
    numerical_answer DOUBLE PRECISION,
    is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    score_awarded DOUBLE PRECISION,
    is_evaluated BOOLEAN NOT NULL DEFAULT FALSE,
    evaluation_notes TEXT,
    ai_suggested_score DOUBLE PRECISION,
    ai_feedback TEXT,
    last_saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence_number INTEGER NOT NULL DEFAULT 1,
    UNIQUE(submission_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_student_answers_submission ON student_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_question ON student_answers(question_id);

-- 9. QUESTION BANK
CREATE TABLE IF NOT EXISTS question_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject VARCHAR(100),
    topic VARCHAR(100),
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    options JSONB,
    correct_answer JSONB,
    marks DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_bank_teacher ON question_bank(teacher_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_subject ON question_bank(subject);

-- 10. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'system',
    action_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
