"""
EXAMIA INTELLIGENT QUESTION PARSER PACKAGE
"""

import os
from typing import Dict, Any
from app.config import settings
from app.services.document_parser.patterns import (
    is_non_question_line,
    extract_horizontal_options,
    QUESTION_TYPES
)
from app.services.document_parser.metadata_extractor import MetadataExtractor
from app.services.document_parser.classifier import QuestionClassifier
from app.services.document_parser.multi_stage_pipeline import MultiStagePipeline
from app.services.document_parser.gemini_pipeline import GeminiPipeline

class IntelligentDocumentParser:
    @classmethod
    def parse_text(cls, text: str, force_offline: bool = False) -> Dict[str, Any]:
        """
        Main entry point for parsing extracted examination paper text.
        Tries Gemini AI extraction first if API key configured (and not running unit tests),
        otherwise uses the intelligent 5-stage rule-based parsing engine.
        """
        is_testing = bool(os.environ.get("PYTEST_CURRENT_TEST") or settings.app_env == "test" or force_offline)

        # Try Gemini pipeline if configured and not running unit tests
        if not is_testing:
            gemini_result = GeminiPipeline.process_with_gemini(text)
            if gemini_result and gemini_result.get("questions") and len(gemini_result["questions"]) > 0:
                gemini_result["engine"] = "gemini_ai"
                return gemini_result

        # Run 5-stage multi-stage offline parsing pipeline
        result = MultiStagePipeline.process_raw_text(text)
        result["engine"] = "intelligent_offline_parser"
        return result
