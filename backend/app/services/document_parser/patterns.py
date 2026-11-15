"""
EXAMIA INTELLIGENT QUESTION PARSER — PATTERNS & REGEX REPOSITORY
Comprehensive regex signatures for document metadata, section headers,
question openers, horizontal/vertical options, and question types.
"""

import re
from typing import List, Dict, Any, Optional, Tuple

# ---------------------------------------------------------------------------
# 1. METADATA & NON-QUESTION FILTER PATTERNS
# Text matching these patterns must NEVER be converted into questions!
# ---------------------------------------------------------------------------

# Section headings (e.g., "SECTION A: MECHANICS", "PART-1", "GROUP B", "MODULE 3")
SECTION_HEADER_RE = re.compile(
    r'^(?:SECTION|PART|GROUP|MODULE)\s*[-:]?\s*([A-Z0-9]+)\s*[:\-–—]?\s*(.*)',
    re.IGNORECASE
)

# Explicit section title lines without prefix (e.g. "SECTION - A", "PART II - ESSAYS")
STANDALONE_SECTION_RE = re.compile(
    r'^(?:(?:SECTION|PART|GROUP)\s*[-–—:]?\s*[A-Z0-9]+)\s*$',
    re.IGNORECASE
)

# Examination metadata headers (University, Board, Subject, Time, Marks, Roll No, etc.)
METADATA_HEADER_RE = re.compile(
    r'^(?:'
    r'university|college|institute|academy|school|board\s+of|examination|'
    r'annual\s+examination|semester|midterm|final\s+exam|test\s+paper|'
    r'class\s*[:\-]|grade\s*[:\-]|subject\s*[:\-]|course\s*(?:code|name)?\s*[:\-]|'
    r'time\s*(?:allowed)?\s*[:\-]|duration\s*[:\-]|max(?:imum)?\s*marks\s*[:\-]|'
    r'total\s*marks\s*[:\-]|roll\s*no\.?\s*[:\-]|register\s*(?:no|number)\.?\s*[:\-]|'
    r'candidate(?:\'s)?\s*name\s*[:\-]|student(?:\'s)?\s*name\s*[:\-]|date\s*[:\-]'
    r')',
    re.IGNORECASE
)

# General examination instructions lines
INSTRUCTION_RE = re.compile(
    r'^(?:'
    r'general\s+instructions?|instructions?\s+(?:to\s+candidates?|for\s+students?)|'
    r'note\s*[:\-]|read\s+(?:the\s+)?(?:general\s+)?instructions?|'
    r'all\s+questions?\s+are\s+compulsory|figures\s+to\s+the\s+right|'
    r'use\s+of\s+calculators?|write\s+your\s+answers?|'
    r'this\s+question\s+paper\s+contains|verify\s+the\s+number\s+of\s+pages|'
    r'draw\s+neat\s+labelled\s+diagrams|symbols\s+have\s+usual\s+meanings'
    r')\b',
    re.IGNORECASE
)

# Repeated header / footer noise & page pagination
PAGE_FOOTER_RE = re.compile(
    r'^(?:'
    r'page\s*\d+\s*(?:of\s*\d+)?|\d+\s*(?:of|/)\s*\d+|'
    r'p\.?t\.?o\.?|turn\s+over|confidential|all\s+rights\s+reserved|'
    r'printed\s+(?:at|on)|examia\s*[•\-–—]?.*|'
    r'.*examination\s+paper(?:\s+for\s+platform\s+testing)?.*|'
    r'sample\s+(?:examination|question)\s+paper.*|'
    r'[—\-–=\*~#\s]*end\s+of\s+(?:the\s+)?(?:question\s+)?paper[—\-–=\*~#\s]*|'
    r'^[_\-\.]{5,}$'
    r')\s*$',
    re.IGNORECASE
)

# Mark distribution subheadings (e.g. "10 × 1 = 10 marks | Choose the most appropriate answer.")
MARK_DISTRIBUTION_RE = re.compile(
    r'^(?:\d+\s*[x×*]\s*\d+\s*=\s*\d+\s*(?:marks?|pts?)|'
    r'\[?\s*\d+\s*[x×*]\s*\d+\s*=\s*\d+\s*(?:marks?|pts?)?\s*\]?)\s*(?:[|\-–—:]\s*.*)?$',
    re.IGNORECASE
)

