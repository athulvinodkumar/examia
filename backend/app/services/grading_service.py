import re
import difflib
from typing import Dict, Any, List, Optional, Tuple
from app.models.question import Question, QuestionOption
from app.models.submission import Submission, StudentAnswer
from app.models.exam import Exam

# Standard content filtering stopwords
STOPWORDS = {
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about',
    'into', 'over', 'after', 'and', 'or', 'but', 'if', 'so', 'as', 'that',
    'this', 'it', 'its', 'itself', 'they', 'them', 'their', 'we', 'us',
    'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'can', 'could',
    'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'do', 'does', 'did'
}

class GradingService:
    @staticmethod
    def normalize_text(text: Optional[str]) -> str:
        """Removes excess whitespace, normalizes punctuation and converts to lowercase"""
        if not text:
            return ""
        # Convert punctuation to spaces, lowercase, collapse whitespace
        cleaned = re.sub(r'[^\w\s]', ' ', text.lower())
        return re.sub(r'\s+', ' ', cleaned).strip()

    @staticmethod
    def stem_word(word: str) -> str:
        """Lightweight morphological stemmer for common English suffixes"""
        w = word.lower().strip()
        w = re.sub(r'(ing|edly|edly|ed|es|s|ly|tion|ment|able|ibility)$', '', w)
        return w

    @classmethod
    def extract_keywords(cls, text: str) -> List[str]:
        """Extracts significant content keywords excluding common grammatical stopwords"""
        words = re.findall(r'\b[a-z0-9_]{2,}\b', text.lower())
        return [w for w in words if w not in STOPWORDS]

    @classmethod
    def compute_text_closeness(
        cls,
        student_text: str,
        reference_texts: List[str],
        rubric: Optional[str] = None
    ) -> Tuple[float, str]:
        """
        Calculates closeness between student's manually entered answer and original reference answers.
        Returns a tuple: (closeness_ratio: float between 0.0 and 1.0, match_reason: str).
        
        Evaluation considers:
        1. Exact string match (1.0)
        2. Sequence similarity / typo tolerance (Levenshtein / SequenceMatcher ratio)
        3. Substring containment (student answer inside reference, or reference embedded in sentence)
        4. Conceptual keyword & term overlap (stemmed recall and precision)
        """
        if not student_text or not student_text.strip():
            return 0.0, "Blank answer"

        s_norm = cls.normalize_text(student_text)
        s_keywords = cls.extract_keywords(student_text)
        s_stem_set = set(cls.stem_word(w) for w in s_keywords)

        if not s_norm:
            return 0.0, "No content provided"

        best_closeness = 0.0
        best_reason = "No significant match"

        # Expand references with rubric keywords if available
        all_refs = [r for r in reference_texts if r and r.strip()]

        for ref in all_refs:
            r_norm = cls.normalize_text(ref)
            if not r_norm:
                continue

            # 1. Exact normalized match -> 100% closeness
            if s_norm == r_norm:
                return 1.0, "Exact match with original answer"

            # 2. Substring & Embedded Target Match
            sub_score = 0.0
            if r_norm in s_norm:
                # Student included the full target answer within their response
                extra_chars = len(s_norm) - len(r_norm)
                sub_score = max(0.92, 1.0 - 0.005 * extra_chars)
            elif s_norm in r_norm and len(s_norm) >= 3:
                # Student provided a valid subphrase of target answer
                sub_score = min(0.90, (len(s_norm) / len(r_norm)) * 0.95)

            # 3. Fuzzy Sequence Similarity (Typo tolerance & minor grammatical changes)
            seq_ratio = difflib.SequenceMatcher(None, s_norm, r_norm).ratio()
            if seq_ratio >= 0.88:
                seq_score = 1.0  # Minor spelling error or typo treated with full credit
            elif seq_ratio >= 0.70:
                seq_score = seq_ratio
            elif seq_ratio >= 0.60:
                seq_score = seq_ratio * 0.5
            else:
                seq_score = 0.0  # Random character baseline in English is ~0.25-0.35

            # 4. Keyword & Concept Overlap
            r_keywords = cls.extract_keywords(ref)
            token_score = 0.0

            if r_keywords:
                matched_count = 0
                for rk in r_keywords:
                    rk_stem = cls.stem_word(rk)
                    if rk in s_keywords or rk_stem in s_stem_set:
                        matched_count += 1
                    elif any(difflib.SequenceMatcher(None, rk, sk).ratio() >= 0.78 for sk in s_keywords):
                        matched_count += 1
                    elif len(rk) >= 3 and any(sk.startswith(rk[:3]) or rk.startswith(sk[:3]) for sk in s_keywords if len(sk) >= 3):
                        matched_count += 1

                if matched_count == 0 and seq_ratio < 0.70:
                    token_score = 0.0
                else:
                    recall = matched_count / len(r_keywords)
                    precision = (matched_count / len(s_keywords)) if s_keywords else 0.0
                    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

                    # Scale recall: in descriptive responses, capturing >= 70% of core concepts signifies high mastery
                    if recall >= 0.70:
                        token_score = min(1.0, 0.85 + (recall - 0.70) * 0.5)
                    elif recall >= 0.50:
                        token_score = 0.65 + (recall - 0.50) * 0.95
                    elif recall >= 0.25:
                        token_score = 0.30 + (recall - 0.25) * 1.4
                    elif recall >= 0.15:
                        token_score = 0.15 + (recall - 0.15) * 1.5
                    else:
                        token_score = 0.0

            # If zero keywords matched and sequence similarity is low, treat as zero
            if r_keywords and matched_count == 0 and seq_ratio < 0.70:
                cand_score = 0.0
            else:
                cand_score = max(sub_score, seq_score, token_score)

            if cand_score > best_closeness:
                best_closeness = min(1.0, cand_score)
                if best_closeness >= 0.88:
                    best_reason = f"High closeness match ({int(round(best_closeness * 100))}%)"
                elif best_closeness >= 0.60:
                    best_reason = f"Substantial closeness match ({int(round(best_closeness * 100))}%)"
                elif best_closeness >= 0.35:
                    best_reason = f"Partial closeness match ({int(round(best_closeness * 100))}%)"
                elif best_closeness >= 0.15:
                    best_reason = f"Weak closeness match ({int(round(best_closeness * 100))}%)"
                else:
                    best_reason = "Unrelated response"

        # If closeness is below noise threshold, zero it out
        if best_closeness < 0.20:
            best_closeness = 0.0
            best_reason = "No significant match with original answer"

        return best_closeness, best_reason

    @classmethod
    def calculate_marks_from_closeness(cls, closeness: float, max_marks: float) -> float:
        """
        Translates closeness ratio (0.0 to 1.0) into pedagogical score awarded:
        - Closeness >= 0.88: 100% full marks (generous for minor typos & phrasing)
        - Closeness 0.70 - 0.87: 80% to 95% marks (strong understanding)
        - Closeness 0.40 - 0.69: 45% to 75% marks (partial credit for partial key concepts)
        - Closeness 0.20 - 0.39: 20% to 35% marks (minimal partial credit)
        - Closeness < 0.20: 0 marks
        """
        if max_marks <= 0.0 or closeness <= 0.0:
            return 0.0

        if closeness >= 0.88:
            return float(max_marks)
        elif closeness >= 0.70:
            fraction = 0.80 + ((closeness - 0.70) / (0.88 - 0.70)) * 0.18
            return round(max_marks * fraction, 2)
        elif closeness >= 0.40:
            fraction = 0.45 + ((closeness - 0.40) / (0.70 - 0.40)) * 0.30
            return round(max_marks * fraction, 2)
        elif closeness >= 0.20:
            fraction = 0.20 + ((closeness - 0.20) / (0.40 - 0.20)) * 0.20
            return round(max_marks * fraction, 2)
        else:
            return 0.0

    @classmethod
    def grade_mcq_single(cls, question: Question, student_answer: StudentAnswer, negative_marking: bool = False) -> float:
        """Single Choice MCQ: Check if the single selected option matches the correct option"""
        selected_ids = student_answer.selected_option_ids or []
        if not selected_ids:
            return 0.0

        chosen_id = str(selected_ids[0])
        correct_option = next((opt for opt in question.options if opt.is_correct), None)
        if not correct_option:
            return 0.0

        if chosen_id == str(correct_option.id):
            return float(question.marks)
        else:
            if negative_marking and question.negative_marks > 0:
                return -float(question.negative_marks)
            return 0.0

    @classmethod
    def grade_mcq_multiple(cls, question: Question, student_answer: StudentAnswer, partial_credit: bool = False, negative_marking: bool = False) -> float:
        """Multiple Choice MCQ: Select all correct options"""
        selected_ids = set(str(sid) for sid in (student_answer.selected_option_ids or []))
        correct_ids = set(str(opt.id) for opt in question.options if opt.is_correct)
        incorrect_ids = set(str(opt.id) for opt in question.options if not opt.is_correct)

        if not selected_ids or not correct_ids:
            return 0.0

        # Exact match
        if selected_ids == correct_ids:
            return float(question.marks)

        if partial_credit:
            correct_picked = len(selected_ids.intersection(correct_ids))
            incorrect_picked = len(selected_ids.intersection(incorrect_ids))
            fraction = max(0.0, (correct_picked - incorrect_picked) / len(correct_ids))
            return round(fraction * float(question.marks), 2)
        else:
            if negative_marking and question.negative_marks > 0:
                return -float(question.negative_marks)
            return 0.0

    @classmethod
    def grade_true_false(cls, question: Question, student_answer: StudentAnswer, negative_marking: bool = False) -> float:
        return cls.grade_mcq_single(question, student_answer, negative_marking)

    @classmethod
    def grade_numerical(cls, question: Question, student_answer: StudentAnswer, exam_default_tolerance: float = 0.01) -> float:
        """
        Numerical question: Grades based on closeness with expected numerical value.
        Awards full marks within tolerance, and graded partial credit for near-miss values.
        """
        val = student_answer.numerical_answer
        if val is None and student_answer.text_answer:
            try:
                clean_num = re.sub(r'[^\d\.\-\+eE]', '', student_answer.text_answer.strip())
                val = float(clean_num)
            except (ValueError, TypeError):
                val = None

        if val is None or question.numerical_expected is None:
            student_answer.evaluation_notes = "Missing or non-numerical value."
            return 0.0

        tolerance = question.numerical_tolerance if (question.numerical_tolerance is not None and question.numerical_tolerance > 0) else exam_default_tolerance
        diff = abs(val - question.numerical_expected)
        max_marks = float(question.marks)

        # 1. Within primary tolerance -> Full marks
        if diff <= tolerance:
            student_answer.evaluation_notes = f"Exact match within tolerance (±{tolerance})"
            return max_marks

        # 2. Near tolerance boundaries (tolerance step-down)
        if tolerance > 0:
            if diff <= 1.25 * tolerance:
                student_answer.evaluation_notes = f"Near match within tolerance boundary (±{tolerance})"
                return round(max_marks * 0.70, 2)
            student_answer.evaluation_notes = f"Value {val} outside tolerance (Expected: {question.numerical_expected} ±{tolerance})"
            return 0.0

        # 3. Relative error assessment if tolerance is 0
        expected = abs(question.numerical_expected)
        if expected > 0:
            rel_error = diff / expected
            if rel_error <= 0.005:
                student_answer.evaluation_notes = f"Very close value ({rel_error*100:.2f}% relative difference)"
                return round(max_marks * 0.85, 2)

        student_answer.evaluation_notes = f"Value {val} outside acceptable closeness (Expected: {question.numerical_expected})"
        return 0.0

    @classmethod
    def grade_short_answer(cls, question: Question, student_answer: StudentAnswer) -> float:
        """
        Short answer / Fill in the blanks:
        Grades manually entered text based on closeness with original accepted answers and sample solution.
        """
        if not student_answer.text_answer or not student_answer.text_answer.strip():
            student_answer.evaluation_notes = "Blank response."
            return 0.0

        accepted = list(question.accepted_answers or [])
        if question.sample_solution and question.sample_solution not in accepted:
            accepted.append(question.sample_solution)

        if not accepted:
            student_answer.evaluation_notes = "No reference answer available for comparison."
            return 0.0

        closeness, reason = cls.compute_text_closeness(
            student_text=student_answer.text_answer,
            reference_texts=accepted,
            rubric=question.descriptive_rubric
        )

        awarded = cls.calculate_marks_from_closeness(closeness, float(question.marks))
        student_answer.evaluation_notes = f"Closeness: {int(round(closeness * 100))}% ({reason})"
        return awarded

    @classmethod
    def grade_descriptive(cls, question: Question, student_answer: StudentAnswer) -> float:
        """
        Descriptive / Long Answer / Case Study:
        Grades manually entered student text based on semantic and keyword closeness
        with the original sample solution, accepted criteria, and grading rubric.
        """
        if not student_answer.text_answer or not student_answer.text_answer.strip():
            student_answer.evaluation_notes = "Blank response."
            student_answer.ai_suggested_score = 0.0
            return 0.0

        references = []
        if question.sample_solution:
            references.append(question.sample_solution)
        if question.accepted_answers:
            references.extend(question.accepted_answers)
        if question.descriptive_rubric:
            references.append(question.descriptive_rubric)

        if not references:
            student_answer.evaluation_notes = "No reference solution available for comparison."
            return 0.0

        closeness, reason = cls.compute_text_closeness(
            student_text=student_answer.text_answer,
            reference_texts=references,
            rubric=question.descriptive_rubric
        )

        awarded = cls.calculate_marks_from_closeness(closeness, float(question.marks))
        student_answer.ai_suggested_score = awarded
        student_answer.evaluation_notes = f"Closeness: {int(round(closeness * 100))}% ({reason})"
        return awarded

    @classmethod
    def grade_submission(cls, submission: Submission, exam: Exam) -> Dict[str, Any]:
        """
        Grades all questions for a candidate submission.
        Questions where the candidate manually enters answers (short answer, fill in blanks,
        numerical, descriptive, long answer) are graded based on closeness with the original answers.
        """
        total_possible = float(exam.total_marks)
        total_obtained = 0.0
        pending_review_count = 0

        # Build map of questions
        q_map = {str(q.id): q for q in exam.questions}

        for ans in submission.answers:
            q = q_map.get(str(ans.question_id))
            if not q:
                continue

            q_type = q.question_type
            awarded = 0.0

            if q_type == "mcq_single":
                awarded = cls.grade_mcq_single(q, ans, negative_marking=exam.negative_marking_enabled)
            elif q_type == "mcq_multiple":
                awarded = cls.grade_mcq_multiple(q, ans, partial_credit=exam.partial_marking_enabled, negative_marking=exam.negative_marking_enabled)
            elif q_type == "true_false":
                awarded = cls.grade_true_false(q, ans, negative_marking=exam.negative_marking_enabled)
            elif q_type in ("numerical", "math_problem"):
                awarded = cls.grade_numerical(q, ans, exam_default_tolerance=exam.numerical_tolerance)
            elif q_type in ("short_answer", "fill_blank", "fill_in_the_blanks"):
                # Manually entered short answers graded by closeness with original answers
                awarded = cls.grade_short_answer(q, ans)
            elif q_type in ("descriptive", "long_answer", "case_study", "assertion_reason", "match_the_following", "diagram_based"):
                # Manually entered descriptive answers graded by closeness with original answers
                awarded = cls.grade_descriptive(q, ans)
            else:
                # Default text closeness fallback
                if ans.text_answer:
                    awarded = cls.grade_short_answer(q, ans)
                else:
                    awarded = 0.0

            ans.score_awarded = awarded
            ans.is_evaluated = True
            total_obtained += awarded

        # Bound score to 0 or total_possible
        total_obtained = max(0.0, total_obtained)
        if total_possible <= 0:
            total_possible = sum(float(q.marks) for q in exam.questions) or 100.0

        percentage = round((total_obtained / total_possible) * 100.0, 2)
        passed = percentage >= 40.0

        submission.score_obtained = round(total_obtained, 2)
        submission.total_possible = round(total_possible, 2)
        submission.percentage = percentage
        submission.passed = passed
        submission.status = "graded"

        return {
            "score_obtained": submission.score_obtained,
            "total_possible": submission.total_possible,
            "percentage": submission.percentage,
            "passed": submission.passed,
            "status": submission.status,
            "pending_review_count": pending_review_count
        }
