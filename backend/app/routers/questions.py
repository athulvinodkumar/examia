import uuid
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import Profile
from app.models.exam import Exam
from app.models.question import Question, QuestionOption
from app.auth.dependencies import require_teacher
from app.schemas.question import QuestionCreate, QuestionUpdate, QuestionMergeRequest, QuestionSplitRequest

router = APIRouter(tags=["Questions"])

@router.post("/exams/{exam_id}/questions", status_code=status.HTTP_201_CREATED)
async def add_question(
    exam_id: str,
    data: QuestionCreate,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found or unauthorized")

    q_count = len(exam.questions)
    question = Question(
        id=str(uuid.uuid4()),
        exam_id=exam.id,
        section_id=data.section_id,
        question_number=data.question_number or (q_count + 1),
        question_text=data.question_text,
        question_type=data.question_type,
        marks=data.marks,
        negative_marks=data.negative_marks,
        numerical_expected=data.numerical_expected,
        numerical_tolerance=data.numerical_tolerance,
        accepted_answers=data.accepted_answers,
        descriptive_rubric=data.descriptive_rubric,
        sample_solution=data.sample_solution,
        explanation=data.explanation,
        image_url=data.image_url,
        order_index=q_count,
        review_status="verified",  # Explicitly added questions are verified
        created_at=datetime.now(timezone.utc)
    )
    db.add(question)
    db.flush()

    for idx, opt in enumerate(data.options):
        option = QuestionOption(
            id=str(uuid.uuid4()),
            question_id=question.id,
            option_label=opt.option_label or chr(65 + idx),
            option_text=opt.option_text,
            is_correct=opt.is_correct,
            order_index=idx
        )
        db.add(option)

    # Update exam total marks
    db.flush()
    exam.total_marks = sum(float(q.marks) for q in exam.questions) + float(question.marks)
    db.commit()
    db.refresh(question)

    return {
        "status": "success",
        "question": question.to_dict(public_view=False)
    }

@router.put("/questions/{question_id}")
async def update_question(
    question_id: str,
    data: QuestionUpdate,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    exam = db.query(Exam).filter(Exam.id == question.exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=403, detail="Unauthorized to edit this question")

    update_dict = data.model_dump(exclude_unset=True, exclude={"options"})
    for key, value in update_dict.items():
        setattr(question, key, value)

    # Update options if provided
    if data.options is not None:
        # Clear existing options
        db.query(QuestionOption).filter(QuestionOption.question_id == question.id).delete()
        for idx, opt in enumerate(data.options):
            new_opt = QuestionOption(
                id=str(uuid.uuid4()),
                question_id=question.id,
                option_label=opt.option_label or chr(65 + idx),
                option_text=opt.option_text,
                is_correct=opt.is_correct,
                order_index=idx
            )
            db.add(new_opt)

    question.updated_at = datetime.now(timezone.utc)
    db.flush()
    # Recalculate exam total marks
    exam.total_marks = sum(float(q.marks) for q in exam.questions)
    db.commit()
    db.refresh(question)

    return {
        "status": "success",
        "question": question.to_dict(public_view=False)
    }

@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    exam = db.query(Exam).filter(Exam.id == question.exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=403, detail="Unauthorized")

    db.delete(question)
    db.flush()
    exam.total_marks = sum(float(q.marks) for q in exam.questions)
    db.commit()

    return {
        "status": "success",
        "message": "Question deleted successfully."
    }

@router.post("/questions/{question_id}/duplicate")
async def duplicate_question(
    question_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    source = db.query(Question).filter(Question.id == question_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Question not found")

    exam = db.query(Exam).filter(Exam.id == source.exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=403, detail="Unauthorized")

    new_q = Question(
        id=str(uuid.uuid4()),
        exam_id=source.exam_id,
        section_id=source.section_id,
        question_number=len(exam.questions) + 1,
        question_text=f"{source.question_text} (Copy)",
        question_type=source.question_type,
        marks=source.marks,
        negative_marks=source.negative_marks,
        numerical_expected=source.numerical_expected,
        numerical_tolerance=source.numerical_tolerance,
        accepted_answers=source.accepted_answers,
        descriptive_rubric=source.descriptive_rubric,
        sample_solution=source.sample_solution,
        explanation=source.explanation,
        image_url=source.image_url,
        order_index=len(exam.questions),
        review_status=source.review_status,
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_q)
    db.flush()

    for opt in source.options:
        new_opt = QuestionOption(
            id=str(uuid.uuid4()),
            question_id=new_q.id,
            option_label=opt.option_label,
            option_text=opt.option_text,
            is_correct=opt.is_correct,
            order_index=opt.order_index
        )
        db.add(new_opt)

    exam.total_marks = sum(float(q.marks) for q in exam.questions) + float(new_q.marks)
    db.commit()
    db.refresh(new_q)

    return {
        "status": "success",
        "question": new_q.to_dict(public_view=False)
    }

@router.put("/exams/{exam_id}/questions/reorder")
async def reorder_questions(
    exam_id: str,
    order: List[str],  # List of question IDs in desired order
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found or unauthorized")

    q_map = {str(q.id): q for q in exam.questions}
    for idx, q_id in enumerate(order):
        if q_id in q_map:
            q_map[q_id].order_index = idx
            q_map[q_id].question_number = idx + 1

    db.commit()
    return {"status": "success", "message": "Questions reordered successfully."}

@router.post("/questions/{question_id}/merge")
async def merge_question(
    question_id: str,
    data: Optional[QuestionMergeRequest] = None,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    exam = db.query(Exam).filter(Exam.id == question.exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=403, detail="Unauthorized to modify this examination")

    target_q = None
    if data and data.target_question_id:
        target_q = db.query(Question).filter(
            Question.id == data.target_question_id,
            Question.exam_id == exam.id
        ).first()
        if not target_q:
            raise HTTPException(status_code=404, detail="Target question to merge not found in examination")
    else:
        # Find next sequential question
        next_candidates = [q for q in sorted(exam.questions, key=lambda x: x.order_index) if q.order_index > question.order_index]
        if not next_candidates:
            raise HTTPException(status_code=400, detail="No subsequent question found to merge with.")
        target_q = next_candidates[0]

    if str(target_q.id) == str(question.id):
        raise HTTPException(status_code=400, detail="Cannot merge question with itself")

    # Combine text
    question.question_text = f"{question.question_text}\n\n{target_q.question_text}".strip()
    question.marks = float(question.marks) + float(target_q.marks)

    # Combine options
    if target_q.options:
        start_idx = len(question.options)
        for idx, opt in enumerate(target_q.options):
            new_label = chr(65 + start_idx + idx) if (start_idx + idx) < 26 else f"O{start_idx + idx + 1}"
            opt.question_id = question.id
            opt.order_index = start_idx + idx
            opt.option_label = new_label

    # Combine subquestions
    combined_subs = []
    if question.subquestions:
        combined_subs.extend(question.subquestions)
    if target_q.subquestions:
        combined_subs.extend(target_q.subquestions)
    if combined_subs:
        question.subquestions = combined_subs

    question.review_status = "verified"
    question.confidence_score = 1.0
    question.updated_at = datetime.now(timezone.utc)

    # Delete target_q
    db.delete(target_q)
    db.flush()

    # Re-index remaining questions
    remaining_qs = sorted(exam.questions, key=lambda x: x.order_index)
    for idx, q in enumerate(remaining_qs):
        q.order_index = idx
        q.question_number = idx + 1

    exam.total_marks = sum(float(q.marks) for q in exam.questions)
    db.commit()
    db.refresh(question)

    return {
        "status": "success",
        "message": f"Successfully merged question with next question into Q{question.question_number}",
        "question": question.to_dict(public_view=False),
        "questions": [q.to_dict(public_view=False) for q in sorted(exam.questions, key=lambda x: x.order_index)]
    }

@router.post("/questions/{question_id}/split")
async def split_question(
    question_id: str,
    data: Optional[QuestionSplitRequest] = None,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    exam = db.query(Exam).filter(Exam.id == question.exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=403, detail="Unauthorized to modify this examination")

    split_parts = []
    if data and data.parts and len(data.parts) >= 2:
        for p in data.parts:
            split_parts.append({
                "text": p.question_text.strip(),
                "marks": p.marks,
                "type": p.question_type or question.question_type,
                "options": p.options or []
            })
    elif data and data.delimiter and data.delimiter in question.question_text:
        chunks = [c.strip() for c in question.question_text.split(data.delimiter) if c.strip()]
        if len(chunks) >= 2:
            default_marks = max(1.0, round(float(question.marks) / len(chunks), 1))
            for c in chunks:
                split_parts.append({
                    "text": c,
                    "marks": default_marks,
                    "type": question.question_type,
                    "options": []
                })
    elif question.subquestions and len(question.subquestions) >= 2:
        for sq in question.subquestions:
            sq_text = sq.get("text", "").strip() or sq.get("sub_label", "")
            sq_marks = sq.get("marks")
            split_parts.append({
                "text": sq_text,
                "marks": float(sq_marks) if sq_marks else max(1.0, round(float(question.marks) / len(question.subquestions), 1)),
                "type": sq.get("question_type") or question.question_type,
                "options": []
            })
    else:
        # Regex auto split by common subpart labels: (a), (b), 1), 2), (i), (ii)
        chunks = re.split(r'\n(?=\s*(?:\([a-zA-Z0-9]+\)|[a-zA-Z0-9]+\.|\([ivxIVX]+\))\s+)', question.question_text)
        chunks = [c.strip() for c in chunks if c.strip()]
        if len(chunks) >= 2:
            default_marks = max(1.0, round(float(question.marks) / len(chunks), 1))
            for c in chunks:
                split_parts.append({
                    "text": c,
                    "marks": default_marks,
                    "type": question.question_type,
                    "options": []
                })

    if len(split_parts) < 2:
        raise HTTPException(
            status_code=400,
            detail="Could not automatically detect split points. Please provide explicit parts or delimiter."
        )

    # 1. Update the first question with part 0
    first_part = split_parts[0]
    question.question_text = first_part["text"]
    question.marks = float(first_part["marks"]) if first_part.get("marks") is not None else max(1.0, round(float(question.marks) / len(split_parts), 1))
    if first_part.get("type"):
        question.question_type = first_part["type"]
    question.subquestions = None
    question.review_status = "verified"
    question.confidence_score = 1.0
    question.updated_at = datetime.now(timezone.utc)

    # 2. Get existing questions ordered by current order_index
    existing_qs = db.query(Question).filter(Question.exam_id == exam.id).order_by(Question.order_index).all()
    q_idx = next(i for i, q in enumerate(existing_qs) if q.id == question.id)

    new_questions = []
    for i, part in enumerate(split_parts[1:], start=1):
        new_q = Question(
            id=str(uuid.uuid4()),
            exam_id=exam.id,
            section_id=question.section_id,
            question_number=question.question_number + i,
            question_text=part["text"],
            question_type=part.get("type") or question.question_type,
            marks=float(part["marks"]) if part.get("marks") is not None else float(question.marks),
            negative_marks=question.negative_marks,
            order_index=question.order_index + i,
            review_status="verified",
            confidence_score=1.0,
            created_at=datetime.now(timezone.utc)
        )
        db.add(new_q)
        new_questions.append(new_q)

    db.flush()

    # Form the exact sequential order: before + question + new_questions + after
    ordered_sequence = existing_qs[:q_idx] + [question] + new_questions + existing_qs[q_idx+1:]
    for idx, q in enumerate(ordered_sequence):
        q.order_index = idx
        q.question_number = idx + 1

    exam.total_marks = sum(float(q.marks) for q in ordered_sequence)
    db.commit()
    db.refresh(question)

    return {
        "status": "success",
        "message": f"Question successfully split into {len(split_parts)} separate questions.",
        "questions": [q.to_dict(public_view=False) for q in sorted(exam.questions, key=lambda x: x.order_index)]
    }
