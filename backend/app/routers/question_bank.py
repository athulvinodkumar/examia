import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import Profile
from app.models.question_bank import QuestionBank
from app.models.exam import Exam
from app.models.question import Question, QuestionOption
from app.auth.dependencies import require_teacher

router = APIRouter(prefix="/question-bank", tags=["Question Bank"])

@router.get("")
async def list_bank_questions(
    subject: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    query = db.query(QuestionBank).filter(QuestionBank.teacher_id == current_user.id)

    if subject:
        query = query.filter(QuestionBank.subject.ilike(f"%{subject.strip()}%"))
    if topic:
        query = query.filter(QuestionBank.topic.ilike(f"%{topic.strip()}%"))
    if search:
        query = query.filter(QuestionBank.question_text.ilike(f"%{search.strip()}%"))

    questions = query.order_by(desc(QuestionBank.created_at)).all()
    return {
        "status": "success",
        "count": len(questions),
        "questions": [q.to_dict() for q in questions]
    }

@router.post("", status_code=status.HTTP_201_CREATED)
async def add_to_question_bank(
    data: dict,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    item = QuestionBank(
        id=str(uuid.uuid4()),
        teacher_id=current_user.id,
        subject=data.get("subject", "General"),
        topic=data.get("topic", "General"),
        question_text=data.get("question_text", ""),
        question_type=data.get("question_type", "mcq_single"),
        options=data.get("options", []),
        correct_answer=data.get("correct_answer"),
        marks=float(data.get("marks", 1.0)),
        explanation=data.get("explanation"),
        created_at=datetime.now(timezone.utc)
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return {"status": "success", "item": item.to_dict()}

@router.delete("/{bank_id}")
async def delete_from_bank(
    bank_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    item = db.query(QuestionBank).filter(
        QuestionBank.id == bank_id,
        QuestionBank.teacher_id == current_user.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Question not found in bank")

    db.delete(item)
    db.commit()
    return {"status": "success", "message": "Question removed from bank."}

@router.post("/exams/{exam_id}/import")
async def import_from_bank_to_exam(
    exam_id: str,
    bank_question_ids: List[str],
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Import selected questions from question bank directly into an examination"""
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found or unauthorized")

    bank_items = db.query(QuestionBank).filter(
        QuestionBank.id.in_(bank_question_ids),
        QuestionBank.teacher_id == current_user.id
    ).all()

    imported_count = 0
    start_q_num = len(exam.questions) + 1

    for idx, item in enumerate(bank_items):
        q = Question(
            id=str(uuid.uuid4()),
            exam_id=exam.id,
            question_number=start_q_num + idx,
            question_text=item.question_text,
            question_type=item.question_type,
            marks=item.marks,
            explanation=item.explanation,
            order_index=len(exam.questions) + idx,
            review_status="verified",
            created_at=datetime.now(timezone.utc)
        )
        db.add(q)
        db.flush()

        # Add options if MCQ
        if item.options and isinstance(item.options, list):
            for opt_idx, opt_data in enumerate(item.options):
                opt = QuestionOption(
                    id=str(uuid.uuid4()),
                    question_id=q.id,
                    option_label=opt_data.get("option_label", chr(65 + opt_idx)),
                    option_text=opt_data.get("option_text", ""),
                    is_correct=opt_data.get("is_correct", False),
                    order_index=opt_idx
                )
                db.add(opt)

        imported_count += 1

    exam.total_marks = sum(float(q.marks) for q in exam.questions)
    db.commit()

    return {
        "status": "success",
        "imported_count": imported_count,
        "message": f"Successfully imported {imported_count} questions into '{exam.title}'."
    }
