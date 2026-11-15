import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base, GUID

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID(), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), nullable=False, default="system")  # exam_published, submission, result_ready, grading_complete, system
    action_url = Column(String(500), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("Profile", backref="notifications")

    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "title": self.title,
            "message": self.message,
            "type": self.type,
            "action_url": self.action_url,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
