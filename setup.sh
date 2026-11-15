#!/usr/bin/env bash
# =====================================================================
# EXAMIA SETUP SCRIPT (LINUX MINT & UBUNTU READY)
# Prepares environment, virtualenv, dependencies, migrations, and test data
# =====================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "           EXAMIA — ENVIRONMENT & DATABASE SETUP            "
echo "============================================================"

# 1. Check Python
if ! command -v python3 &> /dev/null; then
    echo "✗ Error: Python 3 is required but not installed."
    exit 1
fi
PYTHON_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "✓ Found Python $PYTHON_VER"

# 2. Virtual Environment Setup
if [ ! -d "backend/venv" ]; then
    echo "Creating Python virtual environment in backend/venv..."
    if ! python3 -m venv backend/venv 2>/dev/null; then
        echo "Note: Using standalone pip bootstrap for Ubuntu/Mint..."
        python3 -m venv --without-pip backend/venv
        curl -sS https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py
        backend/venv/bin/python /tmp/get-pip.py
        rm -f /tmp/get-pip.py
    fi
fi

# 3. Install Python Dependencies
echo "Installing backend dependencies from backend/requirements.txt..."
backend/venv/bin/pip install --upgrade pip --quiet
backend/venv/bin/pip install -r backend/requirements.txt --quiet
echo "✓ Backend dependencies successfully installed."

# 4. Environment Files Setup
if [ ! -f "backend/.env" ]; then
    echo "Creating backend/.env from .env.example..."
    cp backend/.env.example backend/.env
fi

if [ ! -f "frontend/.env" ]; then
    echo "Creating frontend/.env from .env.example..."
    cp frontend/.env.example frontend/.env
fi

# 5. Initialize Database Schema
echo "Initializing database schema..."
PYTHONPATH=backend backend/venv/bin/python -c "
from app.database import init_db
init_db()
print('✓ Database tables verified and ready.')
"

# 6. Generate Sample PDF Paper
if [ ! -f "sample_data/sample_exam.pdf" ]; then
    echo "Generating sample question paper in sample_data/sample_exam.pdf..."
    mkdir -p sample_data
    PYTHONPATH=backend backend/venv/bin/python -c "
import fitz
doc = fitz.open()
page = doc.new_page()
text = '''EXAMIA COMPREHENSIVE PHYSICS & COMPUTING EXAMINATION
Course: Advanced Physics & Digital Systems (PH-202)
Time Allowed: 60 Minutes | Total Marks: 50
--------------------------------------------------------------------------------

SECTION A: MECHANICS & GRAVITATION (MCQ)

1. What is the escape velocity from the surface of Earth? [2 Marks]
(A) 7.9 km/s
(B) 11.2 km/s
(C) 16.7 km/s
(D) 30.0 km/s

2. A satellite is in orbit around Earth at radius R. If the orbital radius is doubled to 2R, by what factor does its orbital period change according to Kepler's Third Law? [2 Marks]
(A) 2.0 times
(B) 2.83 times (2*sqrt(2))
(C) 4.0 times
(D) 1.41 times

3. State whether the following is True or False: In an isolated system, the total mechanical energy is always conserved even in the presence of friction. [1 Mark]
(A) True
(B) False

SECTION B: NUMERICAL PROBLEMS

4. Calculate the kinetic energy in Joules of a 1500 kg vehicle traveling at a constant speed of 20 m/s. [3 Marks]

5. Determine the de Broglie wavelength (in meters) of an electron moving with a velocity of 1.0e6 m/s. Use Planck constant h = 6.63e-34 J*s and electron mass m = 9.11e-31 kg. [4 Marks]

SECTION C: DESCRIPTIVE & ESSAY QUESTIONS

6. State Newton's Law of Universal Gravitation and derive the formula for gravitational acceleration at an altitude h above Earth's surface. Explain why astronauts feel weightless in orbit. [6 Marks]

7. Explain the working principle of a p-n junction diode in forward and reverse bias conditions. Describe the depletion layer and potential barrier. [6 Marks]
'''
page.insert_textbox(fitz.Rect(50, 50, 550, 800), text, fontsize=11, fontname='helv')
doc.save('sample_data/sample_exam.pdf')
"
fi

# 7. Run Test Suite
echo "Running automated verification tests..."
PYTHONPATH=backend backend/venv/bin/pytest backend/tests -q

echo ""
echo "============================================================"
echo "✓ EXAMIA SETUP COMPLETE!"
echo "To start the application, run:"
echo "   ./start.sh"
echo "============================================================"
