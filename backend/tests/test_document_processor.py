import os
import pytest
from app.services.document_processor import DocumentProcessor

def test_extract_text_and_questions_from_sample_pdf():
    pdf_path = "sample_data/sample_exam.pdf"
    assert os.path.exists(pdf_path), "Sample exam PDF must exist for testing"

    raw_text = DocumentProcessor.extract_text_from_pdf(pdf_path)
    assert len(raw_text) > 100
    assert "SECTION A" in raw_text
    assert "escape velocity" in raw_text

    result = DocumentProcessor.process_document(pdf_path, "sample_exam.pdf")
    assert "questions" in result
    questions = result["questions"]
    assert len(questions) >= 5

    # Check question 1 is MCQ
    q1 = questions[0]
    assert q1["question_number"] == 1
    assert q1["question_type"] == "mcq_single"
    assert len(q1["options"]) == 4
    assert q1["marks"] == 2.0

    # Check numerical question parsed
    q_num = next((q for q in questions if q["question_type"] == "numerical"), None)
    assert q_num is not None
    assert q_num["marks"] >= 1.0
