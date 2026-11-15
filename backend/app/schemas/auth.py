from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field

class DemoLoginRequest(BaseModel):
    email: EmailStr
    role: str = "teacher"  # teacher, student, admin
    full_name: Optional[str] = None
    username: Optional[str] = None

class AuthCallbackRequest(BaseModel):
    access_token: str
    email: Optional[str] = None
    role: Optional[str] = None
    full_name: Optional[str] = None

class ManualRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: Optional[str] = "user"
    full_name: str = Field(..., min_length=1, max_length=100)
    username: str = Field(..., min_length=3, max_length=30)
    school_organization: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None

class ManualLoginRequest(BaseModel):
    login: str  # email or username
    password: str

class CompleteOnboardingRequest(BaseModel):
    role: Optional[str] = "user"
    full_name: str = Field(..., min_length=1, max_length=100)
    username: str = Field(..., min_length=3, max_length=30)
    school_organization: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    school_organization: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]
