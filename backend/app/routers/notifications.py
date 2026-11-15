from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import Profile
from app.models.notification import Notification
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("")
async def get_notifications(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notifs = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(desc(Notification.created_at)).limit(50).all()

    unread_count = sum(1 for n in notifs if not n.is_read)

    return {
        "status": "success",
        "unread_count": unread_count,
        "notifications": [n.to_dict() for n in notifs]
    }

@router.put("/{notif_id}/read")
async def mark_notification_read(
    notif_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notif = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id
    ).first()

    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    db.commit()

    return {"status": "success", "message": "Notification marked as read."}

@router.post("/mark-all-read")
async def mark_all_notifications_read(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()

    return {"status": "success", "message": "All notifications marked as read."}
