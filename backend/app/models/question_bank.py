import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database import Base, GUID

class QuestionBank(Base):
    __tablename__ = "question_bank"

    id = Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    teacher_id = Column(GUID(), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    subject = Column(String(100), nullable=True, index=True)
    topic = Column(String(100), nullable=True)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), nullable=False)
    options = Column(JSON, nullable=True)
    correct_answer = Column(JSON, nullable=True)
    marks = Column(Float, nullable=False, default=1.0)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    teacher = relationship("Profile", backref="question_bank_items")

    def to_dict(self):
        return {
            "id": str(self.id),
            "teacher_id": str(self.teacher_id),
            "subject": self.subject or "",
            "topic": self.topic or "",
            "question_text": self.question_text,
            "question_type": self.question_type,
            "options": self.options or [],
            "correct_answer": self.correct_answer,
            "marks": self.marks,
            "explanation": self.explanation,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
