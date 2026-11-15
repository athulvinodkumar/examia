"""
EXAMIA ENHANCED GEMINI AI EXTRACTION PIPELINE
Multi-stage pedagogical examination paper understanding powered by Google GenAI SDK.
Strict schema enforcement, negative instruction filtering, multi-page chunk handling,
and evidence-based confidence scoring.
"""

import json
import logging
import re
from typing import List, Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_INTELLIGENT_SYSTEM_PROMPT = """
You are Examia's Master Examination Paper Parsing AI.
Your job is to read an examination paper and extract ONLY genuine examination questions into a structured, validated format.

CRITICAL RULES FOR INTELLIGENT QUESTION DETECTION:
1. TEXT THAT MUST NEVER BE CONVERTED INTO QUESTIONS:
   - Section headings (e.g. "SECTION-A", "SECTION B", "PART I", "PART II", "SECTION 1: OBJECTIVE QUESTIONS", "GROUP A")
   - General Instructions (e.g. "General Instructions", "Answer all questions", "All questions are compulsory", "Draw neat diagrams")
   - Header / Administrative metadata (e.g. "Maximum Marks: 100", "Time Allowed: 3 Hours", "Roll No:", "Candidate Name:", "Register Number:", "Subject Name:", "Date:")
   - Page numbers, chapter titles, institution / university names, footer text ("Page 1 of 4", "PTO", "CONFIDENTIAL")
   - Mark distribution headings
   These must be extracted as document metadata or section titles, NEVER as questions.

2. GENUINE QUESTIONS MUST BE IDENTIFIED BY:
   - Question numbering (1., 2., 3., 1(a), 1(b), Q1, etc.)
   - Interrogative sentences ("Which of the following...", "What is...", "Why does...")
   - Imperative examination directives ("Define", "Explain", "Calculate", "Derive", "Compare", "Differentiate", "Illustrate", "Describe", "Discuss", "Solve", "Evaluate")
   - Questions without question marks are very common (e.g. "Explain Ohm's law." -> This is a question!)
   - Multi-line question statements and questions continuing across pages must be concatenated into a single question.

3. QUESTION CLASSIFICATION (MUST BE ONE OF THESE 12 TYPES):
   - "mcq_single": Multiple Choice Question with single correct selection. Options may appear vertically or horizontally inline (e.g. "A) 10  B) 20  C) 30  D) 40").
   - "mcq_multiple": Multiple Choice Question where prompt asks to select multiple options.
   - "true_false": True or False question.
   - "fill_blank": Question with blanks (e.g. "____" or "Fill in the blanks").
   - "match_following": Match List I with List II / Column A with Column B.
   - "short_answer": Brief conceptual question (typically 1-3 marks).
   - "long_answer": Extended essay, descriptive discussion (typically 4+ marks).
   - "numerical": Problem with numbers and units requiring calculation (e.g. "Calculate kinetic energy...").
   - "mathematical": Equations, derivations, calculus, proofs (e.g. "Derive formula for...", "Prove that...").
   - "diagram_based": Question referencing a figure, diagram, circuit, or graph.
   - "assertion_reason": Contains Assertion (A) and Reason (R).
   - "case_study": Scenario or passage followed by subquestions.

4. MCQ OPTION RULES:
   - Extract all options preserving their original label ("A", "B", "C", "D" or "a", "b", "c", "d") and order.
   - Associate options with their parent question. NEVER extract individual options as separate questions.
   - Only set is_correct=True if explicitly stated in an attached answer key. NEVER invent answers.
   - If no options exist, do not classify as MCQ.

5. MATHEMATICAL NOTATION:
   - Preserve all equations and mathematical symbols using standard inline LaTeX ($...$) or block LaTeX ($$...$$).

6. CONFIDENCE & REVIEW:
   - Assign confidence_score between 0.0 and 1.0 based on clarity.
   - Set needs_review=True if the question is ambiguous, partially cut off, or uncertain.
"""

GEMINI_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "metadata": {
            "type": "OBJECT",
            "properties": {
                "title": {"type": "STRING"},
                "subject": {"type": "STRING"},
                "total_marks": {"type": "NUMBER"},
                "duration_minutes": {"type": "INTEGER"},
                "instructions": {"type": "ARRAY", "items": {"type": "STRING"}},
                "sections": {"type": "ARRAY", "items": {"type": "STRING"}}
            },
            "required": ["title", "subject", "sections"]
        },
        "questions": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "question_number": {"type": "INTEGER"},
                    "section_title": {"type": "STRING"},
                    "question_type": {
                        "type": "STRING",
                        "enum": [
                            "mcq_single", "mcq_multiple", "true_false", "fill_blank",
                            "match_following", "short_answer", "long_answer", "numerical",
                            "mathematical", "diagram_based", "assertion_reason", "case_study"
                        ]
                    },
                    "question_text": {"type": "STRING"},
                    "marks": {"type": "NUMBER"},
                    "negative_marks": {"type": "NUMBER"},
                    "confidence_score": {"type": "NUMBER"},
                    "needs_review": {"type": "BOOLEAN"},
                    "options": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "option_label": {"type": "STRING"},
                                "option_text": {"type": "STRING"},
                                "is_correct": {"type": "BOOLEAN"}
                            },
                            "required": ["option_label", "option_text"]
                        }
                    },
                    "subquestions": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "label": {"type": "STRING"},
                                "text": {"type": "STRING"}
                            }
                        }
                    },
                    "explanation": {"type": "STRING"},
                    "sample_solution": {"type": "STRING"}
                },
                "required": ["question_number", "question_type", "question_text", "marks", "section_title"]
            }
        },
        "confidence_score": {"type": "NUMBER"},
        "warnings": {"type": "ARRAY", "items": {"type": "STRING"}}
    },
    "required": ["metadata", "questions", "confidence_score"]
}

