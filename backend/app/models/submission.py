import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base, GUID

class Submission(Base):
    __tablename__ = "submissions"

    id = Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    exam_id = Column(GUID(), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(GUID(), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    session_token = Column(String(64), unique=True, nullable=False, index=True)
    status = Column(String(50), nullable=False, default="in_progress", index=True)  # in_progress, submitted, graded, pending_review
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    submitted_at = Column(DateTime, nullable=True)
    time_spent_seconds = Column(Integer, nullable=False, default=0)
    score_obtained = Column(Float, nullable=True)
    total_possible = Column(Float, nullable=True)
    percentage = Column(Float, nullable=True)
    passed = Column(Boolean, nullable=True)
    feedback = Column(Text, nullable=True)
    results_released = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    exam = relationship("Exam", back_populates="submissions")
    student = relationship("Profile", backref="exam_submissions")
    answers = relationship("StudentAnswer", back_populates="submission", cascade="all, delete-orphan")

    def to_dict(self, include_answers: bool = False, reveal_results: bool = False):
        data = {
            "id": str(self.id),
            "exam_id": str(self.exam_id),
            "student_id": str(self.student_id),
            "student_name": self.student.full_name if self.student else "Student",
            "student_email": self.student.email if self.student else "",
            "session_token": self.session_token,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "time_spent_seconds": self.time_spent_seconds,
            "results_released": self.results_released,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

        # Results only included if released or requested by teacher
        if reveal_results or self.results_released:
            data["score_obtained"] = self.score_obtained
            data["total_possible"] = self.total_possible
            data["percentage"] = self.percentage
            data["passed"] = self.passed
            data["feedback"] = self.feedback

        if include_answers:
            data["answers"] = [ans.to_dict(reveal_grading=reveal_results or self.results_released) for ans in self.answers]

        return data


class StudentAnswer(Base):
    __tablename__ = "student_answers"
    __table_args__ = (
        UniqueConstraint('submission_id', 'question_id', name='uq_submission_question'),
    )

    id = Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(GUID(), ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(GUID(), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    selected_option_ids = Column(JSON, nullable=True)  # List of UUID strings
    text_answer = Column(Text, nullable=True)
    numerical_answer = Column(Float, nullable=True)
    is_flagged = Column(Boolean, nullable=False, default=False)
    score_awarded = Column(Float, nullable=True)
    is_evaluated = Column(Boolean, nullable=False, default=False)
    evaluation_notes = Column(Text, nullable=True)
    ai_suggested_score = Column(Float, nullable=True)
    ai_feedback = Column(Text, nullable=True)
    last_saved_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    sequence_number = Column(Integer, nullable=False, default=1)

    submission = relationship("Submission", back_populates="answers")
    question = relationship("Question", back_populates="student_answers")

    def to_dict(self, reveal_grading: bool = False):
        data = {
            "id": str(self.id),
            "submission_id": str(self.submission_id),
            "question_id": str(self.question_id),
            "selected_option_ids": self.selected_option_ids or [],
            "text_answer": self.text_answer,
            "numerical_answer": self.numerical_answer,
            "is_flagged": self.is_flagged,
            "sequence_number": self.sequence_number,
            "last_saved_at": self.last_saved_at.isoformat() if self.last_saved_at else None
        }
        if reveal_grading:
            data["score_awarded"] = self.score_awarded
            data["is_evaluated"] = self.is_evaluated
            data["evaluation_notes"] = self.evaluation_notes
            data["ai_suggested_score"] = self.ai_suggested_score
            data["ai_feedback"] = self.ai_feedback
        return data
