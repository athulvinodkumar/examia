"""
EXAMIA AI EXAMINATION GENERATOR ROUTER
Endpoints for syllabus upload, topic & curriculum analysis,
and AI-driven question paper synthesis (Autonomous AI mode or Custom question configuration).
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.config import settings
from app.database import get_db
from app.models.user import Profile
from app.models.paper import UploadedPaper
from app.models.exam import Exam
from app.auth.dependencies import require_teacher
from app.services.document_processor import DocumentProcessor
from app.services.ai_exam_generator import AIExamGenerator

router = APIRouter(prefix="/generator", tags=["AI Exam Generator"])

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


class GenerateExamRequest(BaseModel):
    paper_id: Optional[str] = None
    source_text: Optional[str] = None
    exam_title: Optional[str] = None
    subject: Optional[str] = None
    mode: str = Field(default="auto")  # "auto" | "custom"
    target_total_marks: Optional[float] = 50.0
    duration_minutes: Optional[int] = 60
    difficulty: Optional[str] = "medium"  # "easy" | "medium" | "hard"
    selected_topics: Optional[List[str]] = []
    question_types_config: Optional[Dict[str, Dict[str, Any]]] = None


@router.post("/analyze-content", status_code=status.HTTP_201_CREATED)
async def analyze_syllabus_content(
    file: UploadFile = File(...),
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """
    Accepts a syllabus, textbook chapter, lecture notes, or study material (PDF / DOCX),
    extracts the text content, and uses AI to analyze key topics, depth, and generate an exam blueprint.
    """
    filename = file.filename or "syllabus.pdf"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in (".pdf", ".docx", ".doc", ".txt"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format '{ext}'. Please upload a PDF, DOCX, or text file."
        )

    os.makedirs(settings.upload_dir, exist_ok=True)
    stored_filename = f"syllabus_{uuid.uuid4()}_{filename}"
    file_path = os.path.join(settings.upload_dir, stored_filename)

    try:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum limit of 25 MB."
            )
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")

    # Extract text from document
    extracted_text = ""
    try:
        if ext == ".pdf":
            extracted_text = DocumentProcessor.extract_text_from_pdf(file_path)
        elif ext in (".docx", ".doc"):
            extracted_text = DocumentProcessor.extract_text_from_docx(file_path)
        else:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                extracted_text = f.read()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to extract text from document: {str(e)}")

    if not extracted_text or len(extracted_text.strip()) < 20:
        raise HTTPException(
            status_code=400,
            detail="The uploaded document appears to be empty or unreadable. Please check the file and try again."
        )

    # Perform AI syllabus analysis
    analysis = AIExamGenerator.analyze_syllabus_content(extracted_text, filename)

    # Save UploadedPaper record
    paper = UploadedPaper(
        id=str(uuid.uuid4()),
        teacher_id=current_user.id,
        filename=stored_filename,
        original_filename=filename,
        file_size=len(content),
        mime_type=file.content_type or "application/octet-stream",
        storage_path=file_path,
        document_type="syllabus_content",
        status="analyzed",
        extracted_data={
            "analysis": analysis,
            "raw_text_preview": extracted_text[:2000],
            "char_count": len(extracted_text)
        },
        created_at=datetime.now(timezone.utc)
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    return {
        "status": "success",
        "paper_id": str(paper.id),
        "filename": filename,
        "char_count": len(extracted_text),
        "analysis": analysis
    }


@router.post("/generate-exam", status_code=status.HTTP_201_CREATED)
async def generate_exam_from_content(
    payload: GenerateExamRequest,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """
    Synthesizes a complete interactive examination from the analyzed syllabus material.
    Supports Mode A (Custom Teacher Configuration: exact counts & marks per type)
    and Mode B (Autonomous AI Mode: AI chooses optimal distribution of questions and marks).
    """
    source_text = ""
    paper = None

    if payload.paper_id:
        paper = db.query(UploadedPaper).filter(
            UploadedPaper.id == payload.paper_id,
            UploadedPaper.teacher_id == current_user.id
        ).first()

        if not paper:
            raise HTTPException(status_code=404, detail="Syllabus material not found.")

        # Read text from stored file
        if os.path.exists(paper.storage_path):
            ext = os.path.splitext(paper.filename)[1].lower()
            if ext == ".pdf":
                source_text = DocumentProcessor.extract_text_from_pdf(paper.storage_path)
            elif ext in (".docx", ".doc"):
                source_text = DocumentProcessor.extract_text_from_docx(paper.storage_path)
            else:
                with open(paper.storage_path, "r", encoding="utf-8", errors="ignore") as f:
                    source_text = f.read()

    if not source_text and payload.source_text:
        source_text = payload.source_text

    if not source_text or len(source_text.strip()) < 20:
        raise HTTPException(
            status_code=400,
            detail="Source content is required to synthesize the examination."
        )

    config_dict = payload.model_dump()
    exam, questions = AIExamGenerator.generate_exam_from_content(
        text=source_text,
        config=config_dict,
        teacher_id=str(current_user.id),
        db=db,
        paper_id=str(paper.id) if paper else None
    )

    return {
        "status": "success",
        "message": f"Successfully synthesized {len(questions)} interactive questions.",
        "exam_id": str(exam.id),
        "exam": exam.to_dict(include_questions=True, public_view=False),
        "question_count": len(questions),
        "total_marks": exam.total_marks
    }


@router.get("/history")
async def get_syllabus_history(
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Lists previously uploaded syllabus materials for this teacher"""
    papers = db.query(UploadedPaper).filter(
        UploadedPaper.teacher_id == current_user.id,
        UploadedPaper.document_type == "syllabus_content"
    ).order_by(desc(UploadedPaper.created_at)).all()

    return {
        "status": "success",
        "count": len(papers),
        "items": [
            {
                "id": str(p.id),
                "filename": p.original_filename,
                "file_size": p.file_size,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "analysis": (p.extracted_data or {}).get("analysis")
            }
            for p in papers
        ]
    }


@router.get("/papers/{paper_id}/analysis")
async def get_paper_analysis(
    paper_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Retrieves stored analysis for an uploaded syllabus material"""
    paper = db.query(UploadedPaper).filter(
        UploadedPaper.id == paper_id,
        UploadedPaper.teacher_id == current_user.id
    ).first()

    if not paper:
        raise HTTPException(status_code=404, detail="Material not found")

    analysis = (paper.extracted_data or {}).get("analysis")
    if not analysis:
        raise HTTPException(status_code=400, detail="No syllabus analysis found for this document")

    return {
        "status": "success",
        "paper_id": str(paper.id),
        "filename": paper.original_filename,
        "analysis": analysis
    }
