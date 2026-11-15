import os
import re
import fitz  # PyMuPDF
from typing import List, Dict, Any, Optional
import docx

from app.services.document_parser import IntelligentDocumentParser
from app.services.document_parser.multi_stage_pipeline import MultiStagePipeline
from app.schemas.question import QuestionBase, OptionSchema

class DocumentProcessor:
    @staticmethod
    def extract_text_from_pdf(file_path: str) -> str:
        """Extract text from PDF with layout block ordering and page awareness"""
        text_pages = []
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            # Use block layout to handle multi-column and structured exam papers
            blocks = page.get_text("blocks")
            page_blocks = []
            for b in blocks:
                if b[6] == 0:  # Text block
                    b_text = b[4].strip()
                    if b_text:
                        page_blocks.append(b_text)
            if page_blocks:
                text_pages.append("\n".join(page_blocks))
            else:
                t = page.get_text("text").strip()
                if t:
                    text_pages.append(t)
        doc.close()
        return "\n\n".join(text_pages)

    @staticmethod
    def extract_text_from_docx(file_path: str) -> str:
        """Extract text from DOCX using python-docx with table preservation"""
        doc = docx.Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    paragraphs.append(row_text)
        return "\n\n".join(paragraphs)

    @staticmethod
    def parse_document_text_fallback(text: str) -> List[Dict[str, Any]]:
        """Intelligent rule-based question extraction for offline / local mode"""
        result = MultiStagePipeline.process_raw_text(text)
        return result.get("questions", [])

    @classmethod
    def process_document(cls, file_path: str, filename: str) -> Dict[str, Any]:
        """
        Full 5-stage intelligent extraction pipeline:
        Extracts raw document text, runs metadata identification, section parsing,
        horizontal/vertical option detection, 12-type classification, and validation.
        """
        ext = os.path.splitext(filename)[1].lower()
        extracted_text = ""
        
        if ext == ".pdf":
            extracted_text = cls.extract_text_from_pdf(file_path)
        elif ext in (".docx", ".doc"):
            extracted_text = cls.extract_text_from_docx(file_path)
        else:
            raise ValueError(f"Unsupported file format '{ext}'. Examia supports PDF and DOCX files.")

        if not extracted_text.strip():
            raise ValueError("The uploaded document contains no readable text. Ensure it is not an unreadable scan.")

        # Run Intelligent Document Parser (Gemini 2.0 Flash or 5-stage MultiStagePipeline)
        parsed_result = IntelligentDocumentParser.parse_text(extracted_text)

        return {
            "source": parsed_result.get("engine", "intelligent_parser"),
            "metadata": parsed_result.get("metadata", {}),
            "questions": parsed_result.get("questions", []),
            "question_count": len(parsed_result.get("questions", [])),
            "confidence_score": parsed_result.get("confidence_score", 0.95),
            "sections": parsed_result.get("sections", []),
            "raw_text_length": len(extracted_text),
            "warnings": parsed_result.get("warnings", [])
        }
