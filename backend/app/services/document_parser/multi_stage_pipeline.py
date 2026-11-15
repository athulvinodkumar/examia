"""
EXAMIA MULTI-STAGE INTELLIGENT QUESTION PAPER PIPELINE
5-Stage Pipeline:
  Stage 1: Document Understanding & Metadata Extraction
  Stage 2: Layout & Content Segmentation (Filter noise/headers/instructions)
  Stage 3: Question Identification & Section Association (Line & page continuations)
  Stage 4: Question Classification (12 Types & Horizontal/Vertical Options)
  Stage 5: Validation & Quality Assurance (Deduplication & Confidence Scoring)
"""

import re
from typing import List, Dict, Any, Tuple, Optional
from app.services.document_parser.patterns import (
    SECTION_HEADER_RE,
    STANDALONE_SECTION_RE,
    STANDARD_Q_NUM_RE,
    PAREN_Q_NUM_RE,
    SUBQUESTION_PREFIX_RE,
    COMPOUND_Q_NUM_RE,
    IMPERATIVE_Q_RE,
    VERTICAL_OPTION_RE,
    NUMERIC_OPTION_RE,
    ROMAN_OPTION_RE,
    MARKS_RE,
    COMPOUND_MARKS_RE,
    extract_horizontal_options,
    is_non_question_line
)
from app.services.document_parser.metadata_extractor import MetadataExtractor
from app.services.document_parser.classifier import QuestionClassifier

