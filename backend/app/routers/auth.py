import re
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.config import settings
from app.models.user import Profile
from app.auth.jwt_handler import create_access_token
from app.auth.dependencies import get_current_user
from app.auth.password_utils import hash_password, verify_password
from app.schemas.auth import (
    DemoLoginRequest,
    AuthCallbackRequest,
    ManualRegisterRequest,
    ManualLoginRequest,
    CompleteOnboardingRequest,
    UserProfileUpdate,
    TokenResponse
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def sanitize_username(raw: str) -> str:
    """Normalizes and validates username string (alphanumeric, underscore, hyphen)"""
    cleaned = re.sub(r"[^a-zA-Z0-9_\-]", "", raw.strip().lower())
    return cleaned[:30]


@router.get("/public-config")
async def get_public_auth_config():
    """Returns safe client-side config for Supabase OAuth initialization"""
    return {
        "supabase_url": settings.supabase_url or "",
        "supabase_anon_key": settings.supabase_anon_key or "",
        "app_env": settings.app_env
    }


@router.get("/me")
async def get_my_profile(current_user: Profile = Depends(get_current_user)):
    return {
        "status": "success",
        "user": current_user.to_dict()
    }


@router.get("/check-username")
async def check_username_availability(
    username: str = Query(..., min_length=3, max_length=30),
    db: Session = Depends(get_db)
):
    """Checks if a chosen username is available for registration or onboarding"""
    clean = sanitize_username(username)
    if len(clean) < 3:
        return {"available": False, "username": clean, "reason": "Username must be at least 3 characters"}

    existing = db.query(Profile).filter(Profile.username == clean).first()
    return {
        "available": existing is None,
        "username": clean
    }


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def manual_register(data: ManualRegisterRequest, db: Session = Depends(get_db)):
    """
    Manually creates a new Examia account with email, password, role, name,
    username, and school/institution details.
    """
    clean_email = data.email.strip().lower()
    clean_user = sanitize_username(data.username)

    if len(clean_user) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 alphanumeric characters (letters, numbers, underscores)."
        )

    # Check if email already registered
    if db.query(Profile).filter(Profile.email == clean_email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in."
        )

    # Check if username already taken
    if db.query(Profile).filter(Profile.username == clean_user).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The username '@{clean_user}' is already taken. Please pick another."
        )

    role = (data.role or "user").lower()
    hashed_pw = hash_password(data.password)

    profile = Profile(
        id=str(uuid.uuid4()),
        email=clean_email,
        username=clean_user,
        password_hash=hashed_pw,
        full_name=data.full_name.strip(),
        role=role,
        avatar_url=f"https://api.dicebear.com/7.x/bottts/svg?seed={clean_user}",
        school_organization=data.school_organization.strip() if data.school_organization else "Examia Academy",
        department=data.department.strip() if data.department else None,
        phone=data.phone.strip() if data.phone else None,
        is_onboarded=True,
        created_at=datetime.now(timezone.utc),
        last_login=datetime.now(timezone.utc)
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    token = create_access_token({
        "sub": str(profile.id),
        "email": profile.email,
        "role": profile.role,
        "name": profile.full_name,
        "username": profile.username
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": profile.to_dict()
    }


@router.post("/login", response_model=TokenResponse)
async def manual_login(data: ManualLoginRequest, db: Session = Depends(get_db)):
    """
    Manually authenticates using email (or username) and password.
    """
    login_str = data.login.strip().lower()

    # Find user by email or username
    profile = db.query(Profile).filter(
        or_(Profile.email == login_str, Profile.username == login_str)
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify your email/username and password."
        )

    if not profile.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account was registered using Google Sign-In. Please sign in with Google."
        )

    if not verify_password(data.password, profile.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify your email/username and password."
        )

    profile.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(profile)

    token = create_access_token({
        "sub": str(profile.id),
        "email": profile.email,
        "role": profile.role,
        "name": profile.full_name,
        "username": profile.username
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": profile.to_dict()
    }


@router.post("/complete-onboarding", response_model=TokenResponse)
async def complete_onboarding(
    data: CompleteOnboardingRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Called after Google Login (or when updating initial profile) to set
    role (Teacher or Student), Full Name, Username, and School/Institution details.
    """
    clean_user = sanitize_username(data.username)
    if len(clean_user) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters long."
        )

    # Check if username is already taken by another user
    existing = db.query(Profile).filter(
        Profile.username == clean_user,
        Profile.id != current_user.id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '@{clean_user}' is already taken. Please choose another username."
        )

    role = (data.role or current_user.role or "user").lower()
    current_user.role = role

    current_user.role = role
    current_user.full_name = data.full_name.strip()
    current_user.username = clean_user
    current_user.school_organization = data.school_organization.strip() if data.school_organization else current_user.school_organization
    current_user.department = data.department.strip() if data.department else current_user.department
    current_user.phone = data.phone.strip() if data.phone else current_user.phone
    current_user.is_onboarded = True
    current_user.last_login = datetime.now(timezone.utc)

    db.commit()
    db.refresh(current_user)

    # Issue refreshed token with updated role and name
    token = create_access_token({
        "sub": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
        "name": current_user.full_name,
        "username": current_user.username
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": current_user.to_dict()
    }


@router.post("/demo-login", response_model=TokenResponse)
async def demo_login(data: DemoLoginRequest, db: Session = Depends(get_db)):
    """One-click instant login for teachers, students, and admins for seamless testing & local development"""
    role = data.role.lower()
    if role not in ("teacher", "student", "admin"):
        role = "teacher"

    clean_email = data.email.strip().lower()
    profile = db.query(Profile).filter(Profile.email == clean_email).first()
    default_user = sanitize_username(data.username or clean_email.split("@")[0])

    if not profile:
        profile = Profile(
            id=str(uuid.uuid4()),
            email=clean_email,
            username=default_user,
            full_name=data.full_name or clean_email.split("@")[0].replace(".", " ").title(),
            role=role,
            avatar_url=f"https://api.dicebear.com/7.x/bottts/svg?seed={clean_email}",
            school_organization="Examia Academy",
            is_onboarded=True,
            created_at=datetime.now(timezone.utc),
            last_login=datetime.now(timezone.utc)
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    else:
        profile.last_login = datetime.now(timezone.utc)
        profile.is_onboarded = True
        if not profile.username:
            profile.username = default_user
        if data.role:
            profile.role = role
        db.commit()
        db.refresh(profile)

    token = create_access_token({
        "sub": str(profile.id),
        "email": profile.email,
        "role": profile.role,
        "name": profile.full_name,
        "username": profile.username
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": profile.to_dict()
    }


@router.post("/callback", response_model=TokenResponse)
async def auth_callback(data: AuthCallbackRequest, db: Session = Depends(get_db)):
    """Handles Google OAuth callback from Supabase frontend client"""
    from app.auth.jwt_handler import decode_access_token
    payload = decode_access_token(data.access_token)
    
    email = data.email
    user_id = None
    full_name = data.full_name
    avatar_url = None

    if payload:
        user_id = payload.get("sub") or payload.get("id")
        email = email or payload.get("email")
        user_meta = payload.get("user_metadata", {})
        full_name = full_name or user_meta.get("full_name") or payload.get("name")
        avatar_url = user_meta.get("avatar_url") or payload.get("picture")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to verify user email from OAuth callback"
        )

    clean_email = email.strip().lower()
    profile = db.query(Profile).filter(Profile.email == clean_email).first()

    if not profile:
        # Generate initial username candidate from email or full name
        candidate_username = sanitize_username(clean_email.split("@")[0])
        # If candidate username exists, make it unique
        existing_u = db.query(Profile).filter(Profile.username == candidate_username).first()
        if existing_u:
            candidate_username = f"{candidate_username}_{uuid.uuid4().hex[:4]}"

        # New Google user: NOT onboarded yet! Must ask role, name, username, and basic details!
        profile = Profile(
            id=user_id or str(uuid.uuid4()),
            email=clean_email,
            username=candidate_username,
            full_name=full_name or clean_email.split("@")[0].title(),
            avatar_url=avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={clean_email}",
            role=data.role or "user",
            is_onboarded=False,  # Explicitly requires onboarding!
            created_at=datetime.now(timezone.utc),
            last_login=datetime.now(timezone.utc)
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    else:
        if full_name and not profile.full_name:
            profile.full_name = full_name
        if avatar_url and not profile.avatar_url:
            profile.avatar_url = avatar_url
        profile.last_login = datetime.now(timezone.utc)
        db.commit()
        db.refresh(profile)

    # Issue application JWT token
    token = create_access_token({
        "sub": str(profile.id),
        "email": profile.email,
        "role": profile.role,
        "name": profile.full_name,
        "username": profile.username
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": profile.to_dict()
    }


@router.put("/profile")
async def update_profile(
    data: UserProfileUpdate,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if data.full_name is not None:
        current_user.full_name = data.full_name.strip()
    if data.username is not None:
        clean_user = sanitize_username(data.username)
        if len(clean_user) >= 3:
            existing = db.query(Profile).filter(
                Profile.username == clean_user,
                Profile.id != current_user.id
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail="Username is already taken")
            current_user.username = clean_user
    if data.school_organization is not None:
        current_user.school_organization = data.school_organization.strip()
    if data.department is not None:
        current_user.department = data.department.strip()
    if data.phone is not None:
        current_user.phone = data.phone.strip()
    if data.preferences is not None:
        current_prefs = current_user.preferences or {}
        current_prefs.update(data.preferences)
        current_user.preferences = current_prefs

    db.commit()
    db.refresh(current_user)
    return {
        "status": "success",
        "user": current_user.to_dict()
    }
