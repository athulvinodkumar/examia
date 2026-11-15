from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class OptionSchema(BaseModel):
    id: Optional[str] = None
    option_label: str = Field(description="A, B, C, D...")
    option_text: str
    is_correct: bool = False
    order_index: int = 0

class QuestionBase(BaseModel):
    question_number: int = 1
    question_text: str
    question_type: str = "mcq_single"  # mcq_single, mcq_multiple, true_false, fill_blank, match_following, short_answer, long_answer, numerical, mathematical, diagram_based, assertion_reason, case_study
    marks: float = 1.0
    negative_marks: float = 0.0
    numerical_expected: Optional[float] = None
    numerical_tolerance: Optional[float] = 0.0
    accepted_answers: Optional[List[str]] = None
    descriptive_rubric: Optional[str] = None
    sample_solution: Optional[str] = None
    explanation: Optional[str] = None
    image_url: Optional[str] = None
    order_index: int = 0
    section_id: Optional[str] = None
    section_title: Optional[str] = None
    confidence_score: Optional[float] = 0.95
    subquestions: Optional[List[Dict[str, Any]]] = None
    confidence_breakdown: Optional[Dict[str, float]] = None
    review_status: str = "needs_review"  # needs_review, verified
    options: List[OptionSchema] = []

class QuestionCreate(QuestionBase):
    pass

class QuestionUpdate(BaseModel):
    question_number: Optional[int] = None
    question_text: Optional[str] = None
    question_type: Optional[str] = None
    marks: Optional[float] = None
    negative_marks: Optional[float] = None
    numerical_expected: Optional[float] = None
    numerical_tolerance: Optional[float] = None
    accepted_answers: Optional[List[str]] = None
    descriptive_rubric: Optional[str] = None
    sample_solution: Optional[str] = None
    explanation: Optional[str] = None
    image_url: Optional[str] = None
    order_index: Optional[int] = None
    section_id: Optional[str] = None
    confidence_score: Optional[float] = None
    subquestions: Optional[List[Dict[str, Any]]] = None
    review_status: Optional[str] = None
    options: Optional[List[OptionSchema]] = None

class QuestionExtractionOutput(BaseModel):
    """Schema for Gemini AI Question Extraction"""
    questions: List[QuestionBase]
    confidence_score: float = 0.95
    warnings: List[str] = []

class QuestionMergeRequest(BaseModel):
    target_question_id: Optional[str] = None  # If None, merge with next sequential question

class SplitPart(BaseModel):
    question_text: str
    marks: Optional[float] = None
    question_type: Optional[str] = None
    options: Optional[List[OptionSchema]] = None

class QuestionSplitRequest(BaseModel):
    split_mode: Optional[str] = "auto"  # "auto", "subquestions", "delimiter", "manual"
    delimiter: Optional[str] = None
    parts: Optional[List[SplitPart]] = None