class MultiStagePipeline:
    @classmethod
    def process_raw_text(cls, raw_text: str) -> Dict[str, Any]:
        """
        Executes the 5-stage intelligent examination extraction pipeline.
        """
        lines = [line.strip() for line in raw_text.split("\n")]

        # ===================================================================
        # STAGE 1: DOCUMENT UNDERSTANDING & METADATA EXTRACTION
        # ===================================================================
        metadata, cleaned_lines = MetadataExtractor.extract_metadata_and_sections(lines)

        # ===================================================================
        # STAGE 2 & 3: LAYOUT ANALYSIS, CONTENT SEGMENTATION & QUESTION EXTRACTION
        # ===================================================================
        questions: List[Dict[str, Any]] = []
        current_section = metadata["sections"][0] if metadata["sections"] else "Section A: General"
        
        current_q_num: Optional[int] = None
        current_q_text_lines: List[str] = []
        current_options: List[Dict[str, Any]] = []
        current_subquestions: List[Dict[str, Any]] = []
        current_marks: Optional[float] = None
        has_explicit_marks: bool = False
        is_imperative_start: bool = False
        q_counter = 1

        def _reset_buffers():
            nonlocal current_q_num, current_q_text_lines, current_options
            nonlocal current_subquestions, current_marks, has_explicit_marks
            nonlocal is_imperative_start
            current_q_num = None
            current_q_text_lines = []
            current_options = []
            current_subquestions = []
            current_marks = None
            has_explicit_marks = False
            is_imperative_start = False

        def commit_active_question():
            nonlocal current_q_num, current_q_text_lines, current_options
            nonlocal current_subquestions, current_marks, has_explicit_marks
            nonlocal is_imperative_start, q_counter

            if not current_q_text_lines and not current_options:
                return

            full_text = " ".join(current_q_text_lines).strip()
            # Safety check: do not save if empty or resembles pure non-question label
            if len(full_text) < 3 and not current_options:
                _reset_buffers()
                return
            is_non_q, _ = is_non_question_line(full_text)
            if is_non_q and not current_options:
                _reset_buffers()
                return

            # Extract marks from question text if not already captured
            if current_marks is None:
                m = MARKS_RE.search(full_text)
                if m:
                    val = m.group(1) or m.group(2)
                    try:
                        current_marks = float(val)
                        has_explicit_marks = True
                    except (ValueError, TypeError):
                        current_marks = 1.0
                    full_text = MARKS_RE.sub("", full_text).strip()
                else:
                    current_marks = 1.0
                    has_explicit_marks = False

            # Ensure any subquestions are represented in question text body
            if current_subquestions:
                for sq in current_subquestions:
                    if sq.get("text") and sq["text"] not in full_text:
                        full_text = f"{full_text} ({sq.get('label', '')}) {sq['text']}".strip()

            # Check for inline horizontal options in the text body if none extracted vertically
            if not current_options:
                inline_opts = extract_horizontal_options(full_text)
                if inline_opts:
                    current_options = inline_opts
                    # Remove options portion from question stem
                    first_label = inline_opts[0]["option_label"]
                    pattern = rf'[\(\[]?\s*{first_label}\s*[\.\)\]]'
                    split_match = re.search(pattern, full_text, re.IGNORECASE)
                    if split_match:
                        full_text = full_text[:split_match.start()].strip()

            # Clean LaTeX formatting and normalize double spaces
            full_text = re.sub(r'\s+', ' ', full_text).strip()

            # ===================================================================
            # STAGE 4: QUESTION CLASSIFICATION & CONFIDENCE SCORING
            # ===================================================================
            classification = QuestionClassifier.classify_and_score(
                question_text=full_text,
                options=current_options,
                marks=current_marks or 1.0,
                has_question_number=bool(current_q_num is not None),
                is_imperative=is_imperative_start,
                has_section=bool(current_section),
                explicit_marks_found=has_explicit_marks,
                section_title=current_section
            )

            q_obj = {
                "question_number": current_q_num or q_counter,
                "question_text": full_text or f"Question {q_counter}",
                "question_type": classification["question_type"],
                "marks": current_marks or 1.0,
                "negative_marks": 0.0,
                "section_title": current_section,
                "options": classification["options"],
                "subquestions": current_subquestions,
                "confidence_score": classification["confidence_score"],
                "confidence_breakdown": classification["confidence_breakdown"],
                "review_status": "needs_review" if classification["needs_review"] else "verified",
                "warnings": classification["warnings"],
                "order_index": len(questions)
            }
            questions.append(q_obj)
            q_counter += 1

            _reset_buffers()

        # Iterate through cleaned document stream
        idx = 0
        while idx < len(cleaned_lines):
            line = cleaned_lines[idx].strip()
            idx += 1

            if not line:
                continue

            # 1. Check Section Marker
            if line.startswith("__SECTION_MARKER__:"):
                commit_active_question()
                current_section = line.replace("__SECTION_MARKER__:", "").strip()
                continue

            # 2. Check if line is explicit non-question metadata/instruction
            is_non_q, _ = is_non_question_line(line)
            if is_non_q:
                # Discard non-question line; do not let it become or corrupt a question
                continue

            # 3. Check for Horizontal Options on this line (e.g. "A) 10  B) 20  C) 30  D) 40")
            # Only match as standalone options if this line does not start with a question number
            if not (STANDARD_Q_NUM_RE.match(line) or PAREN_Q_NUM_RE.match(line)):
                h_opts = extract_horizontal_options(line)
                if h_opts and (current_q_text_lines or current_q_num is not None):
                    current_options.extend(h_opts)
                    continue

            # 4. Check for Vertical Option on this line (e.g. "(A) Joule", "a. Joule", "1. Joule")
            opt_m = VERTICAL_OPTION_RE.match(line)
            if opt_m and (current_q_text_lines or current_q_num is not None):
                label = (opt_m.group(1) or opt_m.group(2)).upper()
                opt_text = opt_m.group(3).strip()
                # If option starts with imperative question command or has question mark, it is a subquestion!
                if IMPERATIVE_Q_RE.match(opt_text) or "?" in opt_text:
                    current_subquestions.append({
                        "label": label.lower(),
                        "text": opt_text
                    })
                    current_q_text_lines.append(f"({label.lower()}) {opt_text}")
                    continue

                current_options.append({
                    "option_label": label,
                    "option_text": opt_text,
                    "is_correct": False,
                    "order_index": len(current_options)
                })
                continue

            # Check Roman vertical option e.g. "(i) Joule"
            roman_m = ROMAN_OPTION_RE.match(line)
            if roman_m and (current_q_text_lines or current_q_num is not None) and len(current_options) >= 1:
                label = roman_m.group(1).lower()
                opt_text = roman_m.group(2).strip()
                current_options.append({
                    "option_label": label,
                    "option_text": opt_text,
                    "is_correct": False,
                    "order_index": len(current_options)
                })
                continue

            # 5. Check Question Start: Standard Numbering ("1.", "Q1.", "Question 1:", "1)", "(1)")
            q_num_match = STANDARD_Q_NUM_RE.match(line) or PAREN_Q_NUM_RE.match(line)
            if q_num_match:
                num_str = q_num_match.group(1)
                rest = q_num_match.group(2).strip()

                # Safety check: make sure num_str is not an isolated year like "2024" or a page number
                try:
                    parsed_num = int(num_str)
                    if parsed_num > 250:  # Likely a year (e.g. 2024) or serial number, not question #
                        if current_q_text_lines:
                            current_q_text_lines.append(line)
                        continue
                except ValueError:
                    parsed_num = q_counter

                # Commit preceding question
                commit_active_question()

                current_q_num = parsed_num
                # Check for marks embedded in rest
                m_marks = MARKS_RE.search(rest)
                if m_marks:
                    val = m_marks.group(1) or m_marks.group(2)
                    try:
                        current_marks = float(val)
                        has_explicit_marks = True
                    except ValueError:
                        pass
                    rest = MARKS_RE.sub("", rest).strip()

                # Check if question line contains inline horizontal options
                inline_opts = extract_horizontal_options(rest)
                if inline_opts:
                    current_options.extend(inline_opts)
                    first_label = inline_opts[0]["option_label"]
                    pattern = rf'[\(\[]?\s*{re.escape(first_label)}\s*[\.\)\]]'
                    split_m = re.search(pattern, rest, re.IGNORECASE)
                    if split_m:
                        rest = rest[:split_m.start()].strip()

                current_q_text_lines.append(rest)
                continue

            # 6. Check Subquestion e.g. "1(a)", "1.a", "1(i)", "(a)", "a)"
            subq_match = SUBQUESTION_PREFIX_RE.match(line)
            if subq_match:
                parent_num = subq_match.group(1)
                sub_label = next((g for g in subq_match.groups()[1:5] if g), "").strip()
                rest = (subq_match.groups()[-1] or "").strip()

                # If we have an active question matching parent_num, add as subquestion
                if current_q_num and (not parent_num or str(current_q_num) == parent_num):
                    current_subquestions.append({
                        "label": sub_label,
                        "text": rest
                    })
                    current_q_text_lines.append(f"({sub_label}) {rest}")
                    continue
                else:
                    commit_active_question()
                    try:
                        current_q_num = int(parent_num) if parent_num else q_counter
                    except ValueError:
                        current_q_num = q_counter
                    current_q_text_lines.append(f"({sub_label}) {rest}")
                    continue

            # 7. Check Imperative Question Opener without numbers (e.g. "Define electric current.", "Derive the formula...")
            if not current_q_text_lines and IMPERATIVE_Q_RE.match(line):
                commit_active_question()
                is_imperative_start = True
                current_q_num = q_counter
                current_q_text_lines.append(line)
                continue

            # 8. Continuation line (multi-line question statement, diagram reference, or option wrap)
            if current_options:
                current_options[-1]["option_text"] = f"{current_options[-1]['option_text']} {line}".strip()
            elif current_q_text_lines or current_q_num is not None:
                current_q_text_lines.append(line)

        # Commit the final question in buffer
        commit_active_question()

        # ===================================================================
        # STAGE 5: VALIDATION & QUALITY ASSURANCE
        # ===================================================================
        validated_questions: List[Dict[str, Any]] = []
        seen_texts = set()

        for idx, q in enumerate(questions):
            text_norm = re.sub(r'[^a-zA-Z0-9]', '', q["question_text"].lower())
            # Deduplicate accidental identical extractions
            if text_norm in seen_texts and len(text_norm) > 20:
                continue
            seen_texts.add(text_norm)

            # Assign sequential order index
            q["order_index"] = idx
            validated_questions.append(q)

        total_marks = sum(q.get("marks", 1.0) for q in validated_questions)
        overall_confidence = round(
            sum(q.get("confidence_score", 0.9) for q in validated_questions) / max(1, len(validated_questions)),
            2
        )

        return {
            "metadata": metadata,
            "questions": validated_questions,
            "question_count": len(validated_questions),
            "total_marks": total_marks if total_marks > 0 else (metadata.get("total_marks") or 100.0),
            "confidence_score": overall_confidence,
            "sections": metadata["sections"]
        }