# Candidate form placeholders
CANDIDATE_FORM_RE = re.compile(
    r'^(?:'
    r'candidate(?:\'s)?\s*name|student(?:\'s)?\s*name|name\s*of\s*(?:the\s*)?candidate|'
    r'register\s*(?:no|number)\.?|roll\s*no\.?|class(?:\s*/\s*batch)?|batch|'
    r'date|signature(?:\s*of\s*(?:the\s*)?candidate)?'
    r')\s*[:\-]?\s*[_.\s]*$',
    re.IGNORECASE
)

# Answer write-in blank lines
ANSWER_BLANK_RE = re.compile(r'^[_\-\.]{5,}$')

# Decorative divider lines (dashes, stars, underscores, equals)
DIVIDER_LINE_RE = re.compile(r'^[ \t]*[\-_=\*~#]{3,}[ \t]*$')

# ---------------------------------------------------------------------------
# 2. QUESTION NUMBERING & INCEPTION PATTERNS
# ---------------------------------------------------------------------------

# Standard question numbering: "1.", "Q1.", "Q.1", "Question 1:", "1)", "1 - ", "(1)"
STANDARD_Q_NUM_RE = re.compile(
    r'^(?:Q(?:uestion)?\.?\s*)?(\d{1,3})[\.\)\:\-]\s*(.*)',
    re.IGNORECASE
)

# Parenthesized question number: "(1) Explain...", "[2] Calculate..."
PAREN_Q_NUM_RE = re.compile(
    r'^[\[\(](\d{1,3})[\]\)]\s*(.*)'
)

# Subquestion numbering: "1(a)", "1.a", "1(i)", "1.1", "(a)", "a)", "i)"
# Requires explicit punctuation delimiters around label so "60 minutes" never matches
SUBQUESTION_PREFIX_RE = re.compile(
    r'^(?:(\d{1,3})\s*(?:\(\s*([a-zA-Z]|[ivxIVX]{1,4})\s*\)|\.\s*([a-zA-Z]|[ivxIVX]{1,4}))\s*[\.\)]?|(?:\(\s*([a-zA-Z]|[ivxIVX]{1,4})\s*\)|([a-zA-Z]|[ivxIVX]{1,4})\s*[\.\)]))\s+(.*)'
)

# Compound numbering: "1.1", "1.2", "2.1"
COMPOUND_Q_NUM_RE = re.compile(
    r'^(\d{1,3}\.\d{1,2})[\.\:\-\s]\s*(.*)'
)

# Imperative question starting verbs (for questions that lack traditional numbers)
IMPERATIVE_VERBS = [
    "define", "explain", "calculate", "derive", "compare", "differentiate",
    "illustrate", "describe", "discuss", "evaluate", "determine", "find",
    "solve", "state and prove", "state whether", "state", "prove that", "show that",
    "construct", "list", "identify", "analyze", "summarize", "distinguish between",
    "write short note on", "write down", "give reasons for", "what is", "why does",
    "how does", "which of the following", "name the", "outline"
]
IMPERATIVE_Q_RE = re.compile(
    r'^(?:' + '|'.join(re.escape(v) for v in IMPERATIVE_VERBS) + r')\b',
    re.IGNORECASE
)

# ---------------------------------------------------------------------------
# 3. MARKS EXTRACTION PATTERNS
# ---------------------------------------------------------------------------

# [2 Marks], (5 marks), [3 pts], (1 Mark), [4], (2), [1+2=3 marks]
MARKS_RE = re.compile(
    r'(?:\[|\()\s*(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?|m)?\s*(?:\]|\))\s*$|'
    r'(?:\[|\()\s*(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)\s*(?:\]|\))|'
    r'\b(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)\s*$',
    re.IGNORECASE
)

# Split compound marks like "[2 + 3 = 5 Marks]" or "[2+3 Marks]"
COMPOUND_MARKS_RE = re.compile(
    r'(?:\[|\()\s*(\d+)\s*\+\s*(\d+)\s*(?:=\s*\d+)?\s*(?:marks?|pts?)\s*(?:\]|\))',
    re.IGNORECASE
)

