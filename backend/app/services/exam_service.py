import io
import base64
import secrets
import urllib.parse
import qrcode
from typing import Dict, Any, Optional
from app.config import settings
from app.models.exam import Exam

class ExamService:
    @staticmethod
    def generate_invitation_token() -> str:
        """Generate a cryptographically secure random invitation token"""
        return f"exm_{secrets.token_hex(16)}"

    @staticmethod
    def generate_session_token() -> str:
        """Generate a unique session token for a student exam session"""
        return f"ses_{secrets.token_hex(20)}"

    @classmethod
    def generate_qr_code_base64(cls, url: str) -> str:
        """Generate a QR code as a base64-encoded PNG image data URI"""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        qr.add_data(url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="#171717", back_color="#FBF9F3")
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{img_str}"

    @classmethod
    def get_publishing_payload(cls, exam: Exam, base_url: Optional[str] = None) -> Dict[str, Any]:
        """Construct invitation links, QR code, and pre-formatted sharing templates"""
        token = exam.invitation_token
        frontend_base = (base_url or settings.frontend_url or "https://examia.athulvinodkumar08.workers.dev").rstrip("/")
        if "localhost" in frontend_base or "127.0.0.1" in frontend_base:
            frontend_base = "https://examia.athulvinodkumar08.workers.dev"
        invitation_url = f"{frontend_base}/app.html#exam-invite/{token}"
        qr_code_data = cls.generate_qr_code_base64(invitation_url)

        # Formatted customizable message
        duration_text = f"{exam.duration_minutes} minutes"
        marks_text = f"{exam.total_marks} Marks"
        q_count = len(exam.questions) if exam.questions else 0
        passcode_note = f"\nPasscode: {exam.passcode}" if exam.passcode else ""

        share_text = (
            f"Hello! You have been invited to take the examination: {exam.title}.\n\n"
            f"Subject: {exam.subject or 'General'}\n"
            f"Questions: {q_count} | Total Marks: {marks_text}\n"
            f"Duration: {duration_text}{passcode_note}\n\n"
            f"Access your examination here:\n{invitation_url}\n\n"
            f"Please read instructions before starting. Good luck!"
        )

        # WhatsApp link
        whatsapp_url = f"https://api.whatsapp.com/send?text={urllib.parse.quote(share_text)}"

        # Email mailto link
        email_subject = urllib.parse.quote(f"Exam Invitation: {exam.title}")
        email_body = urllib.parse.quote(share_text)
        email_url = f"mailto:?subject={email_subject}&body={email_body}"

        return {
            "id": str(exam.id),
            "title": exam.title,
            "status": exam.status,
            "invitation_token": token,
            "invitation_url": invitation_url,
            "qr_code_base64": qr_code_data,
            "question_count": q_count,
            "total_marks": exam.total_marks,
            "duration_minutes": exam.duration_minutes,
            "share_text": share_text,
            "whatsapp_url": whatsapp_url,
            "email_url": email_url
        }
