import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database import Base, GUID

class Question(Base):
    __tablename__ = "questions"

    id = Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    exam_id = Column(GUID(), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id = Column(GUID(), ForeignKey("exam_sections.id", ondelete="SET NULL"), nullable=True, index=True)
    question_number = Column(Integer, nullable=False, default=1)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), nullable=False)  # mcq_single, mcq_multiple, true_false, numerical, short_answer, descriptive, fill_blank
    marks = Column(Float, nullable=False, default=1.0)
    negative_marks = Column(Float, nullable=False, default=0.0)
    
    # Answers and Keys (Protected!)
    numerical_expected = Column(Float, nullable=True)
    numerical_tolerance = Column(Float, nullable=True, default=0.0)
    accepted_answers = Column(JSON, nullable=True)  # List of strings for short_answer / fill_blank
    descriptive_rubric = Column(Text, nullable=True)
    sample_solution = Column(Text, nullable=True)
    explanation = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    confidence_score = Column(Float, nullable=False, default=0.95)
    subquestions = Column(JSON, nullable=True)
    source_metadata = Column(JSON, nullable=True)
    review_status = Column(String(50), nullable=False, default="needs_review")  # needs_review, verified
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    exam = relationship("Exam", back_populates="questions")
    section = relationship("ExamSection", back_populates="questions")
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan", order_by="QuestionOption.order_index")
    student_answers = relationship("StudentAnswer", back_populates="question", cascade="all, delete-orphan")

    def to_dict(self, public_view: bool = False, reveal_answers: bool = False):
        data = {
            "id": str(self.id),
            "exam_id": str(self.exam_id),
            "section_id": str(self.section_id) if self.section_id else None,
            "question_number": self.question_number,
            "question_text": self.question_text,
            "question_type": self.question_type,
            "marks": self.marks,
            "negative_marks": self.negative_marks,
            "image_url": self.image_url,
            "order_index": self.order_index,
            "confidence_score": self.confidence_score if self.confidence_score is not None else 0.95,
            "subquestions": self.subquestions or [],
            "review_status": self.review_status,
            "options": [opt.to_dict(public_view=public_view and not reveal_answers) for opt in self.options]
        }

        # If it's a teacher view or allowed results view, reveal answer keys & grading config
        if not public_view or reveal_answers:
            data["numerical_expected"] = self.numerical_expected
            data["numerical_tolerance"] = self.numerical_tolerance
            data["accepted_answers"] = self.accepted_answers or []
            data["descriptive_rubric"] = self.descriptive_rubric
            data["sample_solution"] = self.sample_solution
            data["explanation"] = self.explanation

        return data


class QuestionOption(Base):
    __tablename__ = "question_options"

    id = Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(GUID(), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    option_label = Column(String(10), nullable=False)  # A, B, C, D
    option_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False, default=False)
    order_index = Column(Integer, nullable=False, default=0)

    question = relationship("Question", back_populates="options")

    def to_dict(self, public_view: bool = False):
        data = {
            "id": str(self.id),
            "question_id": str(self.question_id),
            "option_label": self.option_label,
            "option_text": self.option_text,
            "order_index": self.order_index
        }
        if not public_view:
            data["is_correct"] = self.is_correct
        return data
