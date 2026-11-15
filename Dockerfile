FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for pymupdf and psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy all application files (backend + frontend)
COPY backend ./backend
COPY frontend ./frontend

# Create uploads directory
RUN mkdir -p /app/backend/uploads /app/uploads

WORKDIR /app/backend
ENV PYTHONPATH=/app/backend

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
