#!/usr/bin/env bash
# =====================================================================
# EXAMIA STARTUP SCRIPT (LINUX MINT & UBUNTU READY)
# Checks config, starts FastAPI backend & frontend dev server
# =====================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Check virtual environment
if [ ! -f "backend/venv/bin/python" ]; then
    echo "Virtual environment not found. Running ./setup.sh first..."
    ./setup.sh
fi

echo "============================================================"
echo "           EXAMIA — AI-POWERED EXAMINATION PLATFORM         "
echo "============================================================"

# 2. Validate configuration
echo "[1/3] Validating system configuration..."
PYTHONPATH=backend backend/venv/bin/python -m app.check_config

# 3. Create upload directory
mkdir -p backend/uploads

# Clean up child processes on exit
cleanup() {
    echo ""
    echo "Stopping Examia background processes..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    echo "Examia stopped."
    exit 0
}

trap cleanup INT TERM EXIT

# 4. Start Backend
echo ""
echo "[2/3] Starting FastAPI Backend on http://localhost:8000..."
PYTHONPATH=backend backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 1.5
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "✗ Backend failed to start. Check terminal output above."
    exit 1
fi

# 5. Start Frontend Server with No-Cache Headers for Development
echo "[3/3] Starting Frontend Server on http://localhost:3000 (No-Cache)..."
python3 frontend/dev_server.py 3000 frontend &
FRONTEND_PID=$!

sleep 1
if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "✗ Frontend server failed to start."
    exit 1
fi

echo ""
echo "============================================================"
echo "  ✓ EXAMIA PLATFORM IS RUNNING AND READY!"
echo "============================================================"
echo "  • Landing Page:      http://localhost:3000/index.html"
echo "  • Sign-In Portal:    http://localhost:3000/login.html"
echo "  • Teacher/Student:   http://localhost:3000/app.html"
echo "  • Backend API Docs:  http://localhost:8000/docs"
echo "  • Backend Health:    http://localhost:8000/health"
echo "============================================================"
echo "  Press Ctrl + C at any time to stop all servers."
echo "============================================================"

# Keep alive waiting for background jobs
wait "$BACKEND_PID" "$FRONTEND_PID"
