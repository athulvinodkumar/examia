import os
import uuid
import shutil
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.config import settings
from app.database import get_db
from app.models.user import Profile
from app.models.paper import UploadedPaper
from app.models.exam import Exam, ExamSection
from app.models.question import Question, QuestionOption
from app.auth.dependencies import require_teacher
from app.services.document_processor import DocumentProcessor
from app.services.exam_service import ExamService
from app.services.ai_answer_solver import AIAnswerSolver

router = APIRouter(prefix="/papers", tags=["Question Papers"])

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

@router.get("")
async def list_papers(
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    papers = db.query(UploadedPaper).filter(
        UploadedPaper.teacher_id == current_user.id
    ).order_by(desc(UploadedPaper.created_at)).all()

    return {
        "status": "success",
        "count": len(papers),
        "papers": [p.to_dict() for p in papers]
    }

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_paper(
    file: UploadFile = File(...),
    auto_solve: Optional[bool] = Query(None),
    auto_solve_form: Optional[bool] = Form(None, alias="auto_solve"),
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    should_auto_solve = bool(auto_solve if auto_solve is not None else (auto_solve_form if auto_solve_form is not None else False))
    filename = file.filename or "paper.pdf"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in (".pdf", ".docx", ".doc"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Examia accepts PDF and DOCX documents."
        )

    # Ensure upload directory exists
    os.makedirs(settings.upload_dir, exist_ok=True)
    stored_filename = f"{uuid.uuid4()}_{filename}"
    file_path = os.path.join(settings.upload_dir, stored_filename)

    # Read and validate size
    try:
        content = await file.read()
        file_size = len(content)
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum limit of 25 MB."
            )
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Create paper record
    paper = UploadedPaper(
        id=str(uuid.uuid4()),
        teacher_id=current_user.id,
        filename=stored_filename,
        original_filename=filename,
        file_size=file_size,
        mime_type=file.content_type or "application/octet-stream",
        storage_path=file_path,
        status="processing",
        created_at=datetime.now(timezone.utc)
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    # Process document
    try:
        extraction_result = DocumentProcessor.process_document(file_path, filename)
        questions_data = extraction_result.get("questions", [])

        # If auto_solve was requested, automatically solve all questions with AI
        if should_auto_solve and questions_data:
            questions_data = AIAnswerSolver.solve_questions(questions_data)
            extraction_result["questions"] = questions_data
            extraction_result["ai_answers_generated"] = True
        
        paper.extracted_data = extraction_result
        paper.extracted_question_count = len(questions_data)
        paper.status = "extracted"
        paper.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(paper)
    except Exception as e:
        paper.status = "failed"
        paper.error_message = str(e)
        paper.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(paper)

    return {
        "status": "success",
        "paper": paper.to_dict(),
        "extracted_questions": paper.extracted_data.get("questions", []) if paper.extracted_data else [],
        "ai_answers_generated": bool(should_auto_solve)
    }

@router.post("/{paper_id}/auto-solve")
async def auto_solve_paper_questions(
    paper_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Automatically solves all questions extracted from a paper and stores answers for teacher verification"""
    paper = db.query(UploadedPaper).filter(
        UploadedPaper.id == paper_id,
        UploadedPaper.teacher_id == current_user.id
    ).first()

    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    if not paper.extracted_data or not paper.extracted_data.get("questions"):
        raise HTTPException(status_code=400, detail="Paper has no extracted questions to solve.")

    questions = paper.extracted_data.get("questions", [])
    solved_questions = AIAnswerSolver.solve_questions(questions)

    updated_data = dict(paper.extracted_data)
    updated_data["questions"] = solved_questions
    updated_data["ai_answers_generated"] = True
    paper.extracted_data = updated_data
    paper.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(paper)

    return {
        "status": "success",
        "message": f"Successfully auto-solved answers for {len(solved_questions)} questions",
        "paper": paper.to_dict(),
        "extracted_questions": solved_questions,
        "ai_answers_generated": True
    }

@router.put("/{paper_id}/update-questions")
async def update_paper_extracted_questions(
    paper_id: str,
    payload: Dict[str, Any],
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Updates paper questions with teacher-verified answers before exam generation"""
    paper = db.query(UploadedPaper).filter(
        UploadedPaper.id == paper_id,
        UploadedPaper.teacher_id == current_user.id
    ).first()

    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    verified_questions = payload.get("questions")
    if not isinstance(verified_questions, list):
        raise HTTPException(status_code=400, detail="Invalid payload: 'questions' list required.")

    updated_data = dict(paper.extracted_data or {})
    updated_data["questions"] = verified_questions
    updated_data["teacher_verified"] = True
    paper.extracted_data = updated_data
    paper.extracted_question_count = len(verified_questions)
    paper.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(paper)

    return {
        "status": "success",
        "message": "Verified questions updated successfully",
        "paper": paper.to_dict(),
        "extracted_questions": verified_questions,
        "extracted_data": paper.extracted_data,
        "teacher_verified": True
    }

@router.get("/{paper_id}")
async def get_paper(
    paper_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    paper = db.query(UploadedPaper).filter(
        UploadedPaper.id == paper_id,
        UploadedPaper.teacher_id == current_user.id
    ).first()

    if not paper:
        raise HTTPException(status_code=404, detail="Uploaded paper not found")

    return {
        "status": "success",
        "paper": paper.to_dict(),
        "extracted_data": paper.extracted_data
    }

@router.post("/{paper_id}/retry")
async def retry_paper_processing(
    paper_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    paper = db.query(UploadedPaper).filter(
        UploadedPaper.id == paper_id,
        UploadedPaper.teacher_id == current_user.id
    ).first()

    if not paper:
        raise HTTPException(status_code=404, detail="Uploaded paper not found")

    if not os.path.exists(paper.storage_path):
        raise HTTPException(status_code=400, detail="Original document file not found on server.")

    try:
        paper.status = "processing"
        paper.error_message = None
        db.commit()

        result = DocumentProcessor.process_document(paper.storage_path, paper.original_filename)
        paper.extracted_data = result
        paper.extracted_question_count = len(result.get("questions", []))
        paper.status = "extracted"
        paper.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(paper)
    except Exception as e:
        paper.status = "failed"
        paper.error_message = str(e)
        paper.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(paper)

    return {
        "status": "success",
        "paper": paper.to_dict(),
        "extracted_questions": paper.extracted_data.get("questions", []) if paper.extracted_data else []
    }

@router.post("/{paper_id}/create-exam", status_code=status.HTTP_201_CREATED)
async def create_exam_from_paper(
    paper_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Generates a complete editable examination from the extracted questions of an uploaded paper"""
    paper = db.query(UploadedPaper).filter(
        UploadedPaper.id == paper_id,
        UploadedPaper.teacher_id == current_user.id
    ).first()

    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    if paper.status != "extracted" or not paper.extracted_data:
        raise HTTPException(status_code=400, detail="Paper questions have not been extracted yet.")

    extracted_questions = paper.extracted_data.get("questions", [])
    doc_metadata = paper.extracted_data.get("metadata", {}) or {}
    
    title_base = doc_metadata.get("title") or os.path.splitext(paper.original_filename)[0].replace("_", " ").title()
    if not title_base.lower().endswith("examination") and not title_base.lower().endswith("exam"):
        exam_title = f"{title_base} Examination"
    else:
        exam_title = title_base

    exam_subject = doc_metadata.get("subject") or "General"
    exam_duration = int(doc_metadata.get("duration_minutes") or 60)
    instructions_list = doc_metadata.get("instructions", [])
    exam_instructions = "\n".join(instructions_list) if instructions_list else "Please read each question carefully and select or write your answers."

    exam = Exam(
        id=str(uuid.uuid4()),
        teacher_id=current_user.id,
        paper_id=paper.id,
        title=exam_title,
        description=f"Generated from question paper: {paper.original_filename}",
        subject=exam_subject,
        instructions=exam_instructions,
        status="ready_for_review",
        duration_minutes=exam_duration,
        invitation_token=ExamService.generate_invitation_token(),
        created_at=datetime.now(timezone.utc)
    )
    db.add(exam)
    db.flush()

    # Track sections
    section_map = {}
    total_marks = 0.0

    for idx, q_data in enumerate(extracted_questions):
        sec_title = q_data.get("section_title") or "General Section"
        if sec_title not in section_map:
            sec = ExamSection(
                id=str(uuid.uuid4()),
                exam_id=exam.id,
                title=sec_title,
                order_index=len(section_map)
            )
            db.add(sec)
            db.flush()
            section_map[sec_title] = sec.id

        sec_id = section_map[sec_title]
        marks = float(q_data.get("marks", 1.0))
        total_marks += marks

        conf_score = float(q_data.get("confidence_score", 0.95))
        needs_rev = q_data.get("review_status") == "needs_review" or q_data.get("needs_review") or conf_score < 0.70

        q = Question(
            id=str(uuid.uuid4()),
            exam_id=exam.id,
            section_id=sec_id,
            question_number=q_data.get("question_number", idx + 1),
            question_text=q_data.get("question_text", f"Question {idx + 1}"),
            question_type=q_data.get("question_type", "mcq_single"),
            marks=marks,
            negative_marks=float(q_data.get("negative_marks", 0.0)),
            numerical_expected=q_data.get("numerical_expected"),
            numerical_tolerance=float(q_data.get("numerical_tolerance", 0.0)),
            accepted_answers=q_data.get("accepted_answers"),
            descriptive_rubric=q_data.get("descriptive_rubric"),
            sample_solution=q_data.get("sample_solution"),
            explanation=q_data.get("explanation"),
            confidence_score=conf_score,
            subquestions=q_data.get("subquestions"),
            order_index=idx,
            review_status="needs_review" if needs_rev else "verified",
            created_at=datetime.now(timezone.utc)
        )
        db.add(q)
        db.flush()

        # Add options for MCQ
        options_data = q_data.get("options", [])
        for opt_idx, opt_data in enumerate(options_data):
            opt = QuestionOption(
                id=str(uuid.uuid4()),
                question_id=q.id,
                option_label=opt_data.get("option_label", chr(65 + opt_idx)),
                option_text=opt_data.get("option_text", ""),
                is_correct=opt_data.get("is_correct", False),
                order_index=opt_idx
            )
            db.add(opt)

    exam.total_marks = total_marks if total_marks > 0 else 100.0
    db.commit()
    db.refresh(exam)

    return {
        "status": "success",
        "exam_id": str(exam.id),
        "exam": exam.to_dict(include_questions=True, public_view=False)
    }

@router.delete("/{paper_id}")
async def delete_paper(
    paper_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    paper = db.query(UploadedPaper).filter(
        UploadedPaper.id == paper_id,
        UploadedPaper.teacher_id == current_user.id
    ).first()

    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    if os.path.exists(paper.storage_path):
        try:
            os.remove(paper.storage_path)
        except OSError:
            pass

    db.delete(paper)
    db.commit()

    return {"status": "success", "message": "Paper deleted successfully."}
