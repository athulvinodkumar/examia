import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from urllib.parse import urlparse

from app.config import settings
from app.database import get_db
from app.models.user import Profile
from app.models.exam import Exam, ExamSection
from app.models.question import Question, QuestionOption
from app.models.paper import UploadedPaper
from app.auth.dependencies import get_current_user, require_teacher, get_current_user_optional
from app.schemas.exam import ExamCreate, ExamSettingsUpdate, ExamPublishResponse
from app.services.exam_service import ExamService
from app.services.notification_service import NotificationService

PRIMARY_DOMAIN = "https://examia.athulvinodkumar08.workers.dev"

def get_caller_base_url(request: Request) -> str:
    """Derive caller's actual accessible frontend base URL dynamically from request headers, strictly removing localhost"""
    origin = request.headers.get("origin")
    if origin and "://" in origin and "localhost" not in origin and "127.0.0.1" not in origin:
        return origin.rstrip("/")

    referer = request.headers.get("referer")
    if referer and "://" in referer:
        try:
            p = urlparse(referer)
            if p.scheme and p.netloc and "localhost" not in p.netloc and "127.0.0.1" not in p.netloc:
                return f"{p.scheme}://{p.netloc}"
        except Exception:
            pass

    f_proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
    f_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if f_host and "localhost" not in f_host and "127.0.0.1" not in f_host:
        return f"{f_proto}://{f_host}".rstrip("/")

    frontend_cfg = (settings.frontend_url or "").rstrip("/")
    if frontend_cfg and "localhost" not in frontend_cfg and "127.0.0.1" not in frontend_cfg:
        return frontend_cfg

    return PRIMARY_DOMAIN

def ensure_aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

router = APIRouter(prefix="/exams", tags=["Examinations"])

@router.get("")
async def list_exams(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    query = db.query(Exam).filter(Exam.teacher_id == current_user.id)

    if status_filter and status_filter != "all":
        query = query.filter(Exam.status == status_filter)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            (Exam.title.ilike(search_fmt)) |
            (Exam.subject.ilike(search_fmt)) |
            (Exam.class_group.ilike(search_fmt))
        )

    query = query.order_by(desc(Exam.created_at))
    exams = query.all()

    return {
        "status": "success",
        "count": len(exams),
        "exams": [e.to_dict(include_questions=False, public_view=False) for e in exams]
    }

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_exam(
    data: ExamCreate,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    exam = Exam(
        id=str(uuid.uuid4()),
        teacher_id=current_user.id,
        paper_id=data.paper_id,
        title=data.title,
        description=data.description,
        subject=data.subject,
        class_group=data.class_group,
        instructions=data.instructions,
        duration_minutes=data.duration_minutes,
        total_marks=data.total_marks or 0.0,
        status="draft",
        invitation_token=ExamService.generate_invitation_token(),
        created_at=datetime.now(timezone.utc)
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)

    return {
        "status": "success",
        "exam": exam.to_dict(include_questions=True, public_view=False)
    }

@router.get("/public/{invitation_token}")
async def get_public_exam_info(
    invitation_token: str,
    db: Session = Depends(get_db)
):
    """Public info endpoint when student opens invitation link"""
    exam = db.query(Exam).filter(
        or_(
            Exam.invitation_token == invitation_token,
            Exam.id == invitation_token
        )
    ).first()
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Examination not found or invalid invitation link"
        )

    if exam.status not in ("published", "active", "completed"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This examination is currently not open (Status: {exam.status})"
        )

    # Check schedule window if configured
    now = datetime.now(timezone.utc)
    if exam.start_time and now < ensure_aware(exam.start_time):
        return {
            "status": "scheduled",
            "is_open": False,
            "message": f"This examination opens on {exam.start_time.strftime('%b %d, %Y at %I:%M %p')}",
            "exam": exam.to_dict(include_questions=False, public_view=True)
        }
    if exam.end_time and now > ensure_aware(exam.end_time):
        return {
            "status": "closed",
            "is_open": False,
            "message": "This examination has closed.",
            "exam": exam.to_dict(include_questions=False, public_view=True)
        }

    return {
        "status": "available",
        "is_open": True,
        "requires_passcode": bool(exam.passcode),
        "exam": exam.to_dict(include_questions=False, public_view=True)
    }

