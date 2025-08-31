# Dockerfile for Django backend (improved)
FROM python:3.11-slim

# Keep logs unbuffered and avoid .pyc
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV POETRY_VIRTUALENVS_CREATE=false

WORKDIR /code

# Install system deps needed to build Python packages (libpq for Postgres)
# and a small tool (netcat) used by the entrypoint to wait-for-db if desired.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
      gcc \
      netcat-openbsd \
      curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user to run the app
ARG APP_USER=django
ARG APP_UID=1000
RUN adduser --disabled-password --gecos "" --uid ${APP_UID} ${APP_USER} || true

# Copy dependency file(s) first to leverage Docker cache
COPY requirements.txt /code/

# Upgrade pip and install Python deps
RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy project code
COPY . /code/

# Ensure files are owned by the non-root user
RUN chown -R ${APP_USER}:${APP_USER} /code

# Copy entrypoint (see below) and make it executable
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && chown : /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER ${APP_USER}

WORKDIR /code

EXPOSE 8000

# Entrypoint forwards to the CMD or overridden docker-compose command
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command; docker-compose commonly overrides this
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]


