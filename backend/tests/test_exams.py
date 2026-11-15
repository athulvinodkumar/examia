import pytest
import uuid
from app.models.exam import Exam
from app.models.question import Question, QuestionOption
from app.services.exam_service import ExamService

def test_invitation_token_generation():
    token1 = ExamService.generate_invitation_token()
    token2 = ExamService.generate_invitation_token()
    assert token1.startswith("exm_")
    assert token2.startswith("exm_")
    assert token1 != token2
    assert len(token1) > 20

def test_session_token_generation():
    ses1 = ExamService.generate_session_token()
    ses2 = ExamService.generate_session_token()
    assert ses1.startswith("ses_")
    assert ses1 != ses2

def test_qr_code_generation():
    url = "http://localhost:3000/app.html#exam-invite/exm_12345"
    qr_data = ExamService.generate_qr_code_base64(url)
    assert qr_data.startswith("data:image/png;base64,")
    assert len(qr_data) > 100

def test_exam_serialization_security():
    exam = Exam(
        id=str(uuid.uuid4()),
        teacher_id="teacher_1",
        title="Physics Midterm",
        total_marks=10.0,
        passcode="SECRET123"
    )
    q = Question(
        id=str(uuid.uuid4()),
        exam_id=exam.id,
        question_text="What is $g$?",
        question_type="mcq_single",
        marks=2.0,
        numerical_expected=9.81,
        descriptive_rubric="Teacher secret rubric criteria"
    )
    opt_a = QuestionOption(id=str(uuid.uuid4()), option_label="A", option_text="9.8 m/s^2", is_correct=True)
    opt_b = QuestionOption(id=str(uuid.uuid4()), option_label="B", option_text="12 m/s^2", is_correct=False)
    q.options = [opt_a, opt_b]
    exam.questions = [q]

    # Student public view: passcode, correct answer keys, numerical expected, and rubrics MUST BE HIDDEN!
    public_dict = exam.to_dict(include_questions=True, public_view=True)
    assert "passcode" not in public_dict
    assert public_dict["has_passcode"] is True

    student_q = public_dict["questions"][0]
    assert "numerical_expected" not in student_q
    assert "descriptive_rubric" not in student_q
    assert "is_correct" not in student_q["options"][0]
    assert "is_correct" not in student_q["options"][1]

    # Teacher private view: all keys revealed
    teacher_dict = exam.to_dict(include_questions=True, public_view=False)
    assert teacher_dict["passcode"] == "SECRET123"
    teacher_q = teacher_dict["questions"][0]
    assert teacher_q["numerical_expected"] == 9.81
    assert teacher_q["descriptive_rubric"] == "Teacher secret rubric criteria"
    assert teacher_q["options"][0]["is_correct"] is True
