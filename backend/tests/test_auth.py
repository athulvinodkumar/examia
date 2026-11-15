import uuid
import pytest
from app.auth.jwt_handler import create_access_token, decode_access_token
from app.database import SessionLocal, init_db
from app.models.user import Profile
from app.auth.password_utils import hash_password, verify_password

def test_jwt_create_and_decode():
    data = {
        "sub": "user_uuid_12345",
        "email": "teacher@examia.io",
        "role": "teacher",
        "name": "Prof. Smith"
    }
    token = create_access_token(data)
    assert token is not None
    assert isinstance(token, str)

    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "user_uuid_12345"
    assert payload["email"] == "teacher@examia.io"
    assert payload["role"] == "teacher"

def test_password_hashing():
    pw = "SuperSecureExamia2026!"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPassword123", hashed) is False

def test_profile_username_and_onboarding_fields():
    init_db()
    db = SessionLocal()
    unique_suffix = uuid.uuid4().hex[:6]
    email = f"test_onboard_{unique_suffix}@examia.io"
    username = f"prof_{unique_suffix}"
    
    try:
        # Create un-onboarded profile
        profile = Profile(
            id=str(uuid.uuid4()),
            email=email,
            username=username,
            full_name="Dr. Alan Turing",
            role="teacher",
            is_onboarded=False
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

        assert profile.is_onboarded is False
        assert profile.username == username

        # Complete onboarding
        profile.role = "teacher"
        profile.school_organization = "Cambridge Department of Mathematics"
        profile.department = "Theoretical Computer Science"
        profile.is_onboarded = True
        db.commit()
        db.refresh(profile)

        d = profile.to_dict()
        assert d["is_onboarded"] is True
        assert d["school_organization"] == "Cambridge Department of Mathematics"
        assert d["department"] == "Theoretical Computer Science"
    finally:
        db.query(Profile).filter(Profile.email == email).delete()
        db.commit()
        db.close()
