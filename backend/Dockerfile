# syntax=docker/dockerfile:1

FROM python:3.12-slim

# Copy uv from the official uv image.
COPY --from=ghcr.io/astral-sh/uv:0.12.18 /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0 \
    PATH="/app/.venv/bin:$PATH"

# libgomp1 is needed by parts of the numerical/ML stack.
# Create a non-root application user as well.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid 10001 --no-create-home app \
    && mkdir -p /app \
    && chown app:app /app

WORKDIR /app

# Copy dependency definitions first so Docker can cache this expensive layer.
COPY pyproject.toml uv.lock ./

# Install production dependencies only.
RUN uv sync --locked --no-dev

# Now copy application source.
COPY --chown=app:app src ./src

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/status', timeout=3)"

CMD ["uvicorn", "main:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]