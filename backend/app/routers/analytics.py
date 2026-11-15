import io
import csv
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.database import get_db
from app.models.user import Profile
from app.models.exam import Exam
from app.models.question import Question
from app.models.submission import Submission, StudentAnswer
from app.auth.dependencies import require_teacher

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/teacher-overview")
async def get_teacher_overview(
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Real database-backed overview statistics for teacher dashboard"""
    exams = db.query(Exam).filter(Exam.teacher_id == current_user.id).all()
    total_exams = len(exams)
    published_exams = sum(1 for e in exams if e.status in ("published", "active", "completed"))
    draft_exams = sum(1 for e in exams if e.status in ("draft", "ready_for_review", "processing"))

    exam_ids = [e.id for e in exams]
    submissions = db.query(Submission).filter(Submission.exam_id.in_(exam_ids)).all() if exam_ids else []
    total_submissions = len(submissions)

    # Unique students
    student_ids = set(s.student_id for s in submissions)
    total_students = len(student_ids)

    # Average score across graded submissions
    graded_scores = [s.percentage for s in submissions if s.percentage is not None and s.status in ("graded", "submitted")]
    avg_score = round(sum(graded_scores) / len(graded_scores), 1) if graded_scores else 0.0

    # Recent activities (recent submissions and recent published exams)
    recent_activities = []
    for sub in sorted(submissions, key=lambda s: s.created_at, reverse=True)[:5]:
        exam = next((e for e in exams if e.id == sub.exam_id), None)
        recent_activities.append({
            "type": "submission",
            "title": f"Submission by {sub.student.full_name if sub.student else 'Candidate'}",
            "description": f"Completed '{exam.title if exam else 'Exam'}' with {sub.score_obtained or 0}/{sub.total_possible or 0} marks",
            "timestamp": sub.submitted_at.isoformat() if sub.submitted_at else sub.created_at.isoformat()
        })

    for e in sorted(exams, key=lambda ex: ex.created_at, reverse=True)[:3]:
        recent_activities.append({
            "type": "exam_created",
            "title": f"Exam: {e.title}",
            "description": f"Status: {e.status.replace('_', ' ').title()} • {len(e.questions)} Questions",
            "timestamp": e.created_at.isoformat()
        })

    recent_activities.sort(key=lambda x: x["timestamp"], reverse=True)

    # Upcoming or active exams
    upcoming = [e.to_dict(include_questions=False, public_view=False) for e in exams if e.status in ("published", "scheduled", "active")][:5]

    return {
        "status": "success",
        "stats": {
            "total_exams": total_exams,
            "published_exams": published_exams,
            "draft_exams": draft_exams,
            "total_students": total_students,
            "total_submissions": total_submissions,
            "average_score": avg_score
        },
        "recent_activities": recent_activities[:6],
        "upcoming_exams": upcoming
    }

@router.get("/exams/{exam_id}")
async def get_exam_analytics(
    exam_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Detailed analytics, score distributions, and question item analysis for a specific exam"""
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found or unauthorized")

    submissions = db.query(Submission).filter(Submission.exam_id == exam.id).all()
    total_submissions = len(submissions)
    graded_subs = [s for s in submissions if s.score_obtained is not None and s.status in ("submitted", "graded", "pending_review")]

    scores = [s.score_obtained for s in graded_subs]
    percentages = [s.percentage for s in graded_subs]

    avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0
    high_score = max(scores) if scores else 0.0
    low_score = min(scores) if scores else 0.0
    pass_count = sum(1 for s in graded_subs if s.passed)
    pass_rate = round((pass_count / len(graded_subs)) * 100.0, 1) if graded_subs else 0.0

    # Score Distribution Bins (0-20%, 21-40%, 41-60%, 61-80%, 81-100%)
    bins = {
        "0-20%": 0,
        "21-40%": 0,
        "41-60%": 0,
        "61-80%": 0,
        "81-100%": 0
    }
    for pct in percentages:
        if pct <= 20:
            bins["0-20%"] += 1
        elif pct <= 40:
            bins["21-40%"] += 1
        elif pct <= 60:
            bins["41-60%"] += 1
        elif pct <= 80:
            bins["61-80%"] += 1
        else:
            bins["81-100%"] += 1

    # Question-wise item analysis
    questions_analysis = []
    difficult_questions = []

    for q in exam.questions:
        q_ans = db.query(StudentAnswer).join(Submission).filter(
            Submission.exam_id == exam.id,
            StudentAnswer.question_id == q.id
        ).all()

        total_attempts = len(q_ans)
        max_marks = float(q.marks)
        total_score_awarded = sum(float(a.score_awarded or 0.0) for a in q_ans)
        avg_q_score = round(total_score_awarded / total_attempts, 2) if total_attempts else 0.0
        success_rate = round((avg_q_score / max_marks) * 100.0, 1) if max_marks > 0 and total_attempts else 0.0

        item = {
            "question_id": str(q.id),
            "question_number": q.question_number,
            "question_text": q.question_text[:80] + ("..." if len(q.question_text) > 80 else ""),
            "question_type": q.question_type,
            "marks": max_marks,
            "total_attempts": total_attempts,
            "average_score": avg_q_score,
            "success_rate": success_rate
        }
        questions_analysis.append(item)

        if total_attempts >= 1 and success_rate < 50.0:
            difficult_questions.append(item)

    difficult_questions.sort(key=lambda x: x["success_rate"])

    # Student leaderboards / summaries
    student_reports = []
    for sub in submissions:
        student_reports.append({
            "submission_id": str(sub.id),
            "student_name": sub.student.full_name if sub.student else "Candidate",
            "student_email": sub.student.email if sub.student else "",
            "score_obtained": sub.score_obtained,
            "total_possible": sub.total_possible,
            "percentage": sub.percentage,
            "passed": sub.passed,
            "status": sub.status,
            "time_spent_seconds": sub.time_spent_seconds,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None
        })

    student_reports.sort(key=lambda x: (x["score_obtained"] or 0), reverse=True)

    return {
        "status": "success",
        "exam_title": exam.title,
        "total_marks": exam.total_marks,
        "summary": {
            "total_submissions": total_submissions,
            "average_score": avg_score,
            "highest_score": high_score,
            "lowest_score": low_score,
            "pass_rate": pass_rate
        },
        "score_distribution": bins,
        "questions_analysis": questions_analysis,
        "difficult_questions": difficult_questions[:5],
        "student_reports": student_reports
    }

@router.get("/exams/{exam_id}/export-csv")
async def export_exam_csv(
    exam_id: str,
    current_user: Profile = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Export complete student performance and question marks to CSV"""
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found or unauthorized")

    submissions = db.query(Submission).filter(Submission.exam_id == exam.id).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    q_headers = [f"Q{q.question_number} ({q.marks}m)" for q in exam.questions]
    writer.writerow([
        "Student Name",
        "Student Email",
        "Status",
        "Score Obtained",
        "Total Marks",
        "Percentage",
        "Result",
        "Time Spent (mins)",
        "Submitted At"
    ] + q_headers)

    for sub in submissions:
        ans_map = {str(a.question_id): a.score_awarded for a in sub.answers}
        row = [
            sub.student.full_name if sub.student else "Candidate",
            sub.student.email if sub.student else "",
            sub.status,
            sub.score_obtained if sub.score_obtained is not None else "",
            sub.total_possible if sub.total_possible is not None else "",
            f"{sub.percentage}%" if sub.percentage is not None else "",
            "Passed" if sub.passed else ("Failed" if sub.passed is False else "Pending"),
            round(sub.time_spent_seconds / 60, 1),
            sub.submitted_at.strftime("%Y-%m-%d %H:%M") if sub.submitted_at else ""
        ]
        # Per question score
        for q in exam.questions:
            score = ans_map.get(str(q.id))
            row.append(score if score is not None else "-")

        writer.writerow(row)

    csv_data = output.getvalue()
    filename = f"examia_results_{exam.title.replace(' ', '_')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