@router.get("/{exam_id}")
async def get_exam(
    exam_id: str,
    current_user: Optional[Profile] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")

    is_owner = current_user and (str(exam.teacher_id) == str(current_user.id) or current_user.role == "admin")
    public_view = not is_owner

    if public_view and exam.status not in ("published", "active", "completed"):
        raise HTTPException(status_code=403, detail="Examination is not published")

    return {
        "status": "success",
        "exam": exam.to_dict(include_questions=True, public_view=public_view)
    }

@router.put("/{exam_id}")
async def update_exam(
    exam_id: str,
    data: ExamSettingsUpdate,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found or unauthorized")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(exam, key, value)

    # Recalculate total marks from questions if not explicitly overridden
    if "total_marks" not in update_dict:
        total = sum(float(q.marks) for q in exam.questions)
        exam.total_marks = total

    exam.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(exam)

    return {
        "status": "success",
        "exam": exam.to_dict(include_questions=True, public_view=False)
    }

@router.post("/{exam_id}/publish", response_model=ExamPublishResponse)
async def publish_exam(
    exam_id: str,
    request: Request,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Validate examination and publish it to generate public invitation link and QR code"""
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found or unauthorized")

    # Validation
    if not exam.questions or len(exam.questions) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot publish an empty examination. Add at least one question."
        )

    # Validate questions
    for idx, q in enumerate(exam.questions, 1):
        if not q.question_text or not q.question_text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Question #{idx} is missing question text."
            )
        if q.question_type in ("mcq_single", "mcq_multiple") and len(q.options) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Question #{idx} is multiple choice but has fewer than 2 options."
            )

    # Ensure total marks is computed
    total_marks = sum(float(q.marks) for q in exam.questions)
    exam.total_marks = total_marks if total_marks > 0 else 100.0

    if not exam.invitation_token:
        exam.invitation_token = ExamService.generate_invitation_token()

    exam.status = "published"
    exam.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(exam)

    NotificationService.create_notification(
        db,
        user_id=str(current_user.id),
        title=f"Exam Published: {exam.title}",
        message=f"'{exam.title}' is now live with {len(exam.questions)} questions ({exam.total_marks} marks). Share the link or QR code with your students.",
        notif_type="exam_published",
        action_url=f"/app.html#exams/{exam.id}"
    )

    base_url = get_caller_base_url(request)
    publish_payload = ExamService.get_publishing_payload(exam, base_url=base_url)
    return publish_payload

@router.post("/{exam_id}/unpublish")
async def unpublish_exam(
    exam_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found or unauthorized")

    exam.status = "draft"
    exam.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(exam)

    return {
        "status": "success",
        "message": "Examination reverted to draft.",
        "exam": exam.to_dict(include_questions=False, public_view=False)
    }

@router.get("/{exam_id}/sharing")
async def get_exam_sharing(
    exam_id: str,
    request: Request,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Retrieve invitation link, QR code, and templates anytime without republishing"""
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found or unauthorized")

    if not exam.invitation_token:
        exam.invitation_token = ExamService.generate_invitation_token()
        db.commit()
        db.refresh(exam)

    base_url = get_caller_base_url(request)
    return {
        "status": "success",
        "sharing": ExamService.get_publishing_payload(exam, base_url=base_url)
    }

@router.post("/{exam_id}/duplicate")
async def duplicate_exam(
    exam_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    source = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source examination not found")

    new_exam = Exam(
        id=str(uuid.uuid4()),
        teacher_id=current_user.id,
        paper_id=source.paper_id,
        title=f"{source.title} (Copy)",
        description=source.description,
        subject=source.subject,
        class_group=source.class_group,
        instructions=source.instructions,
        status="draft",
        total_marks=source.total_marks,
        duration_minutes=source.duration_minutes,
        invitation_token=ExamService.generate_invitation_token(),
        passcode=source.passcode,
        access_policy=source.access_policy,
        shuffle_questions=source.shuffle_questions,
        shuffle_options=source.shuffle_options,
        allow_navigation=source.allow_navigation,
        show_marks_per_question=source.show_marks_per_question,
        negative_marking_enabled=source.negative_marking_enabled,
        partial_marking_enabled=source.partial_marking_enabled,
        grading_mode=source.grading_mode,
        numerical_tolerance=source.numerical_tolerance,
        result_visibility=source.result_visibility,
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_exam)
    db.flush()

    # Copy questions & options
    for q in source.questions:
        new_q = Question(
            id=str(uuid.uuid4()),
            exam_id=new_exam.id,
            question_number=q.question_number,
            question_text=q.question_text,
            question_type=q.question_type,
            marks=q.marks,
            negative_marks=q.negative_marks,
            numerical_expected=q.numerical_expected,
            numerical_tolerance=q.numerical_tolerance,
            accepted_answers=q.accepted_answers,
            descriptive_rubric=q.descriptive_rubric,
            sample_solution=q.sample_solution,
            explanation=q.explanation,
            image_url=q.image_url,
            order_index=q.order_index,
            review_status=q.review_status
        )
        db.add(new_q)
        db.flush()

        for opt in q.options:
            new_opt = QuestionOption(
                id=str(uuid.uuid4()),
                question_id=new_q.id,
                option_label=opt.option_label,
                option_text=opt.option_text,
                is_correct=opt.is_correct,
                order_index=opt.order_index
            )
            db.add(new_opt)

    db.commit()
    db.refresh(new_exam)

    return {
        "status": "success",
        "exam": new_exam.to_dict(include_questions=True, public_view=False)
    }

@router.post("/{exam_id}/auto-solve")
async def auto_solve_exam(
    exam_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Automatically solves all questions in this exam with AI and updates answer keys and rubrics"""
    from app.services.ai_answer_solver import AIAnswerSolver
    exam = AIAnswerSolver.solve_exam_in_db(db, exam_id, str(current_user.id))
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found or unauthorized")

    return {
        "status": "success",
        "message": f"Successfully auto-solved answers for {len(exam.questions)} questions",
        "exam": exam.to_dict(include_questions=True, public_view=False)
    }

@router.delete("/{exam_id}")
async def delete_exam(
    exam_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found or unauthorized")

    db.delete(exam)
    db.commit()

    return {
        "status": "success",
        "message": f"Examination '{exam.title}' deleted successfully."
    }
