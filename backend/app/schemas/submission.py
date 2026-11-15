from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class SubmissionStartRequest(BaseModel):
    invitation_token: str
    passcode: Optional[str] = None
    student_name: Optional[str] = None
    student_id_number: Optional[str] = None

class AnswerSaveRequest(BaseModel):
    question_id: str
    selected_option_ids: Optional[List[str]] = None
    text_answer: Optional[str] = None
    numerical_answer: Optional[float] = None
    is_flagged: Optional[bool] = False
    sequence_number: int = 1

class SubmissionSubmitRequest(BaseModel):
    answers: Optional[List[AnswerSaveRequest]] = None
