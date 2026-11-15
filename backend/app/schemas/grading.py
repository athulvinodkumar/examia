from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class ManualGradeAnswerRequest(BaseModel):
    score_awarded: float
    evaluation_notes: Optional[str] = None

class AIEvaluationRequest(BaseModel):
    student_answer_id: str

class AIEvaluationResponse(BaseModel):
    suggested_score: float
    max_score: float
    feedback: str
    strengths: List[str]
    weaknesses: List[str]
    confidence: float

class ReleaseResultsRequest(BaseModel):
    release: bool = True