class GeminiPipeline:
    @classmethod
    def process_with_gemini(cls, text: str) -> Optional[Dict[str, Any]]:
        """
        Processes question paper text using Gemini 2.0 Flash with structured schema extraction.
        Handles chunking if document exceeds 40,000 characters.
        """
        if not settings.is_gemini_configured:
            return None

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.gemini_api_key)

            # If document is large, process in overlapping page-aware windows
            chunk_size = 35000
            if len(text) > chunk_size:
                return cls._process_large_document(client, text, chunk_size)

            prompt = (
                f"{GEMINI_INTELLIGENT_SYSTEM_PROMPT}\n\n"
                f"EXAMINATION DOCUMENT TEXT:\n{text}\n\n"
                f"Extract all genuine questions, metadata, sections, and options in strict JSON matching the schema."
            )

            # Use fast retry logic for transient API issues
            model_name = settings.gemini_model or "gemini-3.5-flash-lite"
            response = None
            for attempt in range(2):
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            response_schema=GEMINI_RESPONSE_SCHEMA,
                            temperature=0.1
                        )
                    )
                    break
                except Exception as api_err:
                    if attempt == 1:
                        raise api_err
                    logger.warning(f"Gemini API retry attempt {attempt+1}: {api_err}")

            raw_resp = response.text.strip()
            # Clean possible markdown wrap
            if raw_resp.startswith("```json"):
                raw_resp = raw_resp[7:]
            if raw_resp.endswith("```"):
                raw_resp = raw_resp[:-3]

            parsed = json.loads(raw_resp.strip())
            return cls._post_process_gemini_result(parsed)

        except Exception as e:
            logger.error(f"Gemini pipeline extraction error: {e}", exc_info=True)
            return None

    @classmethod
    def _process_large_document(cls, client, text: str, chunk_size: int) -> Dict[str, Any]:
        """Processes long multi-page documents by chunking with context overlap and deduplicating"""
        from google.genai import types

        chunks = []
        step = chunk_size - 4000
        for start in range(0, len(text), step):
            chunks.append(text[start:start + chunk_size])

        combined_questions = []
        overall_metadata = None
        seen_question_numbers = set()

        for chunk_idx, chunk in enumerate(chunks):
            prompt = (
                f"{GEMINI_INTELLIGENT_SYSTEM_PROMPT}\n\n"
                f"EXAMINATION DOCUMENT PART {chunk_idx + 1} OF {len(chunks)}:\n{chunk}\n\n"
                f"Extract genuine questions and sections from this section."
            )
            try:
                response = client.models.generate_content(
                    model=settings.gemini_model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=GEMINI_RESPONSE_SCHEMA,
                        temperature=0.1
                    )
                )
                chunk_data = json.loads(response.text.strip())
                if not overall_metadata and "metadata" in chunk_data:
                    overall_metadata = chunk_data["metadata"]

                for q in chunk_data.get("questions", []):
                    q_num = q.get("question_number")
                    # Deduplicate questions matching same number
                    if q_num not in seen_question_numbers:
                        seen_question_numbers.add(q_num)
                        combined_questions.append(q)
            except Exception as chunk_err:
                logger.error(f"Error processing chunk {chunk_idx}: {chunk_err}")

        return {
            "metadata": overall_metadata or {"title": "Examination", "subject": "General", "sections": []},
            "questions": combined_questions,
            "confidence_score": 0.95,
            "warnings": []
        }

    @classmethod
    def _post_process_gemini_result(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """Post-validates and formats Gemini output to match Examia's schema expectations"""
        questions = data.get("questions", [])
        validated = []

        for idx, q in enumerate(questions):
            # Ensure proper review_status string for Examia UI
            needs_review = q.get("needs_review", False)
            conf = float(q.get("confidence_score", 0.95))
            if conf < 0.70:
                needs_review = True

            q["review_status"] = "needs_review" if needs_review else "verified"
            q["order_index"] = idx

            # Ensure options have order_index and default is_correct
            options = q.get("options", [])
            for opt_idx, opt in enumerate(options):
                opt["order_index"] = opt_idx
                if "is_correct" not in opt:
                    opt["is_correct"] = False

            q["options"] = options
            validated.append(q)

        data["questions"] = validated
        data["question_count"] = len(validated)
        data["total_marks"] = sum(q.get("marks", 1.0) for q in validated)
        return data
