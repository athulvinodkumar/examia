"""
EXAMIA INTELLIGENT QUESTION PAPER EXTRACTION TEST SUITE
Comprehensive test scenarios covering all 14 requirements:
  1. Section headings never extracted as questions
  2. Document metadata & instructions excluded
  3. MCQs with vertical options detection
  4. MCQs with horizontal inline options detection
  5. Questions without question marks (imperative commands)
  6. Subquestions (1(a), 1(b), 1.1, 1.2)
  7. Multi-page question continuation across footer noise
  8. Numerical problems with equations and units
  9. Match the following questions
  10. True / False questions
  11. Case study / passage-based questions
  12. Scanned / noisy text document resilience
  13. Diagram and figure-based questions
  14. Confidence scoring & teacher review flagging
  15. Complete regression test for Section-A and MCQ failure
"""

import pytest
from app.services.document_parser import IntelligentDocumentParser
from app.services.document_parser.patterns import (
    is_non_question_line,
    extract_horizontal_options
)
from app.services.document_parser.metadata_extractor import MetadataExtractor
from app.services.document_parser.classifier import QuestionClassifier
from app.services.document_parser.multi_stage_pipeline import MultiStagePipeline


# ===========================================================================
# 1. SECTION HEADINGS NEVER EXTRACTED AS QUESTIONS
# ===========================================================================
def test_section_headings_not_extracted_as_questions():
    sample_text = """
    NATIONAL INSTITUTE OF TECHNOLOGY
    ANNUAL EXAMINATION 2026
    
    SECTION-A: OBJECTIVE QUESTIONS
    PART I: FOUNDATIONAL CONCEPTS
    
    1. Define electric current. [2]
    
    SECTION B - SHORT ANSWER QUESTIONS
    
    2. Explain Lenz's Law of electromagnetic induction. [3]
    
    PART III: ADVANCED ESSAYS
    
    3. Describe the operation of a nuclear reactor. [5]
    """
    result = IntelligentDocumentParser.parse_text(sample_text)
    questions = result["questions"]

    # Exactly 3 questions, zero sections converted into questions
    assert len(questions) == 3
    q_texts = [q["question_text"] for q in questions]
    for text in q_texts:
        assert not text.startswith("SECTION")
        assert not text.startswith("PART")
        assert "OBJECTIVE QUESTIONS" not in text
        assert "SHORT ANSWER QUESTIONS" not in text

    # Verify sections were detected in metadata
    sections = result["sections"]
    assert any("SECTION" in s.upper() or "PART" in s.upper() for s in sections)


# ===========================================================================
# 2. DOCUMENT METADATA & INSTRUCTIONS EXCLUDED
# ===========================================================================
def test_metadata_and_instructions_excluded():
    sample_text = """
    CAMBRIDGE REGIONAL BOARD
    Subject: Applied Physics
    Course Code: PHY-301
    Time: 3 Hours
    Max Marks: 100
    Roll No: _______________
    Candidate Name: _____________________
    
    General Instructions:
    1. Answer all questions.
    2. Figures to the right indicate full marks.
    3. Use of non-programmable calculators is permitted.
    
    --------------------------------------------------
    
    1. State the first law of thermodynamics. [2]
    2. Calculate the work done in an isothermal expansion. [4]
    """
    result = IntelligentDocumentParser.parse_text(sample_text)
    questions = result["questions"]
    metadata = result["metadata"]

    assert len(questions) == 2
    assert "Physics" in metadata.get("subject", "")
    assert metadata.get("total_marks") == 100.0
    assert metadata.get("duration_minutes") == 180

    for q in questions:
        text = q["question_text"].lower()
        assert "general instructions" not in text
        assert "answer all questions" not in text
        assert "candidate name" not in text
        assert "roll no" not in text


# ===========================================================================
# 3. MCQs WITH VERTICAL OPTIONS DETECTION
# ===========================================================================
def test_mcq_vertical_options_detection():
    sample_text = """
    1. What is the SI unit of electric potential?
       (a) Ampere
       (b) Volt
       (c) Ohm
       (d) Farad
    
    2. Which planet is closest to the Sun?
       A. Venus
       B. Mercury
       C. Mars
       D. Jupiter
    """
    result = IntelligentDocumentParser.parse_text(sample_text)
    questions = result["questions"]

    assert len(questions) == 2
    q1 = questions[0]
    assert q1["question_type"] == "mcq_single"
    assert len(q1["options"]) == 4
    assert q1["options"][0]["option_label"] == "A"
    assert q1["options"][0]["option_text"] == "Ampere"
    assert q1["options"][1]["option_text"] == "Volt"
    # Never invent correct answer unless key is provided
    assert all(opt["is_correct"] is False for opt in q1["options"])

    q2 = questions[1]
    assert q2["question_type"] == "mcq_single"
    assert len(q2["options"]) == 4
    assert q2["options"][1]["option_label"] == "B"
    assert q2["options"][1]["option_text"] == "Mercury"


