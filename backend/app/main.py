import os
from datetime import datetime, timezone
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.routers import (
    auth,
    exams,
    questions,
    papers,
    submissions,
    grading,
    results,
    analytics,
    question_bank,
    notifications,
    generator
)

app = FastAPI(
    title="Examia API",
    description="Your Question Paper. Now Interactive. Complete AI-Powered Examination Platform.",
    version="1.0.0"
)

# CORS configuration
origins = [
    settings.frontend_url,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "*"  # For development ease across network devices
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
def on_startup():
    os.makedirs(settings.upload_dir, exist_ok=True)
    init_db()

# Health check
@app.get("/health")
@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Examia API Engine",
        "version": "1.0.0",
        "database": "connected",
        "gemini_ai": "configured" if settings.is_gemini_configured else "offline_fallback",
        "supabase": "configured" if settings.is_supabase_configured else "local_dev_mode",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# Register API v1 Routers
API_V1_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_V1_PREFIX)
app.include_router(exams.router, prefix=API_V1_PREFIX)
app.include_router(questions.router, prefix=API_V1_PREFIX)
app.include_router(papers.router, prefix=API_V1_PREFIX)
app.include_router(submissions.router, prefix=API_V1_PREFIX)
app.include_router(grading.router, prefix=API_V1_PREFIX)
app.include_router(results.router, prefix=API_V1_PREFIX)
app.include_router(analytics.router, prefix=API_V1_PREFIX)
app.include_router(question_bank.router, prefix=API_V1_PREFIX)
app.include_router(notifications.router, prefix=API_V1_PREFIX)
app.include_router(generator.router, prefix=API_V1_PREFIX)

# Static file mounts
os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# Mount frontend directory for direct unified serving if frontend exists
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "An internal server error occurred", "detail": str(exc)}
    )