# ---------------------------------------------------------------------------
# 4. MCQ OPTION DETECTION PATTERNS (VERTICAL & HORIZONTAL INLINE)
# ---------------------------------------------------------------------------

# Vertical single-line options: "(A) Option text", "A. Option text", "A) Option text", "(a) ..."
VERTICAL_OPTION_RE = re.compile(
    r'^(?:\(?([A-Da-d])\)|\(?([A-Da-d])\.)\s+(.*)'
)

# Numeric vertical options: "(1) Option", "1. Option" (used in some standard exams)
NUMERIC_OPTION_RE = re.compile(
    r'^(?:\(?([1-6])\)|\(?([1-6])\.)\s+(.*)'
)

# Roman vertical options: "(i) Option", "i) Option"
ROMAN_OPTION_RE = re.compile(
    r'^(?:\(?([ivxIVX]{1,4})\)|\(?([ivxIVX]{1,4})\.)\s+(.*)'
)

# Horizontal inline options pattern:
# Example: "(A) Joule   (B) Newton   (C) Watt   (D) Pascal"
# Example: "A) 10    B) 20    C) 30    D) 40"
# Example: "A. Yes   B. No    C. Maybe"
INLINE_OPTIONS_BRACKET_RE = re.compile(
    r'\(?([A-Da-d1-4])\)[\s\.]+(.*?)(?=\s*\(?[A-Da-d1-4]\)[\s\.]+|\s*$)'
)

INLINE_OPTIONS_DOT_RE = re.compile(
    r'\b([A-Da-d])\.[\s]+(.*?)(?=\s+[A-Da-d]\.|\s*$)'
)

# ---------------------------------------------------------------------------
# 5. QUESTION TYPE SIGNATURES
# ---------------------------------------------------------------------------

TRUE_FALSE_RE = re.compile(
    r'\b(?:state\s+(?:whether\s+)?true\s+or\s+false|true\s*(?:or|/)\s*false)\b',
    re.IGNORECASE
)

FILL_BLANKS_RE = re.compile(
    r'(?:_{3,}|\.{4,}|\[blank\]|\bfill\s+in\s+the\s+blanks?\b)',
    re.IGNORECASE
)

MATCH_FOLLOWING_RE = re.compile(
    r'\b(?:match\s+the\s+(?:following|items|elements|terms|pairs|columns?)|'
    r'match\b.*?\b(?:list|column)\s*[-:]?\s*(?:I|1|A)\b.*?\b(?:list|column)\s*[-:]?\s*(?:II|2|B)\b|'
    r'column\s*[A1]\b.*?\bcolumn\s*[B2]\b|'
    r'list\s*[-:]?\s*I\b.*?\blist\s*[-:]?\s*II\b)\b',
    re.IGNORECASE
)

ASSERTION_REASON_RE = re.compile(
    r'\b(?:assertion\s*\(?A\)?\s*[:\-].*reason\s*\(?R\)?\s*[:\-]|assertion\s*and\s*reason)\b',
    re.IGNORECASE
)

NUMERICAL_RE = re.compile(
    r'\b(?:calculate|find\s+the\s+value|determine\s+the\s+(?:magnitude|velocity|speed|mass|energy|force|power|current|frequency|distance|acceleration)|compute|how\s+many|how\s+much)\b',
    re.IGNORECASE
)

MATHEMATICAL_RE = re.compile(
    r'(?:\\frac|\\int|\\sum|\\sqrt|\$|derive\s+the\s+formula|derive\s+the\s+expression|prove\s+that|show\s+that\s+\$)',
    re.IGNORECASE
)

DIAGRAM_RE = re.compile(
    r'\b(?:figure\s*(?:\d+|[A-Z])|fig\.\s*\d+|diagram\s+below|graph\s+shown|circuit\s+diagram|given\s+figure|refer\s+to\s+the\s+diagram)\b',
    re.IGNORECASE
)

CASE_STUDY_RE = re.compile(
    r'\b(?:read\s+the\s+(?:following\s+)?(?:passage|case\s+study|extract|scenario)\s+and\s+answer|case\s+study\s*[:\-]|passage\s+based\s+questions?)\b',
    re.IGNORECASE
)