# ===========================================================================
# 4. MCQs WITH HORIZONTAL INLINE OPTIONS DETECTION
# ===========================================================================
def test_mcq_horizontal_inline_options_detection():
    sample_text = """
    1. What is the value of gravitational acceleration on Earth's surface?
       A) 9.8 m/s^2    B) 8.9 m/s^2    C) 11.2 m/s^2    D) 6.4 m/s^2
    
    2. Which of the following numbers is prime?
       (a) 15  (b) 21  (c) 29  (d) 35
    """
    result = IntelligentDocumentParser.parse_text(sample_text)
    questions = result["questions"]

    assert len(questions) == 2

    q1 = questions[0]
    assert q1["question_type"] == "mcq_single"
    assert len(q1["options"]) == 4
    assert q1["options"][0]["option_text"] == "9.8 m/s^2"
    assert q1["options"][3]["option_text"] == "6.4 m/s^2"
    # The options should be removed from the question stem
    assert "A)" not in q1["question_text"]
    assert "B)" not in q1["question_text"]

    q2 = questions[1]
    assert q2["question_type"] == "mcq_single"
    assert len(q2["options"]) == 4
    assert q2["options"][2]["option_text"] == "29"


# ===========================================================================
# 5. QUESTIONS WITHOUT QUESTION MARKS (IMPERATIVE COMMANDS)
# ===========================================================================
def test_questions_without_question_marks():
    sample_text = """
    1. Define specific heat capacity of a substance. [2 Marks]
    2. Derive the formula for kinetic energy $E_k = \\frac{1}{2}mv^2$. [4 Marks]
    3. Discuss the economic consequences of hyperinflation. [5 Marks]
    """
    result = IntelligentDocumentParser.parse_text(sample_text)
    questions = result["questions"]

    assert len(questions) == 3
    assert questions[0]["marks"] == 2.0
    assert questions[1]["marks"] == 4.0
    assert questions[2]["marks"] == 5.0

    assert questions[0]["question_type"] == "short_answer"
    assert questions[1]["question_type"] in ("mathematical", "long_answer")
    assert questions[2]["question_type"] == "long_answer"


# ===========================================================================
# 6. SUBQUESTIONS HANDLING (1(a), 1(b))
# ===========================================================================
def test_subquestions_handling():
    sample_text = """
    1. An alternating voltage source is connected to a resistor:
       1(a) Define root mean square (RMS) voltage.
       1(b) Calculate the peak current when RMS voltage is 220V and R = 50 ohms.
    
    2. Answer the following:
       (a) State Ohm's law.
       (b) Draw its V-I characteristics graph.
    """
    result = IntelligentDocumentParser.parse_text(sample_text)
    questions = result["questions"]

    assert len(questions) == 2
    q1 = questions[0]
    assert len(q1["subquestions"]) >= 2 or "(a)" in q1["question_text"]
    assert "RMS voltage" in q1["question_text"]


# ===========================================================================
# 7. MULTI-PAGE QUESTION CONTINUATION ACROSS FOOTER NOISE
# ===========================================================================
def test_multipage_continuation_across_footers():
    sample_text = """
    1. A uniform cylindrical rod of length 2.0 meters and cross-sectional area
       of 0.05 m^2 is subjected to a tensile force of 5000 N.
    
    Page 1 of 4
    Examination Series 2026 - CONFIDENTIAL
    --------------------------------------------------
    
       Calculate Young's modulus of elasticity if the rod elongates by 1.2 mm. [4]
    
    2. Name the SI unit of Young's modulus. [1]
    """
    result = IntelligentDocumentParser.parse_text(sample_text)
    questions = result["questions"]

    assert len(questions) == 2
    q1 = questions[0]
    # Page noise should be stripped out
    assert "Page 1 of 4" not in q1["question_text"]
    assert "CONFIDENTIAL" not in q1["question_text"]
    # The two segments should be joined
    assert "tensile force of 5000 N" in q1["question_text"]
    assert "Young's modulus" in q1["question_text"]
    assert q1["marks"] == 4.0


