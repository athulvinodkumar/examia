import pytest
from app.models.question import Question, QuestionOption
from app.models.submission import Submission, StudentAnswer
from app.models.exam import Exam
from app.services.grading_service import GradingService

def test_grading_mcq_single():
    # Setup Question with 4 options, option B is correct
    q = Question(
        id="q1",
        question_text="What is the speed of light?",
        question_type="mcq_single",
        marks=2.0,
        negative_marks=0.5
    )
    opt_a = QuestionOption(id="opt_a", option_label="A", option_text="3000 km/s", is_correct=False)
    opt_b = QuestionOption(id="opt_b", option_label="B", option_text="300,000 km/s", is_correct=True)
    opt_c = QuestionOption(id="opt_c", option_label="C", option_text="150,000 km/s", is_correct=False)
    q.options = [opt_a, opt_b, opt_c]

    # Student chose correct option B
    ans_correct = StudentAnswer(question_id="q1", selected_option_ids=["opt_b"])
    score = GradingService.grade_mcq_single(q, ans_correct, negative_marking=True)
    assert score == 2.0

    # Student chose incorrect option A with negative marking
    ans_wrong = StudentAnswer(question_id="q1", selected_option_ids=["opt_a"])
    score_wrong = GradingService.grade_mcq_single(q, ans_wrong, negative_marking=True)
    assert score_wrong == -0.5

    # Student chose incorrect option A without negative marking
    score_wrong_no_neg = GradingService.grade_mcq_single(q, ans_wrong, negative_marking=False)
    assert score_wrong_no_neg == 0.0

def test_grading_mcq_multiple():
    # Setup Question with 2 correct options: A and C
    q = Question(
        id="q2",
        question_text="Select all prime numbers below 10",
        question_type="mcq_multiple",
        marks=4.0
    )
    opt_a = QuestionOption(id="opt_a", option_label="A", option_text="2", is_correct=True)
    opt_b = QuestionOption(id="opt_b", option_label="B", option_text="4", is_correct=False)
    opt_c = QuestionOption(id="opt_c", option_label="C", option_text="7", is_correct=True)
    opt_d = QuestionOption(id="opt_d", option_label="D", option_text="9", is_correct=False)
    q.options = [opt_a, opt_b, opt_c, opt_d]

    # Full correct
    ans_full = StudentAnswer(question_id="q2", selected_option_ids=["opt_a", "opt_c"])
    assert GradingService.grade_mcq_multiple(q, ans_full, partial_credit=True) == 4.0

    # Partial correct (chose opt_a only)
    ans_partial = StudentAnswer(question_id="q2", selected_option_ids=["opt_a"])
    partial_score = GradingService.grade_mcq_multiple(q, ans_partial, partial_credit=True)
    assert partial_score == 2.0

    # Partial credit disabled -> 0.0
    assert GradingService.grade_mcq_multiple(q, ans_partial, partial_credit=False) == 0.0

def test_grading_numerical():
    q = Question(
        id="q3",
        question_text="Calculate escape velocity from Earth",
        question_type="numerical",
        marks=3.0,
        numerical_expected=11.2,
        numerical_tolerance=0.05
    )

    # Exact value
    ans_exact = StudentAnswer(question_id="q3", numerical_answer=11.2)
    assert GradingService.grade_numerical(q, ans_exact) == 3.0

    # Within tolerance (11.23 is within 0.05)
    ans_tol = StudentAnswer(question_id="q3", numerical_answer=11.23)
    assert GradingService.grade_numerical(q, ans_tol) == 3.0

    # Outside tolerance (11.35 is outside 0.05)
    ans_out = StudentAnswer(question_id="q3", numerical_answer=11.35)
    assert GradingService.grade_numerical(q, ans_out) == 0.0

def test_grading_short_answer():
    q = Question(
        id="q4",
        question_text="What is the capital of France?",
        question_type="short_answer",
        marks=2.0,
        accepted_answers=["Paris", "City of Paris"]
    )

    # Exact match normalized
    ans_match = StudentAnswer(question_id="q4", text_answer="  pArIs  ")
    assert GradingService.grade_short_answer(q, ans_match) == 2.0

    # Accepted alternative
    ans_alt = StudentAnswer(question_id="q4", text_answer="city of paris")
    assert GradingService.grade_short_answer(q, ans_alt) == 2.0

    # Incorrect
    ans_wrong = StudentAnswer(question_id="q4", text_answer="London")
    assert GradingService.grade_short_answer(q, ans_wrong) == 0.0

def test_grading_manual_answers_closeness():
    q = Question(
        id="q5",
        question_text="Name the primary volatile memory in a computer",
        question_type="short_answer",
        marks=4.0,
        accepted_answers=["Random Access Memory", "RAM"]
    )

    # 1. Exact match -> Full 4.0 marks
    ans_exact = StudentAnswer(question_id="q5", text_answer="Random Access Memory")
    assert GradingService.grade_short_answer(q, ans_exact) == 4.0

    # 2. Minor spelling error / typo ("Random Access Memroy") -> Full marks under typo tolerance
    ans_typo = StudentAnswer(question_id="q5", text_answer="Random Access Memroy")
    assert GradingService.grade_short_answer(q, ans_typo) == 4.0

    # 3. Sentence containing target answer ("The primary volatile memory is RAM")
    ans_sentence = StudentAnswer(question_id="q5", text_answer="The primary volatile memory is RAM")
    score_sentence = GradingService.grade_short_answer(q, ans_sentence)
    assert score_sentence >= 3.6  # High closeness score

    # 4. Partial concept ("Memory") -> Partial credit
    ans_partial = StudentAnswer(question_id="q5", text_answer="Memory")
    score_partial = GradingService.grade_short_answer(q, ans_partial)
    assert 0.0 < score_partial < 4.0

    # 5. Completely unrelated answer ("Hard Disk Drive") -> 0.0 marks
    ans_unrelated = StudentAnswer(question_id="q5", text_answer="Hard Disk Drive")
    assert GradingService.grade_short_answer(q, ans_unrelated) == 0.0

    # 6. Blank answer -> 0.0 marks
    ans_blank = StudentAnswer(question_id="q5", text_answer="   ")
    assert GradingService.grade_short_answer(q, ans_blank) == 0.0

def test_grading_descriptive_closeness():
    q = Question(
        id="q6",
        question_text="Explain the principle and operations of a Stack data structure.",
        question_type="descriptive",
        marks=5.0,
        sample_solution="A Stack is a linear LIFO (Last-In First-Out) data structure supporting push and pop operations at the top.",
        descriptive_rubric="LIFO principle: 2 marks, push and pop operations: 2 marks, top pointer: 1 mark."
    )

    # Candidate with strong conceptual understanding
    ans_good = StudentAnswer(
        question_id="q6",
        text_answer="Stack operates on the LIFO principle where data elements are inserted using push and removed using pop from the top."
    )
    score_good = GradingService.grade_descriptive(q, ans_good)
    assert score_good >= 4.0  # High closeness match

    # Candidate with partial understanding
    ans_partial = StudentAnswer(
        question_id="q6",
        text_answer="It is a data structure using push operation."
    )
    score_partial = GradingService.grade_descriptive(q, ans_partial)
    assert 0.0 < score_partial < score_good

    # Candidate with completely irrelevant answer
    ans_bad = StudentAnswer(
        question_id="q6",
        text_answer="Photosynthesis occurs in plant chloroplasts using sunlight."
    )
    score_bad = GradingService.grade_descriptive(q, ans_bad)
    assert score_bad == 0.0

