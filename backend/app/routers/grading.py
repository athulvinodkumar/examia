from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import Profile
from app.models.exam import Exam
from app.models.submission import Submission, StudentAnswer
from app.auth.dependencies import require_teacher
from app.schemas.grading import ManualGradeAnswerRequest, ReleaseResultsRequest
from app.services.gemini_service import GeminiService
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/grading", tags=["Grading & Evaluation"])

@router.put("/answers/{answer_id}")
async def manual_grade_answer(
    answer_id: str,
    data: ManualGradeAnswerRequest,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Teacher manually assigns or overrides marks and feedback for a student answer"""
    student_ans = db.query(StudentAnswer).filter(StudentAnswer.id == answer_id).first()
    if not student_ans:
        raise HTTPException(status_code=404, detail="Student answer not found")

    submission = student_ans.submission
    exam = submission.exam

    if str(exam.teacher_id) != str(current_user.id) and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized to grade this submission")

    question = student_ans.question
    max_marks = float(question.marks)

    # Validate score
    score = float(data.score_awarded)
    if score < 0 or score > max_marks:
        raise HTTPException(
            status_code=400,
            detail=f"Score awarded ({score}) must be between 0.0 and maximum marks ({max_marks})."
        )

    student_ans.score_awarded = score
    student_ans.evaluation_notes = data.evaluation_notes
    student_ans.is_evaluated = True

    # Recalculate submission total score
    total_obtained = sum(float(a.score_awarded or 0.0) for a in submission.answers)
    total_possible = float(exam.total_marks) or sum(float(q.marks) for q in exam.questions) or 100.0

    submission.score_obtained = round(total_obtained, 2)
    submission.total_possible = round(total_possible, 2)
    submission.percentage = round((total_obtained / total_possible) * 100.0, 2)
    submission.passed = submission.percentage >= 40.0

    # Check if any answers remain un-evaluated
    unevaluated = any(a.is_evaluated is False for a in submission.answers)
    submission.status = "pending_review" if unevaluated else "graded"

    submission.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "status": "success",
        "answer_id": str(student_ans.id),
        "score_awarded": student_ans.score_awarded,
        "evaluation_notes": student_ans.evaluation_notes,
        "submission_score": submission.score_obtained,
        "submission_percentage": submission.percentage,
        "submission_status": submission.status
    }

@router.post("/answers/{answer_id}/ai-evaluate")
async def ai_evaluate_descriptive_answer(
    answer_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Triggers Gemini AI evaluation for a descriptive or essay answer against teacher rubric"""
    student_ans = db.query(StudentAnswer).filter(StudentAnswer.id == answer_id).first()
    if not student_ans:
        raise HTTPException(status_code=404, detail="Student answer not found")

    submission = student_ans.submission
    exam = submission.exam

    if str(exam.teacher_id) != str(current_user.id) and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")

    question = student_ans.question
    student_text = student_ans.text_answer or ""
    if not student_text.strip():
        return {
            "status": "success",
            "evaluation": {
                "suggested_score": 0.0,
                "max_score": float(question.marks),
                "confidence": 1.0,
                "feedback": "No answer was provided by the candidate.",
                "strengths": [],
                "weaknesses": ["Blank response."]
            }
        }

    ai_result = GeminiService.evaluate_descriptive_answer(
        question_text=question.question_text,
        max_marks=float(question.marks),
        student_answer=student_text,
        sample_solution=question.sample_solution,
        rubric=question.descriptive_rubric
    )

    # Store suggestion on record
    student_ans.ai_suggested_score = ai_result.get("suggested_score")
    student_ans.ai_feedback = ai_result.get("feedback")
    db.commit()

    return {
        "status": "success",
        "evaluation": ai_result
    }

@router.post("/exams/{exam_id}/release-results")
async def release_exam_results(
    exam_id: str,
    data: ReleaseResultsRequest,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Teacher releases examination results so students can view scores and feedback"""
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found or unauthorized")

    submissions = db.query(Submission).filter(Submission.exam_id == exam.id).all()
    count = 0
    for sub in submissions:
        sub.results_released = data.release
        sub.updated_at = datetime.now(timezone.utc)
        count += 1
        
        # Notify student if user account is linked
        if sub.student_id:
            NotificationService.create_notification(
                db,
                user_id=str(sub.student_id),
                title=f"Results Released: {exam.title}",
                message=f"Results for '{exam.title}' have been published by your teacher. Your score: {sub.score_obtained}/{sub.total_possible} ({sub.percentage}%).",
                notif_type="result_ready",
                action_url=f"/app.html#results/{sub.id}"
            )

    exam.result_visibility = "immediate" if data.release else "manual"
    db.commit()

    return {
        "status": "success",
        "message": f"Results {'released' if data.release else 'hidden'} for {count} candidate submission(s)."
    }