# ===========================================================================
# 8. NUMERICAL PROBLEM CLASSIFICATION
# ===========================================================================
def test_numerical_problem_classification():
    sample_text = """
    1. A bullet of mass 0.02 kg travels at a speed of 400 m/s and strikes a block of mass 2 kg.
       Calculate the common velocity of the block and bullet after impact. [3 Marks]
    """
    result = IntelligentDocumentParser.parse_text(sample_text)
    questions = result["questions"]

    assert len(questions) == 1
    assert questions[0]["question_type"] == "numerical"
    assert questions[0]["marks"] == 3.0


# ===========================================================================
# 9. MATCH THE FOLLOWING QUESTIONS
# ===========================================================================
def test_match_the_following_classification():
    sample_text = """
    1. Match the elements in List-I with their properties in List-II:
       List-I              List-II
       (P) Silicon         (1) Conductor
       (Q) Copper          (2) Semiconductor
       (R) Diamond         (3) Insulator
    """
    result = IntelligentDocumentParser.parse_text(sample_text)
    questions = result["questions"]

    assert len(questions) == 1
    assert questions[0]["question_type"] == "match_following"


# ===========================================================================
# 10. TRUE / FALSE QUESTIONS
# ===========================================================================
def test_true_false_classification():
    sample_text = """
    1. Light waves can propagate through a complete vacuum. State True or False. [1 Mark]
    2. Sound waves are transverse electromagnetic waves. True / False. [1 Mark]
    """
    result = IntelligentDocumentParser.parse_text(sample_text)
    questions = result["questions"]

    assert len(questions) == 2
    for q in questions:
        assert q["question_type"] == "true_false"
        assert len(q["options"]) == 2
        texts = [opt["option_text"].lower() for opt in q["options"]]
        assert "true" in texts
        assert "false" in texts


# ===========================================================================
# 11. CASE STUDY / PASSAGE-BASED QUESTIONS
# ===========================================================================
def test_case_study_classification():
    sample_text = """
    1. Read the following passage and answer the questions:
       Case Study: Photovoltaic Cells and Solar Energy Transition
       Solar cells convert photon energy into electrical potential via the photoelectric effect.
       Silicon-doped semiconductors generate electron-hole pairs under solar radiation.
       Based on the passage, explain the role of p-n junction in power generation. [5 Marks]
    """
    result = IntelligentDocumentParser.parse_text(sample_text)
    questions = result["questions"]

    assert len(questions) == 1
    assert questions[0]["question_type"] == "case_study"
    assert questions[0]["marks"] == 5.0


# ===========================================================================
# 12. SCANNED / NOISY TEXT DOCUMENT RESILIENCE
# ===========================================================================
def test_noisy_text_resilience():
    sample_text = """
    *** EXAMINATION DOCUMENT ***
    ============================
    
    ~ . ~ . ~ . ~ . ~ . ~ . ~ . ~
    
    1. State Newton's third law of motion.
    
    ----------------------------
    Page 1 | Printed by Xerox DocuCentre
    ----------------------------
    
    2. What happens when an action force acts on an object?
    """
    result = IntelligentDocumentParser.parse_text(sample_text)
    questions = result["questions"]

    assert len(questions) == 2
    assert "Newton's third law" in questions[0]["question_text"]
    assert "action force" in questions[1]["question_text"]


# ===========================================================================
# 13. DIAGRAM AND FIGURE-BASED QUESTIONS
# ===========================================================================
def test_diagram_based_classification():
    sample_text = """
    1. In the given circuit diagram shown in Figure 2.1, calculate the equivalent resistance between nodes A and B. [4 Marks]
    """
    result = IntelligentDocumentParser.parse_text(sample_text)
    questions = result["questions"]

    assert len(questions) == 1
    assert questions[0]["question_type"] == "diagram_based"
    assert questions[0]["marks"] == 4.0


# ===========================================================================
# 14. CONFIDENCE SCORING & TEACHER REVIEW FLAGGING
# ===========================================================================
def test_confidence_scoring_and_review_flags():
    # A clear, numbered question with marks and options should have very high confidence (>= 0.90)
    high_conf_q = """
    1. What is the capital of France? [2 Marks]
       (A) London
       (B) Berlin
       (C) Paris
       (D) Rome
    """
    res1 = IntelligentDocumentParser.parse_text(high_conf_q)
    q1 = res1["questions"][0]
    assert q1["confidence_score"] >= 0.90
    assert q1["review_status"] == "verified"
    assert "breakdown" in str(q1.keys()).lower()

    # An unnumbered, ambiguous sentence without clear marks should have lower confidence and require review
    low_conf_q = """
    Some students think that energy is conserved while others disagree.
    """
    res2 = IntelligentDocumentParser.parse_text(low_conf_q)
    if res2["questions"]:
        q2 = res2["questions"][0]
        assert q2["review_status"] == "needs_review" or q2["confidence_score"] < 0.90