MULTIPLE_SELECT_RE = re.compile(
    r'\b(?:select\s+all\s+that\s+apply|which\s+of\s+the\s+following\s+are|choose\s+(?:two|three|multiple)|one\s+or\s+more\s+(?:than\s+one\s+)?options?\s+may\s+be\s+correct)\b',
    re.IGNORECASE
)


def is_non_question_line(line: str) -> Tuple[bool, str]:
    """
    Checks if a line of text is a section heading, instruction, metadata, or noise.
    Returns: (is_non_question, category)
    """
    clean = line.strip()
    if not clean:
        return True, "empty"

    if DIVIDER_LINE_RE.match(clean) or ANSWER_BLANK_RE.match(clean):
        return True, "divider"

    if PAGE_FOOTER_RE.match(clean):
        return True, "footer_noise"

    if MARK_DISTRIBUTION_RE.match(clean):
        return True, "mark_distribution"

    if CANDIDATE_FORM_RE.match(clean):
        return True, "candidate_form"

    sec_m = SECTION_HEADER_RE.match(clean) or STANDALONE_SECTION_RE.match(clean)
    if sec_m:
        return True, "section_header"

    if METADATA_HEADER_RE.match(clean):
        return True, "metadata_header"

    if INSTRUCTION_RE.match(clean):
        return True, "instruction"

    return False, ""


def extract_horizontal_options(line: str) -> List[Dict[str, Any]]:
    """
    Attempts to extract horizontal inline options from a single line.
    Returns a list of dicts: [{"option_label": "A", "option_text": "text"}, ...]
    Must find at least 2 distinct valid options in logical sequence (e.g. A and B, or A, B, C, D).
    """
    # 1. Try parenthesized/bracketed options: (A) ... (B) ... (C) ... (D) ...
    matches = list(INLINE_OPTIONS_BRACKET_RE.finditer(line))
    if len(matches) >= 2:
        results = []
        labels_seen = []
        for idx, m in enumerate(matches):
            raw_label = m.group(1).upper()
            text = m.group(2).strip()
            # If text is empty or just punctuation, skip
            if not text:
                continue
            labels_seen.append(raw_label)
            results.append({
                "option_label": raw_label,
                "option_text": text,
                "is_correct": False,
                "order_index": idx
            })
        if len(results) >= 2 and _is_valid_option_sequence(labels_seen):
            # If options contain imperative question commands (e.g. "Define...", "Calculate..."), they are subquestions, not choices!
            if any(IMPERATIVE_Q_RE.match(r["option_text"]) or "?" in r["option_text"] for r in results):
                return []
            return results

    # 2. Try dotted options: A. ... B. ... C. ... D. ...
    matches_dot = list(INLINE_OPTIONS_DOT_RE.finditer(line))
    if len(matches_dot) >= 2:
        results = []
        labels_seen = []
        for idx, m in enumerate(matches_dot):
            raw_label = m.group(1).upper()
            text = m.group(2).strip()
            if not text:
                continue
            labels_seen.append(raw_label)
            results.append({
                "option_label": raw_label,
                "option_text": text,
                "is_correct": False,
                "order_index": idx
            })
        if len(results) >= 2 and _is_valid_option_sequence(labels_seen):
            if any(IMPERATIVE_Q_RE.match(r["option_text"]) or "?" in r["option_text"] for r in results):
                return []
            return results

    return []


def _is_valid_option_sequence(labels: List[str]) -> bool:
    """Verifies that option labels follow a rational sequence like ['A', 'B', 'C', 'D'] or ['1', '2']"""
    if len(labels) < 2:
        return False
    # Check A, B, C, D...
    expected_alpha = [chr(65 + i) for i in range(len(labels))]
    if labels == expected_alpha:
        return True
    # Check 1, 2, 3, 4...
    expected_num = [str(i + 1) for i in range(len(labels))]
    if labels == expected_num:
        return True
    return False


# ---------------------------------------------------------------------------
# 5. SUPPORTED QUESTION TYPES
# ---------------------------------------------------------------------------
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
SUPPORTED_QUESTION_TYPES = QUESTION_TYPES


