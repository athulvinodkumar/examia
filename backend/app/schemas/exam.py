from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.question import QuestionBase

class ExamSectionSchema(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = ""
    order_index: int = 0

class ExamCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    subject: Optional[str] = ""
    class_group: Optional[str] = ""
    instructions: Optional[str] = ""
    duration_minutes: int = 60
    total_marks: float = 0.0
    paper_id: Optional[str] = None

class ExamSettingsUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    class_group: Optional[str] = None
    instructions: Optional[str] = None
    duration_minutes: Optional[int] = None
    total_marks: Optional[float] = None
    access_policy: Optional[str] = None  # public_link, passcode, restricted, invitation_only
    passcode: Optional[str] = None
    max_attempts: Optional[int] = None
    late_submission_policy: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    shuffle_questions: Optional[bool] = None
    shuffle_options: Optional[bool] = None
    allow_navigation: Optional[bool] = None
    show_marks_per_question: Optional[bool] = None
    negative_marking_enabled: Optional[bool] = None
    partial_marking_enabled: Optional[bool] = None
    grading_mode: Optional[str] = None  # automatic, manual, ai_assisted
    numerical_tolerance: Optional[float] = None
    result_visibility: Optional[str] = None  # immediate, manual, scheduled
    result_release_time: Optional[datetime] = None
    show_correct_answers: Optional[bool] = None
    show_explanations: Optional[bool] = None
    show_question_marks: Optional[bool] = None

class ExamPublishResponse(BaseModel):
    id: str
    title: str
    status: str
    invitation_token: str
    invitation_url: str
    qr_code_base64: str
    question_count: int
    total_marks: float
    duration_minutes: int
    share_text: str
    whatsapp_url: str
    email_url: str