# ===========================================================================
# 15. FULL REGRESSION TEST: USER'S EXACT SCENARIO
# ===========================================================================
def test_regression_user_exact_scenario():
    """
    The exact scenario provided in the user's prompt:
    SECTION A — Multiple Choice Questions
    1. What is the SI unit of force?
       (a) Joule
       (b) Newton
       (c) Watt
       (d) Pascal
    2. Which of the following is a semiconductor?
       (a) Copper
       (b) Silicon
       (c) Aluminium
       (d) Silver
    SECTION B — Short Answer Questions
    3. Define electric current.
    4. Explain Ohm's law.
    SECTION C — Long Answer Questions
    5. Derive the expression for RMS voltage.
    """
    paper = """
    SECTION A — Multiple Choice Questions

    1. What is the SI unit of force?
       (a) Joule
       (b) Newton
       (c) Watt
       (d) Pascal

    2. Which of the following is a semiconductor?
       (a) Copper
       (b) Silicon
       (c) Aluminium
       (d) Silver

    SECTION B — Short Answer Questions

    3. Define electric current.

    4. Explain Ohm's law.

    SECTION C — Long Answer Questions

    5. Derive the expression for RMS voltage.
    """
    result = IntelligentDocumentParser.parse_text(paper)
    questions = result["questions"]

    # 1. Section A, Section B, Section C are NOT questions! Exactly 5 questions.
    assert len(questions) == 5, f"Expected 5 questions, got {len(questions)}"

    # 2. Check question numbers & text
    assert "SI unit of force" in questions[0]["question_text"]
    assert "semiconductor" in questions[1]["question_text"]
    assert "electric current" in questions[2]["question_text"]
    assert "Ohm's law" in questions[3]["question_text"]
    assert "RMS voltage" in questions[4]["question_text"]

    # 3. Q1 and Q2 MUST be recognized as MCQs with 4 options each!
    assert questions[0]["question_type"] == "mcq_single"
    assert len(questions[0]["options"]) == 4
    assert [o["option_label"] for o in questions[0]["options"]] == ["A", "B", "C", "D"]

    assert questions[1]["question_type"] == "mcq_single"
    assert len(questions[1]["options"]) == 4
    assert [o["option_label"] for o in questions[1]["options"]] == ["A", "B", "C", "D"]

    # 4. Q3 and Q4 are short answers
    assert questions[2]["question_type"] == "short_answer"
    assert questions[3]["question_type"] == "short_answer"

    # 5. Q5 is long answer or derivation/mathematical
    assert questions[4]["question_type"] in ("long_answer", "mathematical")

    # 6. Section association
    assert "Section A" in questions[0]["section_title"]
    assert "Section A" in questions[1]["section_title"]
    assert "Section B" in questions[2]["section_title"]
    assert "Section B" in questions[3]["section_title"]
    assert "Section C" in questions[4]["section_title"]


def test_actual_uploaded_pdf_examia_test_paper():
    import os
    import fitz
    pdf_path = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "9a74aded-9ef2-413f-a1cd-91a61d0f4207_Examia_Test_Question_Paper.pdf")
    if not os.path.exists(pdf_path):
        return

    doc = fitz.open(pdf_path)
    text = "\n".join([p.get_text() for p in doc])
    result = IntelligentDocumentParser.parse_text(text)
    
    assert result["metadata"]["total_marks"] == 50.0
    assert result["metadata"]["duration_minutes"] == 60
    assert result["question_count"] == 17
    
    questions = result["questions"]
    assert len(questions) == 17

    # Q1..Q10 are mcq_single with 4 distinct options
    for i in range(10):
        q = questions[i]
        assert q["question_type"] == "mcq_single", f"Q{q['question_number']} expected mcq_single"
        assert len(q["options"]) == 4
        assert [o["option_label"] for o in q["options"]] == ["A", "B", "C", "D"]
        assert q["marks"] == 1.0

    # Q6 Option D check for wrapped option continuation
    q6 = questions[5]
    assert q6["options"][3]["option_label"] == "D"
    assert q6["options"][3]["option_text"] == "Unified Routing Language"

    # Q11..Q15 are short_answer with 4 marks each
    for i in range(10, 15):
        q = questions[i]
        assert q["question_type"] == "short_answer", f"Q{q['question_number']} expected short_answer"
        assert q["marks"] == 4.0
        assert "___" not in q["question_text"]

    # Q16..Q17 are long_answer with 10 marks each
    for i in range(15, 17):
        q = questions[i]
        assert q["question_type"] == "long_answer", f"Q{q['question_number']} expected long_answer"
        assert q["marks"] == 10.0
        assert "___" not in q["question_text"]
