"""
EXAMIA QUESTION TYPE CLASSIFIER & CONFIDENCE ENGINE
Accurately categorizes questions into 12 pedagogical types, extracts horizontal
and vertical options, and computes evidence-based confidence scores.
"""

import re
from typing import List, Dict, Any, Tuple, Optional
from app.services.document_parser.patterns import (
    TRUE_FALSE_RE,
    FILL_BLANKS_RE,
    MATCH_FOLLOWING_RE,
    ASSERTION_REASON_RE,
    NUMERICAL_RE,
    MATHEMATICAL_RE,
    DIAGRAM_RE,
    CASE_STUDY_RE,
    MULTIPLE_SELECT_RE,
    MARKS_RE,
    COMPOUND_MARKS_RE,
    extract_horizontal_options
)

QUESTION_TYPES = [
    "mcq_single",
    "mcq_multiple",
    "true_false",
    "fill_blank",
    "match_following",
    "short_answer",
    "long_answer",
    "numerical",
    "mathematical",
    "diagram_based",
    "assertion_reason",
    "case_study"
]

class QuestionClassifier:
    @classmethod
    def classify_and_score(
        cls,
        question_text: str,
        options: List[Dict[str, Any]],
        marks: float,
        has_question_number: bool = True,
        is_imperative: bool = False,
        has_section: bool = True,
        explicit_marks_found: bool = False,
        section_title: str = ""
    ) -> Dict[str, Any]:
        """
        Classifies the question type and calculates multi-factor evidence confidence.
        Returns a dict containing:
          - question_type (one of the 12 types)
          - confidence_score (float 0.0 - 1.0)
          - confidence_breakdown (dict)
          - needs_review (bool)
          - warnings (list)
        """
        text = question_text.strip()
        warnings: List[str] = []

        q_conf = 1.0 if has_question_number else (0.85 if is_imperative else 0.7)
        type_conf = 0.95
        opt_conf = 1.0
        marks_conf = 0.98 if explicit_marks_found else 0.75
        sec_conf = 0.95 if has_section else 0.8

        detected_type = "short_answer"

        # ---------------------------------------------------------
        # 1. HIGH-PRIORITY PEDAGOGICAL STRUCTURE PATTERNS
        # ---------------------------------------------------------
        if MATCH_FOLLOWING_RE.search(text):
            detected_type = "match_following"
            type_conf = 0.95

        elif ASSERTION_REASON_RE.search(text):
            detected_type = "assertion_reason"
            type_conf = 0.95

        elif CASE_STUDY_RE.search(text):
            detected_type = "case_study"
            type_conf = 0.94

        # ---------------------------------------------------------
        # 2. OPTION-DRIVEN CLASSIFICATIONS (MCQ, MSQ, True/False)
        # ---------------------------------------------------------
        elif options and len(options) >= 2:
            opt_texts = [o.get("option_text", "").strip().lower() for o in options]
            if len(options) == 2 and set(opt_texts) == {"true", "false"}:
                detected_type = "true_false"
                type_conf = 0.98
            elif MULTIPLE_SELECT_RE.search(text):
                detected_type = "mcq_multiple"
                type_conf = 0.92
            else:
                detected_type = "mcq_single"
                # Check option count sanity (typical exams have 3-5 options)
                if len(options) in (3, 4, 5):
                    type_conf = 0.98
                else:
                    type_conf = 0.85
                    warnings.append(f"Non-standard option count ({len(options)} options)")

            # Check option label integrity
            labels = [o.get("option_label", "").upper() for o in options]
            expected_labels = [chr(65 + i) for i in range(len(labels))]
            if labels != expected_labels and labels != [str(i+1) for i in range(len(labels))]:
                opt_conf = 0.8
                warnings.append("Option labels do not follow standard alphabetical sequence")

        # ---------------------------------------------------------
        # 3. PATTERN & STRUCTURE-DRIVEN CLASSIFICATIONS (No Options)
        # ---------------------------------------------------------
        else:
            if TRUE_FALSE_RE.search(text):
                detected_type = "true_false"
                type_conf = 0.96
                options = [
                    {"option_label": "A", "option_text": "True", "is_correct": False, "order_index": 0},
                    {"option_label": "B", "option_text": "False", "is_correct": False, "order_index": 1}
                ]

            elif FILL_BLANKS_RE.search(text):
                detected_type = "fill_blank"
                type_conf = 0.92

            elif DIAGRAM_RE.search(text):
                detected_type = "diagram_based"
                type_conf = 0.90

            elif NUMERICAL_RE.search(text) and re.search(r'\d+(?:\.\d+)?\s*(?:kg|m/s|j|n|v|w|ohms?|hz|meters?|seconds?|km/h|mol|pa)\b', text, re.IGNORECASE):
                detected_type = "numerical"
                type_conf = 0.94

            elif MATHEMATICAL_RE.search(text) or (r'\frac' in text or r'\int' in text or r'\sum' in text or r'\sqrt' in text):
                detected_type = "mathematical"
                type_conf = 0.92

            elif NUMERICAL_RE.search(text):
                detected_type = "numerical"
                type_conf = 0.88

            elif re.search(r'\b(derive|prove|state and prove)\b', text, re.IGNORECASE):
                detected_type = "mathematical" if ("$" in text or "=" in text) else "long_answer"
                type_conf = 0.90

            else:
                sec_lower = section_title.lower() if section_title else ""
                if "short answer" in sec_lower and marks <= 5.0:
                    detected_type = "short_answer"
                    type_conf = 0.95
                elif "long answer" in sec_lower or "essay" in sec_lower:
                    detected_type = "long_answer"
                    type_conf = 0.95
                elif marks >= 6.0 or len(text) > 220 or re.search(r'\b(explain in detail|discuss|describe|elaborate|critically evaluate)\b', text, re.IGNORECASE):
                    detected_type = "long_answer"
                    type_conf = 0.90
                elif re.search(r'\b(define|name|state|what is|who is|give one|mention|differentiate|distinguish)\b', text, re.IGNORECASE) or marks <= 4.0:
                    detected_type = "short_answer"
                    type_conf = 0.92
                else:
                    detected_type = "short_answer" if len(text) < 120 else "long_answer"
                    type_conf = 0.75
                    warnings.append("Ambiguous question type; classified by length heuristic")

        # ---------------------------------------------------------
        # 3. COMPOSITE CONFIDENCE SCORE CALCULATION
        # Weighted: Question (30%), Type (30%), Options (20%), Marks (10%), Section (10%)
        # ---------------------------------------------------------
        composite_score = round(
            (q_conf * 0.30) +
            (type_conf * 0.30) +
            (opt_conf * 0.20) +
            (marks_conf * 0.10) +
            (sec_conf * 0.10),
            2
        )

        # Flag for teacher review if composite score < 0.70 or if critical ambiguities exist
        needs_review = (composite_score < 0.70) or (len(warnings) > 0 and composite_score < 0.85)

        return {
            "question_type": detected_type,
            "options": options,
            "confidence_score": composite_score,
            "confidence_breakdown": {
                "question": q_conf,
                "type": type_conf,
                "options": opt_conf,
                "marks": marks_conf,
                "section": sec_conf
            },
            "needs_review": needs_review,
            "warnings": warnings
        }
