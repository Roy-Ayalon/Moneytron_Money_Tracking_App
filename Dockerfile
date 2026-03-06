# ── MoneyTron Cloud Dockerfile ────────────────────────────────────────────────
FROM python:3.11-slim

# No bytecode / unbuffered logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy application code
COPY server/ ./server/
COPY client/ ./client/

# Copy screenshots & videos so the tutorial tab can render them
COPY screenshots/ ./screenshots/
COPY videos/ ./videos/

# Copy existing user data (seed / initial data)
# On Cloud Run with GCS volume mount, /app/users will be overridden by the bucket
COPY users/ ./users/

# The PORT env var is set by Cloud Run (defaults to 8080)
ENV PORT=8080
ENV MONEYTRON_DATA_DIR=/app/users

EXPOSE 8080

# Use gunicorn for production (better than waitress for Linux containers)
CMD exec gunicorn \
    --bind 0.0.0.0:${PORT} \
    --workers 2 \
    --threads 4 \
    --timeout 120 \
    --chdir /app/server \
    app:app
