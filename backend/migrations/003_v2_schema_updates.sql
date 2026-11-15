-- =====================================================================
-- EXAMIA DATABASE SCHEMA — INCREMENTAL V2 SCHEMA UPDATES
-- Run this migration if you already have the initial 001 schema applied.
-- =====================================================================

-- 1. Profiles Table Updates (Manual registration, onboarding, and unified user fields)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Relax role constraint to support unified roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('teacher', 'student', 'admin', 'user'));

-- 2. Uploaded Papers Updates (Syllabus & Material Analyzer)
ALTER TABLE uploaded_papers ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) NOT NULL DEFAULT 'question_paper';

ALTER TABLE uploaded_papers DROP CONSTRAINT IF EXISTS uploaded_papers_status_check;
ALTER TABLE uploaded_papers ADD CONSTRAINT uploaded_papers_status_check 
    CHECK (status IN ('uploaded', 'processing', 'extracted', 'analyzed', 'failed'));

-- 3. Questions Table Updates (Confidence Scoring & Subquestions)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0.95;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS subquestions JSONB;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_metadata JSONB;
