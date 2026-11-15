"""
EXAMIA DOCUMENT METADATA & SECTION PREPROCESSOR
Identifies examination headers, institution names, subject, time allowed,
maximum marks, candidate instructions, and sections as document metadata,
ensuring they are never converted into questions.
"""

import re
from typing import List, Dict, Any, Tuple, Optional
from app.services.document_parser.patterns import (
    SECTION_HEADER_RE,
    STANDALONE_SECTION_RE,
    METADATA_HEADER_RE,
    INSTRUCTION_RE,
    PAGE_FOOTER_RE,
    DIVIDER_LINE_RE,
    MARKS_RE,
    STANDARD_Q_NUM_RE,
    PAREN_Q_NUM_RE,
    IMPERATIVE_Q_RE,
    VERTICAL_OPTION_RE,
    ANSWER_BLANK_RE,
    CANDIDATE_FORM_RE,
    MARK_DISTRIBUTION_RE,
    is_non_question_line
)

# Words indicating general examination candidate instructions
INSTRUCTION_KEYWORD_RE = re.compile(
    r'\b(?:compulsory|permitted|prohibited|calculator|calculators|mobile|pages|booklet|'
    r'ball\s*point|rough\s*work|candidate|candidates|invigilator|answer\s*sheet|'
    r'omr|handover|serial\s*order|all\s*questions|figures\s*to\s*the\s*right|'
    r'neat\s*and\s*clean|symbols\s*have\s*usual)\b',
    re.IGNORECASE
)

