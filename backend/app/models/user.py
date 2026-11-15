import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, JSON
from app.database import Base, GUID

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    avatar_url = Column(String(1024), nullable=True)
    role = Column(String(50), nullable=False, default="student", index=True)  # teacher, student, admin
    school_organization = Column(String(255), nullable=True)
    department = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    is_onboarded = Column(Boolean, nullable=False, default=False)
    preferences = Column(JSON, default=lambda: {
        "sound_enabled": False,
        "dark_mode": False,
        "email_notifications": True
    })
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    last_login = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "email": self.email,
            "username": getattr(self, "username", None),
            "full_name": self.full_name or "",
            "avatar_url": self.avatar_url,
            "role": self.role,
            "school_organization": self.school_organization,
            "department": getattr(self, "department", None),
            "phone": getattr(self, "phone", None),
            "is_onboarded": bool(getattr(self, "is_onboarded", False)),
            "preferences": self.preferences or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None
        }
