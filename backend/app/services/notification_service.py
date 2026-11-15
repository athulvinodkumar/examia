import uuid
from typing import Optional
from sqlalchemy.orm import Session
from app.models.notification import Notification

class NotificationService:
    @staticmethod
    def create_notification(
        db: Session,
        user_id: str,
        title: str,
        message: str,
        notif_type: str = "system",
        action_url: Optional[str] = None
    ) -> Notification:
        notif = Notification(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=title,
            message=message,
            type=notif_type,
            action_url=action_url,
            is_read=False
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return notif