class MetadataExtractor:
    @staticmethod
    def extract_metadata_and_sections(lines: List[str]) -> Tuple[Dict[str, Any], List[str]]:
        """
        Scans the lines of the document.
        Extracts document-level metadata (title, subject, max_marks, duration, instructions, sections)
        and returns clean lines with metadata stripped or annotated.
        Guarantees that actual questions are NEVER consumed as metadata.
        """
        metadata: Dict[str, Any] = {
            "title": "",
            "subject": "",
            "total_marks": None,
            "duration_minutes": 60,
            "instructions": [],
            "sections": [],
            "institution": ""
        }

        subject_pattern = re.compile(r'(?:subject|course(?:\s*name)?)\s*[:\-]\s*(.*)', re.IGNORECASE)
        time_pattern = re.compile(r'(?:time|duration)(?:\s*allowed)?\s*[:\-]\s*(\d+)\s*(hour|hr|minute|min)?', re.IGNORECASE)
        marks_pattern = re.compile(r'(?:max(?:imum)?\s*marks|total\s*marks)\s*[:\-]\s*(\d+(?:\.\d+)?)', re.IGNORECASE)
        institution_pattern = re.compile(r'(?:university|college|institute|academy|school|board)\s+(?:of\s+.*|.*)', re.IGNORECASE)

        cleaned_lines: List[str] = []
        is_in_instructions = False
        in_preamble = True
        line_idx = 0

        while line_idx < len(lines):
            line = lines[line_idx].strip()
            line_idx += 1

            if not line:
                continue

            # Check if this is a decorative divider line or write-in blank
            if DIVIDER_LINE_RE.match(line) or ANSWER_BLANK_RE.match(line):
                is_in_instructions = False
                continue

            # Check for page footers / headers
            if PAGE_FOOTER_RE.match(line):
                continue

            # Check for candidate form fields (Candidate Name:, Register No.:, Class/Batch:)
            if CANDIDATE_FORM_RE.match(line):
                if line_idx < len(lines) and ANSWER_BLANK_RE.match(lines[line_idx].strip()):
                    line_idx += 1
                continue

            # Check for mark distribution subtitle (e.g. "10 × 1 = 10 marks | Choose the most appropriate answer.")
            if MARK_DISTRIBUTION_RE.match(line):
                continue

            # Section Header detection
            sec_match = SECTION_HEADER_RE.match(line) or STANDALONE_SECTION_RE.match(line)
            if sec_match:
                is_in_instructions = False
                in_preamble = False  # Once a section header appears, preamble is over!
                sec_code = sec_match.group(1).upper() if sec_match.groups() else "A"
                sec_title = sec_match.group(2).strip() if len(sec_match.groups()) > 1 and sec_match.group(2) else f"Section {sec_code}"
                full_sec = f"Section {sec_code}: {sec_title}".strip(" :")
                if full_sec not in metadata["sections"]:
                    metadata["sections"].append(full_sec)
                cleaned_lines.append(f"__SECTION_MARKER__: {full_sec}")
                continue

            # Check if line is definitively an actual examination question start (with question mark or explicit marks)
            is_explicit_q = bool(
                ("?" in line and (STANDARD_Q_NUM_RE.match(line) or IMPERATIVE_Q_RE.match(line))) or
                (STANDARD_Q_NUM_RE.match(line) and MARKS_RE.search(line)) or
                (PAREN_Q_NUM_RE.match(line) and MARKS_RE.search(line))
            )

            is_generic_num = bool(
                STANDARD_Q_NUM_RE.match(line) or
                PAREN_Q_NUM_RE.match(line)
            )

            # If we are in candidate instructions block
            if is_in_instructions:
                if is_explicit_q:
                    # An actual graded question has started! Instructions block ends immediately.
                    is_in_instructions = False
                    in_preamble = False
                elif INSTRUCTION_KEYWORD_RE.search(line) or (re.match(r'^\s*(?:\d+[\.\)]|[a-zA-Z][\.\)]|[-•])\s+', line) and not MARKS_RE.search(line) and "?" not in line):
                    metadata["instructions"].append(line)
                    continue
                else:
                    is_in_instructions = False

            # If still within the document preamble (before questions/sections begin)
            if in_preamble:
                # If question or numbered item detected, exit preamble immediately
                if is_explicit_q or is_generic_num:
                    in_preamble = False
                    cleaned_lines.append(line)
                    continue

                next_line = lines[line_idx].strip() if line_idx < len(lines) else ""

                # Subject check
                sub_m = subject_pattern.search(line)
                if sub_m and not metadata["subject"]:
                    metadata["subject"] = sub_m.group(1).strip()
                    continue

                # Time / Duration check (single-line or two-line table pair)
                time_m = time_pattern.search(line)
                if time_m:
                    val = int(time_m.group(1))
                    unit = (time_m.group(2) or "min").lower()
                    metadata["duration_minutes"] = val * 60 if ("hour" in unit or "hr" in unit) else val
                    continue
                elif re.match(r'^(?:time|duration)(?:\s*allowed)?\s*[:\-]?$', line, re.IGNORECASE):
                    tm = re.match(r'^(\d+)\s*(hour|hr|minute|min)?', next_line, re.IGNORECASE)
                    if tm:
                        val = int(tm.group(1))
                        unit = (tm.group(2) or "min").lower()
                        metadata["duration_minutes"] = val * 60 if ("hour" in unit or "hr" in unit) else val
                        line_idx += 1
                        continue
                    continue

                # Max Marks check (single-line or two-line table pair)
                mm_m = marks_pattern.search(line)
                if mm_m:
                    try:
                        metadata["total_marks"] = float(mm_m.group(1))
                    except ValueError:
                        pass
                    continue
                elif re.match(r'^(?:max(?:imum)?\s*marks|total\s*marks)\s*[:\-]?$', line, re.IGNORECASE):
                    mm = re.match(r'^(\d+(?:\.\d+)?)\s*(?:marks?|pts?)?$', next_line, re.IGNORECASE)
                    if mm:
                        try:
                            metadata["total_marks"] = float(mm.group(1))
                        except ValueError:
                            pass
                        line_idx += 1
                        continue
                    continue

                # Preamble table noise: Questions count & Question types
                if re.match(r'^(?:questions|total\s*questions|no\.?\s*of\s*questions)\s*[:\-]?$', line, re.IGNORECASE):
                    if next_line and re.match(r'^\d+$', next_line):
                        line_idx += 1
                    continue
                if re.match(r'^(?:question\s*types?)\s*[:\-]?$', line, re.IGNORECASE):
                    if next_line and not is_explicit_q and not is_generic_num:
                        line_idx += 1
                    continue

                # Compound Title / Subject line e.g. "COMPUTER SCIENCE FUNDAMENTALS | TEST PAPER 01"
                if "|" in line:
                    parts = [p.strip() for p in line.split("|")]
                    if len(parts) >= 2:
                        if not metadata["subject"] or metadata["subject"] == "General":
                            metadata["subject"] = parts[0]
                        if not metadata["title"] or metadata["title"] == "Interactive Examination":
                            metadata["title"] = line
                        continue

                # Candidate metadata noise check (Roll No, Candidate Name, Course Code)
                if METADATA_HEADER_RE.match(line):
                    continue

                # Institution check
                if institution_pattern.search(line) and not metadata["institution"]:
                    metadata["institution"] = line
                    continue

                # General Instructions header detection
                if INSTRUCTION_RE.match(line):
                    is_in_instructions = True
                    metadata["instructions"].append(line)
                    continue

                # Document Title check (only non-question, non-header title lines in preamble)
                if (not metadata["title"] and len(line) > 5 and
                    not is_generic_num and
                    not is_explicit_q and
                    not METADATA_HEADER_RE.match(line) and
                    not INSTRUCTION_RE.match(line) and
                    not IMPERATIVE_Q_RE.match(line) and
                    "?" not in line and
                    not MARKS_RE.search(line)):
                    metadata["title"] = line
                    continue

            # If not discarded as document header metadata, keep line for question processing
            cleaned_lines.append(line)

        # Fallback defaults if not detected
        if not metadata["title"]:
            metadata["title"] = "Interactive Examination"
        if not metadata["subject"]:
            metadata["subject"] = "General"
        if not metadata["sections"]:
            metadata["sections"] = ["Section A: General"]

        return metadata, cleaned_lines
