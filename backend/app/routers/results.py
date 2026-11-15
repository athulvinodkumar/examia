from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import Profile
from app.models.submission import Submission
from app.models.exam import Exam
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/results", tags=["Results"])

@router.get("/my-results")
async def get_my_results(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Student dashboard: list of all examinations taken by this student"""
    submissions = db.query(Submission).filter(
        Submission.student_id == current_user.id
    ).order_by(desc(Submission.created_at)).all()

    results_list = []
    for sub in submissions:
        exam = sub.exam
        item = {
            "submission_id": str(sub.id),
            "exam_id": str(exam.id),
            "exam_title": exam.title,
            "subject": exam.subject,
            "status": sub.status,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
            "results_released": sub.results_released
        }
        if sub.results_released:
            item["score_obtained"] = sub.score_obtained
            item["total_possible"] = sub.total_possible
            item["percentage"] = sub.percentage
            item["passed"] = sub.passed
            item["feedback"] = sub.feedback
        results_list.append(item)

    return {
        "status": "success",
        "count": len(results_list),
        "results": results_list
    }

@router.get("/submissions/{submission_id}")
async def get_submission_result_detail(
    submission_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Detailed score report for student or teacher"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    exam = submission.exam
    is_owner = (str(submission.student_id) == str(current_user.id))
    is_teacher = (str(exam.teacher_id) == str(current_user.id) or current_user.role == "admin")

    if not is_owner and not is_teacher:
        raise HTTPException(status_code=403, detail="Unauthorized to view this submission result")

    # If student is checking and results are not released, block unreleased marks
    if is_owner and not is_teacher and not submission.results_released:
        return {
            "status": "pending_release",
            "message": "Your answers have been recorded. Results will be available once released by your teacher.",
            "submission_id": str(submission.id),
            "exam_title": exam.title,
            "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None
        }

    reveal_answers = is_teacher or (submission.results_released and exam.show_correct_answers)
    reveal_explanations = is_teacher or (submission.results_released and exam.show_explanations)

    # Detailed per-question answer breakdown
    q_map = {str(q.id): q for q in exam.questions}
    detailed_answers = []

    for ans in submission.answers:
        q = q_map.get(str(ans.question_id))
        if not q:
            continue

        item = {
            "question_id": str(q.id),
            "question_number": q.question_number,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "marks": q.marks,
            "score_awarded": ans.score_awarded,
            "is_evaluated": ans.is_evaluated,
            "evaluation_notes": ans.evaluation_notes,
            "student_selected_option_ids": ans.selected_option_ids or [],
            "student_text_answer": ans.text_answer,
            "student_numerical_answer": ans.numerical_answer,
            "options": [opt.to_dict(public_view=not reveal_answers) for opt in q.options]
        }

        if reveal_answers:
            item["numerical_expected"] = q.numerical_expected
            item["accepted_answers"] = q.accepted_answers or []
            item["sample_solution"] = q.sample_solution

        if reveal_explanations:
            item["explanation"] = q.explanation

        detailed_answers.append(item)

    return {
        "status": "success",
        "submission_id": str(submission.id),
        "exam_title": exam.title,
        "student_name": submission.student.full_name if submission.student else "Candidate",
        "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
        "time_spent_seconds": submission.time_spent_seconds,
        "score_obtained": submission.score_obtained,
        "total_possible": submission.total_possible,
        "percentage": submission.percentage,
        "passed": submission.passed,
        "feedback": submission.feedback,
        "questions": detailed_answers
    }
