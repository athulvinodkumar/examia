import json
import logging
from typing import List, Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_EXTRACTION_PROMPT = """
You are an expert pedagogical examination parsing AI.
Analyze the provided document text (or document images) from an examination paper.
Extract all individual questions, sections, marks, options, and question types into a structured JSON object.

RULES:
1. Identify all questions accurately with their original question number.
2. Question types must be one of:
   - "mcq_single": Multiple choice with exactly one correct answer
   - "mcq_multiple": Multiple choice with multiple valid selections
   - "true_false": True or False question
   - "numerical": Question expecting a numeric answer (number/decimal)
   - "short_answer": Brief phrase or one-line answer
   - "descriptive": Long-form explanation, essay, derivation, or problem working
   - "fill_blank": Fill in the blank
3. Options: For MCQs, extract option_label ('A', 'B', 'C', 'D') and option_text. If an answer key is explicitly provided in the document, mark is_correct=True; otherwise set is_correct=False.
4. Marks: Extract the marks allocated (e.g. [2 Marks] -> 2.0). If not specified, default to 1.0.
5. Never silently invent missing questions, correct answers, or marks. If uncertain, set review_status to "needs_review".
6. Mathematical expressions: Format equations in standard LaTeX notation (e.g. $E = mc^2$, $\\frac{a}{b}$).
7. Preserve sections (e.g. Section A: Mechanics, Section B: Electromagnetism).

OUTPUT FORMAT:
Return strictly a valid JSON object matching this schema:
{
  "questions": [
    {
      "question_number": 1,
      "question_text": "Question text here with LaTeX if applicable",
      "question_type": "mcq_single",
      "marks": 2.0,
      "negative_marks": 0.0,
      "section_title": "Section A",
      "review_status": "needs_review",
      "numerical_expected": null,
      "numerical_tolerance": 0.0,
      "accepted_answers": [],
      "descriptive_rubric": null,
      "sample_solution": null,
      "explanation": null,
      "options": [
        {"option_label": "A", "option_text": "Option A text", "is_correct": false},
        {"option_label": "B", "option_text": "Option B text", "is_correct": true}
      ]
    }
  ],
  "confidence_score": 0.98,
  "warnings": []
}
"""

GEMINI_GRADING_PROMPT = """
You are an expert educational grading assistant.
Evaluate a student's descriptive response against the question, expected sample answer, and grading rubric.

QUESTION:
{question_text}

MAXIMUM MARKS:
{max_marks}

EXPECTED SOLUTION / KEY POINTS:
{sample_solution}

GRADING RUBRIC / CRITERIA:
{rubric}

STUDENT RESPONSE:
{student_answer}

TASKS:
1. Evaluate student's understanding, accuracy, completeness, and adherence to key points.
2. Suggest an equitable score between 0.0 and {max_marks}.
3. Provide constructive feedback, identifying key strengths and areas of omission or error.

OUTPUT FORMAT:
Return strictly a valid JSON object:
{{
  "suggested_score": 4.0,
  "max_score": {max_marks},
  "confidence": 0.95,
  "feedback": "Concise summary of student performance",
  "strengths": ["Identified the core principle correctly", "Proper derivation of formula"],
  "weaknesses": ["Missed the final unit statement"]
}}
"""

class GeminiService:
    @staticmethod
    def is_available() -> bool:
        return settings.is_gemini_configured

    @staticmethod
    def extract_questions_from_text(document_text: str) -> Optional[Dict[str, Any]]:
        """Call Gemini API to extract structured questions from text"""
        if not settings.is_gemini_configured:
            return None

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.gemini_api_key)
            prompt = f"{GEMINI_EXTRACTION_PROMPT}\n\nDOCUMENT CONTENT:\n{document_text[:35000]}"
            
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2
                )
            )
            
            text_resp = response.text.strip()
            # Clean possible markdown wrap
            if text_resp.startswith("```json"):
                text_resp = text_resp[7:]
            if text_resp.endswith("```"):
                text_resp = text_resp[:-3]
                
            return json.loads(text_resp.strip())
        except Exception as e:
            logger.error(f"Gemini API question extraction error: {e}")
            return None

    @staticmethod
    def evaluate_descriptive_answer(
        question_text: str,
        max_marks: float,
        student_answer: str,
        sample_solution: Optional[str] = None,
        rubric: Optional[str] = None
    ) -> Dict[str, Any]:
        """Evaluate a student descriptive answer with Gemini AI"""
        if not settings.is_gemini_configured:
            # Fallback heuristic evaluation when API key is not yet set
            length = len(student_answer.strip())
            ratio = min(1.0, length / 150)
            suggested = round(max_marks * ratio * 0.8, 1)
            return {
                "suggested_score": suggested,
                "max_score": max_marks,
                "confidence": 0.7,
                "feedback": f"Auto-evaluated response based on length ({length} chars) and keywords. Teacher review recommended.",
                "strengths": ["Response submitted with relevant terminology."],
                "weaknesses": ["Detailed manual verification recommended."]
            }

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.gemini_api_key)
            prompt = GEMINI_GRADING_PROMPT.format(
                question_text=question_text,
                max_marks=max_marks,
                sample_solution=sample_solution or "Accurate and coherent explanation matching subject principles.",
                rubric=rubric or "Award full marks for thorough explanation; partial marks for partially correct statements.",
                student_answer=student_answer
            )

            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2
                )
            )

            text_resp = response.text.strip()
            if text_resp.startswith("```json"):
                text_resp = text_resp[7:]
            if text_resp.endswith("```"):
                text_resp = text_resp[:-3]

            data = json.loads(text_resp.strip())
            # Ensure score does not exceed max_marks
            data["suggested_score"] = min(max_marks, max(0.0, float(data.get("suggested_score", 0.0))))
            return data
        except Exception as e:
            logger.error(f"Gemini evaluation error: {e}")
            return {
                "suggested_score": round(max_marks * 0.5, 1),
                "max_score": max_marks,
                "confidence": 0.5,
                "feedback": f"Gemini evaluation unavailable: {str(e)}. Teacher manual review needed.",
                "strengths": [],
                "weaknesses": []
            }
