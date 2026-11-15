import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database import Base, GUID

class UploadedPaper(Base):
    __tablename__ = "uploaded_papers"

    id = Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    teacher_id = Column(GUID(), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    storage_path = Column(Text, nullable=False)
    document_type = Column(String(50), nullable=False, default="question_paper")  # question_paper, syllabus_content
    status = Column(String(50), nullable=False, default="uploaded")  # uploaded, processing, extracted, analyzed, failed
    extracted_data = Column(JSON, nullable=True)
    extracted_question_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    teacher = relationship("Profile", backref="uploaded_papers")

    def to_dict(self):
        return {
            "id": str(self.id),
            "teacher_id": str(self.teacher_id),
            "filename": self.filename,
            "original_filename": self.original_filename,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "document_type": getattr(self, "document_type", "question_paper"),
            "status": self.status,
            "extracted_question_count": self.extracted_question_count,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
