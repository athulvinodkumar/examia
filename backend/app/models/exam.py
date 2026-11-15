import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base, GUID

class Exam(Base):
    __tablename__ = "exams"

    id = Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    teacher_id = Column(GUID(), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    paper_id = Column(GUID(), ForeignKey("uploaded_papers.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    subject = Column(String(100), nullable=True)
    class_group = Column(String(100), nullable=True)
    instructions = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="draft", index=True)
    total_marks = Column(Float, nullable=False, default=0.0)
    duration_minutes = Column(Integer, nullable=False, default=60)
    invitation_token = Column(String(64), unique=True, nullable=True, index=True)
    passcode = Column(String(100), nullable=True)
    access_policy = Column(String(50), nullable=False, default="public_link")  # public_link, passcode, restricted, invitation_only
    max_attempts = Column(Integer, nullable=False, default=1)
    late_submission_policy = Column(String(50), nullable=False, default="disallow")  # disallow, allow_with_flag, penalty
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    shuffle_questions = Column(Boolean, nullable=False, default=False)
    shuffle_options = Column(Boolean, nullable=False, default=False)
    allow_navigation = Column(Boolean, nullable=False, default=True)
    show_marks_per_question = Column(Boolean, nullable=False, default=True)
    negative_marking_enabled = Column(Boolean, nullable=False, default=False)
    partial_marking_enabled = Column(Boolean, nullable=False, default=False)
    grading_mode = Column(String(50), nullable=False, default="automatic")  # automatic, manual, ai_assisted
    numerical_tolerance = Column(Float, nullable=False, default=0.01)
    result_visibility = Column(String(50), nullable=False, default="immediate")  # immediate, manual, scheduled
    result_release_time = Column(DateTime, nullable=True)
    show_correct_answers = Column(Boolean, nullable=False, default=True)
    show_explanations = Column(Boolean, nullable=False, default=True)
    show_question_marks = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    teacher = relationship("Profile", backref="created_exams")
    paper = relationship("UploadedPaper", backref="associated_exams")
    sections = relationship("ExamSection", back_populates="exam", cascade="all, delete-orphan", order_by="ExamSection.order_index")
    questions = relationship("Question", back_populates="exam", cascade="all, delete-orphan", order_by="Question.order_index")
    submissions = relationship("Submission", back_populates="exam", cascade="all, delete-orphan")

    def to_dict(self, include_questions: bool = False, public_view: bool = False):
        data = {
            "id": str(self.id),
            "teacher_id": str(self.teacher_id),
            "paper_id": str(self.paper_id) if self.paper_id else None,
            "title": self.title,
            "description": self.description or "",
            "subject": self.subject or "",
            "class_group": self.class_group or "",
            "instructions": self.instructions or "",
            "status": self.status,
            "total_marks": self.total_marks,
            "duration_minutes": self.duration_minutes,
            "invitation_token": self.invitation_token,
            "access_policy": self.access_policy,
            "has_passcode": bool(self.passcode),
            "max_attempts": self.max_attempts,
            "late_submission_policy": self.late_submission_policy,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "shuffle_questions": self.shuffle_questions,
            "shuffle_options": self.shuffle_options,
            "allow_navigation": self.allow_navigation,
            "show_marks_per_question": self.show_marks_per_question,
            "negative_marking_enabled": self.negative_marking_enabled,
            "partial_marking_enabled": self.partial_marking_enabled,
            "grading_mode": self.grading_mode,
            "numerical_tolerance": self.numerical_tolerance,
            "result_visibility": self.result_visibility,
            "result_release_time": self.result_release_time.isoformat() if self.result_release_time else None,
            "show_correct_answers": self.show_correct_answers,
            "show_explanations": self.show_explanations,
            "show_question_marks": self.show_question_marks,
            "question_count": len(self.questions) if self.questions else 0,
            "submission_count": len(self.submissions) if self.submissions else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        if not public_view:
            data["passcode"] = self.passcode
        if include_questions:
            data["sections"] = [s.to_dict() for s in self.sections]
            data["questions"] = [q.to_dict(public_view=public_view) for q in self.questions]
        return data


class ExamSection(Base):
    __tablename__ = "exam_sections"

    id = Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    exam_id = Column(GUID(), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    exam = relationship("Exam", back_populates="sections")
    questions = relationship("Question", back_populates="section")

    def to_dict(self):
        return {
            "id": str(self.id),
            "exam_id": str(self.exam_id),
            "title": self.title,
            "description": self.description or "",
            "order_index": self.order_index
        }
