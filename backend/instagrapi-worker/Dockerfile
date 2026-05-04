# Python worker that pulls scheduled social items from the Medusa DB
# and publishes them to Instagram via instagrapi (unofficial client).
#
# Designed to run alongside the Medusa container, sharing:
#   - the `medusa_uploads` volume (read-only) for media files
#   - the postgres container for state
FROM python:3.12-slim

# ffmpeg is needed by instagrapi to clip/validate reel videos,
# and libmagic keeps mime-type detection reliable for uploads.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg libmagic1 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /worker

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY worker.py login.py ./

# Session cache (cookies) — persisted via volume so we don't log in every restart.
RUN mkdir -p /worker/sessions
VOLUME ["/worker/sessions"]

ENV PYTHONUNBUFFERED=1 \
    WORKER_POLL_SECONDS=30 \
    MEDIA_ROOT=/app/static \
    SESSION_DIR=/worker/sessions

CMD ["python", "worker.py"]
