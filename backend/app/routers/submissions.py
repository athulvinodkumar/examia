import uuid
import random
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import Profile
from app.models.exam import Exam
from app.models.question import Question, QuestionOption
from app.models.submission import Submission, StudentAnswer
from app.auth.dependencies import get_current_user, require_teacher, get_current_user_optional
from app.schemas.submission import SubmissionStartRequest, AnswerSaveRequest, SubmissionSubmitRequest
from app.services.exam_service import ExamService
from app.services.grading_service import GradingService
from app.services.notification_service import NotificationService

def ensure_aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

router = APIRouter(prefix="/submissions", tags=["Student Submissions"])

@router.post("/start", status_code=status.HTTP_201_CREATED)
async def start_submission(
    data: SubmissionStartRequest,
    current_user: Optional[Profile] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Student opens exam link, enters optional passcode / name, and starts timed exam session"""
    exam = db.query(Exam).filter(Exam.invitation_token == data.invitation_token).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Invalid examination invitation link")

    if exam.status not in ("published", "active", "completed"):
        raise HTTPException(status_code=403, detail=f"This examination is not open for taking (Status: {exam.status})")

    # Passcode verification
    if exam.passcode:
        if not data.passcode or data.passcode.strip() != exam.passcode.strip():
            raise HTTPException(status_code=401, detail="Incorrect examination passcode")

    # Associate with user or guest student profile
    student = current_user
    if not student:
        # Create a student profile based on entered name
        guest_email = f"student_{uuid.uuid4().hex[:8]}@examia.local"
        student = Profile(
            id=str(uuid.uuid4()),
            email=guest_email,
            full_name=data.student_name or "Student Candidate",
            school_organization=data.student_id_number or "",
            role="student",
            last_login=datetime.now(timezone.utc)
        )
        db.add(student)
        db.commit()
        db.refresh(student)

    # Check for existing in-progress submission to resume
    existing = db.query(Submission).filter(
        Submission.exam_id == exam.id,
        Submission.student_id == student.id,
        Submission.status == "in_progress"
    ).first()

    now = datetime.now(timezone.utc)

    if existing:
        submission = existing
    else:
        # Check maximum attempts for completed submissions
        completed_count = db.query(Submission).filter(
            Submission.exam_id == exam.id,
            Submission.student_id == student.id,
            Submission.status.in_(("submitted", "graded", "pending_review"))
        ).count()

        if exam.max_attempts and completed_count >= exam.max_attempts:
            raise HTTPException(
                status_code=403,
                detail=f"You have reached the maximum allowed attempts ({exam.max_attempts}) for this examination."
            )

        submission = Submission(
            id=str(uuid.uuid4()),
            exam_id=exam.id,
            student_id=student.id,
            session_token=ExamService.generate_session_token(),
            status="in_progress",
            started_at=now,
            created_at=now
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)

    # Calculate remaining time authoritatively from server clock
    duration_seconds = exam.duration_minutes * 60
    elapsed_seconds = int((now - ensure_aware(submission.started_at)).total_seconds())
    remaining_seconds = max(0, duration_seconds - elapsed_seconds)

    # Prepare questions for student (sanitized - no correct answer keys!)
    raw_questions = [q.to_dict(public_view=True, reveal_answers=False) for q in exam.questions]

    if exam.shuffle_questions:
        # Deterministically shuffle based on student id to prevent reshuffle on refresh
        rnd = random.Random(f"{student.id}_{exam.id}")
        rnd.shuffle(raw_questions)

    # Pre-populate student answers map
    saved_answers = {
        str(ans.question_id): {
            "selected_option_ids": ans.selected_option_ids or [],
            "text_answer": ans.text_answer or "",
            "numerical_answer": ans.numerical_answer,
            "is_flagged": ans.is_flagged
        }
        for ans in submission.answers
    }

    return {
        "status": "success",
        "session_token": submission.session_token,
        "submission_id": str(submission.id),
        "exam_title": exam.title,
        "instructions": exam.instructions,
        "duration_seconds": duration_seconds,
        "remaining_seconds": remaining_seconds,
        "allow_navigation": exam.allow_navigation,
        "student_name": student.full_name,
        "questions": raw_questions,
        "saved_answers": saved_answers
    }

@router.get("/{session_token}")
async def get_submission_session(
    session_token: str,
    db: Session = Depends(get_db)
):
    """Resume ongoing student exam session after page refresh"""
    submission = db.query(Submission).filter(Submission.session_token == session_token).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Invalid session token")

    exam = submission.exam
    now = datetime.now(timezone.utc)
    duration_seconds = exam.duration_minutes * 60
    elapsed_seconds = int((now - ensure_aware(submission.started_at)).total_seconds())
    remaining_seconds = max(0, duration_seconds - elapsed_seconds)

    saved_answers = {
        str(ans.question_id): {
            "selected_option_ids": ans.selected_option_ids or [],
            "text_answer": ans.text_answer or "",
            "numerical_answer": ans.numerical_answer,
            "is_flagged": ans.is_flagged
        }
        for ans in submission.answers
    }

    return {
        "status": submission.status,
        "session_token": submission.session_token,
        "exam_title": exam.title,
        "duration_seconds": duration_seconds,
        "remaining_seconds": remaining_seconds,
        "saved_answers": saved_answers,
        "questions": [q.to_dict(public_view=True, reveal_answers=False) for q in exam.questions]
    }

@router.post("/{session_token}/save-answer")
async def save_answer(
    session_token: str,
    data: AnswerSaveRequest,
    db: Session = Depends(get_db)
):
    """Autosave endpoint: saves student answer with sequence numbers to prevent race conditions"""
    submission = db.query(Submission).filter(Submission.session_token == session_token).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Invalid session token")

    if submission.status != "in_progress":
        raise HTTPException(status_code=400, detail="Cannot save answer. Submission is already submitted.")

    now = datetime.now(timezone.utc)

    # Find existing answer or create new
    student_ans = db.query(StudentAnswer).filter(
        StudentAnswer.submission_id == submission.id,
        StudentAnswer.question_id == data.question_id
    ).first()

    if student_ans:
        if data.sequence_number >= student_ans.sequence_number:
            student_ans.selected_option_ids = data.selected_option_ids
            student_ans.text_answer = data.text_answer
            student_ans.numerical_answer = data.numerical_answer
            student_ans.is_flagged = bool(data.is_flagged)
            student_ans.sequence_number = data.sequence_number
            student_ans.last_saved_at = now
    else:
        student_ans = StudentAnswer(
            id=str(uuid.uuid4()),
            submission_id=submission.id,
            question_id=data.question_id,
            selected_option_ids=data.selected_option_ids,
            text_answer=data.text_answer,
            numerical_answer=data.numerical_answer,
            is_flagged=bool(data.is_flagged),
            sequence_number=data.sequence_number,
            last_saved_at=now
        )
        db.add(student_ans)

    submission.updated_at = now
    db.commit()

    return {"status": "saved", "question_id": data.question_id, "timestamp": now.isoformat()}

@router.post("/{session_token}/submit")
async def submit_exam(
    session_token: str,
    data: Optional[SubmissionSubmitRequest] = None,
    db: Session = Depends(get_db)
):
    """Final examination submission: validates timer, executes automatic grading, and finalizes results"""
    submission = db.query(Submission).filter(Submission.session_token == session_token).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Invalid session token")

    if submission.status in ("submitted", "graded", "pending_review"):
        return {
            "status": "already_submitted",
            "message": "This examination has already been submitted.",
            "submission_id": str(submission.id)
        }

    now = datetime.now(timezone.utc)
    exam = submission.exam

    # Save any final payload answers if passed
    if data and data.answers:
        for ans_item in data.answers:
            ans_row = db.query(StudentAnswer).filter(
                StudentAnswer.submission_id == submission.id,
                StudentAnswer.question_id == ans_item.question_id
            ).first()
            if ans_row:
                ans_row.selected_option_ids = ans_item.selected_option_ids
                ans_row.text_answer = ans_item.text_answer
                ans_row.numerical_answer = ans_item.numerical_answer
                ans_row.last_saved_at = now
            else:
                db.add(StudentAnswer(
                    id=str(uuid.uuid4()),
                    submission_id=submission.id,
                    question_id=ans_item.question_id,
                    selected_option_ids=ans_item.selected_option_ids,
                    text_answer=ans_item.text_answer,
                    numerical_answer=ans_item.numerical_answer,
                    last_saved_at=now
                ))
        db.flush()

    time_spent = int((now - ensure_aware(submission.started_at)).total_seconds())
    submission.submitted_at = now
    submission.time_spent_seconds = time_spent
    submission.status = "submitted"
    db.flush()

    # Run backend grading engine
    grading_summary = GradingService.grade_submission(submission, exam)

    # Check result visibility setting
    if exam.result_visibility == "immediate":
        submission.results_released = True
    elif exam.result_visibility == "scheduled" and exam.result_release_time:
        if now >= exam.result_release_time:
            submission.results_released = True

    db.commit()
    db.refresh(submission)

    # Notify teacher
    NotificationService.create_notification(
        db,
        user_id=str(exam.teacher_id),
        title=f"New Submission: {exam.title}",
        message=f"{submission.student.full_name} submitted '{exam.title}' with score {submission.score_obtained}/{submission.total_possible}.",
        notif_type="submission",
        action_url=f"/app.html#exams/{exam.id}/submissions"
    )

    response_data = {
        "status": "submitted",
        "submission_id": str(submission.id),
        "exam_title": exam.title,
        "submitted_at": now.isoformat(),
        "time_spent_seconds": time_spent,
        "results_released": submission.results_released
    }

    if submission.results_released:
        response_data["score_obtained"] = submission.score_obtained
        response_data["total_possible"] = submission.total_possible
        response_data["percentage"] = submission.percentage
        response_data["passed"] = submission.passed

    return response_data

@router.get("/exams/{exam_id}/submissions")
async def list_exam_submissions(
    exam_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Teacher view: list all submissions for a specific exam"""
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found or unauthorized")

    submissions = db.query(Submission).filter(
        Submission.exam_id == exam.id
    ).order_by(desc(Submission.submitted_at)).all()

    return {
        "status": "success",
        "exam_title": exam.title,
        "total_marks": exam.total_marks,
        "submissions": [s.to_dict(include_answers=True, reveal_results=True) for s in submissions]
    }
