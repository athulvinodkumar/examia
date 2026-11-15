from datetime import datetime, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import Profile
from app.auth.jwt_handler import decode_access_token

security = HTTPBearer(auto_error=False)

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[Profile]:
    if not credentials:
        return None
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None

    user_id = payload.get("sub") or payload.get("id")
    email = payload.get("email")

    if not user_id and not email:
        return None

    # Find profile by ID or email
    profile = None
    if user_id:
        profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile and email:
        profile = db.query(Profile).filter(Profile.email == email).first()

    if not profile and email:
        # First time login provisioning
        role = payload.get("role", "student")
        if role not in ("teacher", "student", "admin"):
            role = "student"
        user_metadata = payload.get("user_metadata", {})
        full_name = user_metadata.get("full_name") or payload.get("name") or email.split("@")[0].title()
        avatar_url = user_metadata.get("avatar_url") or payload.get("picture")

        profile = Profile(
            id=user_id or None,
            email=email,
            full_name=full_name,
            avatar_url=avatar_url,
            role=role,
            last_login=datetime.now(timezone.utc)
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    elif profile:
        profile.last_login = datetime.now(timezone.utc)
        db.commit()

    return profile

async def get_current_user(
    user: Optional[Profile] = Depends(get_current_user_optional)
) -> Profile:
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided or are invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

async def require_teacher(
    current_user: Profile = Depends(get_current_user)
) -> Profile:
    # Unified platform: all authenticated users have full platform capabilities
    return current_user

async def require_student(
    current_user: Profile = Depends(get_current_user)
) -> Profile:
    return current_user

async def require_admin(
    current_user: Profile = Depends(get_current_user)
) -> Profile:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Administrator privilege required"
        )
    return current_user
