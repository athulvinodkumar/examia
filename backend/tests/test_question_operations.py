"""
Tests for Question Split and Question Merge Operations
"""

import pytest
import uuid
from datetime import datetime, timezone
from app.database import SessionLocal, init_db
from app.models.exam import Exam
from app.models.question import Question, QuestionOption
from app.models.user import Profile
from app.routers.questions import split_question, merge_question
from app.schemas.question import QuestionSplitRequest, QuestionMergeRequest

@pytest.fixture(scope="module")
def db_session():
    init_db()
    db = SessionLocal()
    yield db
    db.close()

@pytest.fixture(scope="module")
def teacher_user(db_session):
    teacher = db_session.query(Profile).filter(Profile.role == "teacher").first()
    if not teacher:
        teacher = Profile(
            id=str(uuid.uuid4()),
            email="ops_teacher@examia.io",
            full_name="Professor Operations",
            role="teacher",
            created_at=datetime.now(timezone.utc)
        )
        db_session.add(teacher)
        db_session.commit()
    return teacher

@pytest.fixture
def exam_with_questions(db_session, teacher_user):
    exam = Exam(
        id=str(uuid.uuid4()),
        teacher_id=teacher_user.id,
        title="Operations Test Examination",
        duration_minutes=45,
        total_marks=10.0,
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(exam)
    db_session.flush()

    q1 = Question(
        id=str(uuid.uuid4()),
        exam_id=exam.id,
        question_number=1,
        question_text="1(a) Define electric potential.\n1(b) State Ohm's law.",
        question_type="short_answer",
        marks=6.0,
        order_index=0,
        subquestions=[
            {"label": "a", "text": "Define electric potential.", "marks": 3.0},
            {"label": "b", "text": "State Ohm's law.", "marks": 3.0}
        ],
        created_at=datetime.now(timezone.utc)
    )
    q2 = Question(
        id=str(uuid.uuid4()),
        exam_id=exam.id,
        question_number=2,
        question_text="Calculate current when V = 10V and R = 2 ohms.",
        question_type="numerical",
        marks=4.0,
        order_index=1,
        numerical_expected=5.0,
        numerical_tolerance=0.01,
        created_at=datetime.now(timezone.utc)
    )
    db_session.add_all([q1, q2])
    db_session.commit()
    return exam, q1, q2

@pytest.mark.asyncio
async def test_question_split_by_subquestions(db_session, teacher_user, exam_with_questions):
    exam, q1, q2 = exam_with_questions
    req = QuestionSplitRequest(split_mode="subquestions")
    res = await split_question(question_id=q1.id, data=req, current_user=teacher_user, db=db_session)

    assert res["status"] == "success"
    # Q1 was split into 2 questions, so total questions is now 3
    assert len(res["questions"]) == 3
    assert res["questions"][0]["question_text"] == "Define electric potential."
    assert res["questions"][0]["marks"] == 3.0
    assert res["questions"][1]["question_text"] == "State Ohm's law."
    assert res["questions"][1]["marks"] == 3.0
    assert res["questions"][2]["question_number"] == 3

@pytest.mark.asyncio
async def test_question_merge_with_next(db_session, teacher_user, exam_with_questions):
    exam, q1, q2 = exam_with_questions
    req = QuestionMergeRequest(target_question_id=q2.id)
    res = await merge_question(question_id=q1.id, data=req, current_user=teacher_user, db=db_session)

    assert res["status"] == "success"
    # Merged q2 into q1, total questions is now 1
    assert len(res["questions"]) == 1
    merged = res["question"]
    assert "Define electric potential." in merged["question_text"]
    assert "Calculate current when V = 10V" in merged["question_text"]
    assert merged["marks"] == 10.0
