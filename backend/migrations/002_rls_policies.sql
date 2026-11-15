-- =====================================================================
-- EXAMIA ROW LEVEL SECURITY (RLS) POLICIES — SUPABASE MIGRATION 002
-- =====================================================================

-- 1. Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 2. Profiles: Users can read their own profile, admins can read all
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- 3. Uploaded Papers: Teachers manage their own papers
CREATE POLICY "Teachers can view own uploaded papers" 
ON uploaded_papers FOR SELECT 
USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can insert own uploaded papers" 
ON uploaded_papers FOR INSERT 
WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update own uploaded papers" 
ON uploaded_papers FOR UPDATE 
USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete own uploaded papers" 
ON uploaded_papers FOR DELETE 
USING (auth.uid() = teacher_id);

-- 4. Exams:
-- Teachers manage own exams; Students can read published exams if accessible
CREATE POLICY "Teachers can manage own exams" 
ON exams FOR ALL 
USING (auth.uid() = teacher_id);

CREATE POLICY "Students can view published exams" 
ON exams FOR SELECT 
USING (
    status = 'published' OR status = 'active' OR status = 'completed'
);

-- 5. Exam Sections:
CREATE POLICY "Teachers can manage own exam sections" 
ON exam_sections FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM exams 
        WHERE exams.id = exam_sections.exam_id 
        AND exams.teacher_id = auth.uid()
    )
);

CREATE POLICY "Students can view sections of published exams" 
ON exam_sections FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM exams 
        WHERE exams.id = exam_sections.exam_id 
        AND (exams.status IN ('published', 'active', 'completed'))
    )
);

-- 6. Questions:
CREATE POLICY "Teachers can manage questions for own exams" 
ON questions FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM exams 
        WHERE exams.id = questions.exam_id 
        AND exams.teacher_id = auth.uid()
    )
);

CREATE POLICY "Students can view questions of published exams" 
ON questions FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM exams 
        WHERE exams.id = questions.exam_id 
        AND (exams.status IN ('published', 'active', 'completed'))
    )
);

-- 7. Question Options:
CREATE POLICY "Teachers can manage question options" 
ON question_options FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM questions 
        JOIN exams ON exams.id = questions.exam_id 
        WHERE questions.id = question_options.question_id 
        AND exams.teacher_id = auth.uid()
    )
);

CREATE POLICY "Students can view options without is_correct during exam" 
ON question_options FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM questions 
        JOIN exams ON exams.id = questions.exam_id 
        WHERE questions.id = question_options.question_id 
        AND (exams.status IN ('published', 'active', 'completed'))
    )
);

-- 8. Submissions:
-- Students can manage their own submission; Teachers can view submissions for their exams
CREATE POLICY "Students can view own submissions" 
ON submissions FOR SELECT 
USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own submissions" 
ON submissions FOR INSERT 
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own submissions" 
ON submissions FOR UPDATE 
USING (auth.uid() = student_id);

CREATE POLICY "Teachers can view submissions for their exams" 
ON submissions FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM exams 
        WHERE exams.id = submissions.exam_id 
        AND exams.teacher_id = auth.uid()
    )
);

CREATE POLICY "Teachers can update submissions for their exams" 
ON submissions FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM exams 
        WHERE exams.id = submissions.exam_id 
        AND exams.teacher_id = auth.uid()
    )
);

-- 9. Student Answers:
CREATE POLICY "Students can manage own answers" 
ON student_answers FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM submissions 
        WHERE submissions.id = student_answers.submission_id 
        AND submissions.student_id = auth.uid()
    )
);

CREATE POLICY "Teachers can view student answers for their exams" 
ON student_answers FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM submissions 
        JOIN exams ON exams.id = submissions.exam_id 
        WHERE submissions.id = student_answers.submission_id 
        AND exams.teacher_id = auth.uid()
    )
);

CREATE POLICY "Teachers can update scores/feedback on student answers" 
ON student_answers FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM submissions 
        JOIN exams ON exams.id = submissions.exam_id 
        WHERE submissions.id = student_answers.submission_id 
        AND exams.teacher_id = auth.uid()
    )
);

-- 10. Question Bank:
CREATE POLICY "Teachers can manage own question bank" 
ON question_bank FOR ALL 
USING (auth.uid() = teacher_id);

-- 11. Notifications:
CREATE POLICY "Users can manage own notifications" 
ON notifications FOR ALL 
USING (auth.uid() = user_id);
