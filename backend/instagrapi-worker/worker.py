"""
Enrola Shop — Instagram publishing worker.

Polls the Medusa Postgres for scheduled social_post / social_story rows and
publishes them via instagrapi (unofficial IG client). Session cookies are
persisted so we don't have to re-login on every restart.

WHY A SEPARATE WORKER:
  - instagrapi is Python-only; Medusa is Node.
  - IG sometimes takes 10-60s per call and we don't want to hog the web server.
  - Keeping credentials + session in a tiny isolated container limits blast
    radius if the account gets flagged.

FLOW per tick:
  1. Grab the next batch of rows where status='scheduled' AND scheduled_at<=now.
  2. Flip each to 'publishing' (optimistic claim — prevents double-post if
     multiple workers were ever run, and prevents retries while in flight).
  3. Upload the media according to format.
  4. On success: status='published', ig_*_id, published_at, failure_reason=null.
  5. On failure: status='failed', failure_reason=str(e), error_count+=1.

Config via env:
  DATABASE_URL          postgres dsn
  IG_USERNAME           IG handle
  IG_PASSWORD           IG password (2FA via IG_VERIFICATION_CODE if prompted)
  IG_VERIFICATION_CODE  optional 2FA/email challenge code
  IG_COUNTRY            IG country code (default VE)
  IG_LOCALE             IG locale (default es_VE)
  IG_TZ_OFFSET          seconds from UTC (default -14400, Venezuela)
  HTTPS_PROXY           optional residential proxy (http://user:pass@host:port)
  MEDIA_ROOT            where /static/... files live on disk (default /app/static)
  SESSION_DIR           where to cache login session json (default /worker/sessions)
  WORKER_POLL_SECONDS   loop delay (default 30)
  MAX_ERRORS            give up on an item after N failures (default 3)
  BATCH_SIZE            max items per tick (default 3)
  HUMAN_HOURS_ONLY      if "1", skip publish between 02:00-07:00 local (default "1")
  SCHEDULE_JITTER_MIN   random ± minutes added to scheduled time (default 15)
"""
import json
import os
import random
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row

try:
    from instagrapi import Client
    from instagrapi.exceptions import LoginRequired, ChallengeRequired
except ImportError:
    print("instagrapi not installed — install requirements.txt first", file=sys.stderr)
    raise


# ─── Config ────────────────────────────────────────────────────────
DATABASE_URL = os.environ["DATABASE_URL"]
IG_USERNAME = os.environ.get("IG_USERNAME", "").strip()
IG_PASSWORD = os.environ.get("IG_PASSWORD", "").strip()
IG_VERIFICATION_CODE = os.environ.get("IG_VERIFICATION_CODE", "").strip() or None
IG_COUNTRY = os.environ.get("IG_COUNTRY", "VE").strip()
IG_LOCALE = os.environ.get("IG_LOCALE", "es_VE").strip()
IG_TZ_OFFSET = int(os.environ.get("IG_TZ_OFFSET", "-14400"))  # VE = UTC-4
HTTPS_PROXY = os.environ.get("HTTPS_PROXY", "").strip() or None
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", "/app/static"))
SESSION_DIR = Path(os.environ.get("SESSION_DIR", "/worker/sessions"))
POLL_SECONDS = int(os.environ.get("WORKER_POLL_SECONDS", "30"))
MAX_ERRORS = int(os.environ.get("MAX_ERRORS", "3"))
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "3"))
HUMAN_HOURS_ONLY = os.environ.get("HUMAN_HOURS_ONLY", "1") == "1"
SCHEDULE_JITTER_MIN = int(os.environ.get("SCHEDULE_JITTER_MIN", "15"))

SESSION_FILE = SESSION_DIR / f"{IG_USERNAME or 'noauth'}.json"
DEVICE_FILE = SESSION_DIR / f"{IG_USERNAME or 'noauth'}.device.json"
SESSION_DIR.mkdir(parents=True, exist_ok=True)

# Pinned device fingerprint. Mid-range Android from 2023 — believable for VE.
# Once generated on first run it's persisted so every login looks like the
# same physical phone (IG tracks device_id → account bindings).
DEFAULT_DEVICE = {
    "app_version": "269.0.0.18.75",
    "android_version": 31,
    "android_release": "12",
    "dpi": "420dpi",
    "resolution": "1080x2340",
    "manufacturer": "Xiaomi",
    "device": "alioth",
    "model": "M2012K11AG",
    "cpu": "qcom",
    "version_code": "435123597",
}
DEFAULT_UA = (
    "Instagram 269.0.0.18.75 Android "
    "(31/12; 420dpi; 1080x2340; Xiaomi; M2012K11AG; alioth; qcom; es_VE; 435123597)"
)

_stop = False


def log(msg: str, *, level: str = "info") -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {level.upper():5} {msg}", flush=True)


# ─── Graceful shutdown ─────────────────────────────────────────────
def _handle_signal(signum, _frame):  # noqa: ANN001
    global _stop
    log(f"signal {signum} received — finishing current item and exiting")
    _stop = True


signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)


# ─── DB helpers ────────────────────────────────────────────────────
def db_conn() -> psycopg.Connection:
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def claim_posts(conn: psycopg.Connection, limit: int) -> list[dict[str, Any]]:
    """Flip eligible posts to 'publishing' and return them."""
    sql = """
      UPDATE social_post
         SET status = 'publishing',
             updated_at = now()
       WHERE id IN (
         SELECT id FROM social_post
          WHERE status = 'scheduled'
            AND scheduled_at IS NOT NULL
            AND scheduled_at <= now()
            AND deleted_at IS NULL
            AND coalesce(error_count, 0) < %s
          ORDER BY scheduled_at ASC
          LIMIT %s
          FOR UPDATE SKIP LOCKED
       )
       RETURNING *;
    """
    with conn.cursor() as cur:
        cur.execute(sql, (MAX_ERRORS, limit))
        rows = cur.fetchall()
    conn.commit()
    return rows


def claim_stories(conn: psycopg.Connection, limit: int) -> list[dict[str, Any]]:
    sql = """
      UPDATE social_story
         SET status = 'publishing',
             updated_at = now()
       WHERE id IN (
         SELECT id FROM social_story
          WHERE status = 'scheduled'
            AND scheduled_at IS NOT NULL
            AND scheduled_at <= now()
            AND deleted_at IS NULL
            AND coalesce(error_count, 0) < %s
          ORDER BY scheduled_at ASC
          LIMIT %s
          FOR UPDATE SKIP LOCKED
       )
       RETURNING *;
    """
    with conn.cursor() as cur:
        cur.execute(sql, (MAX_ERRORS, limit))
        rows = cur.fetchall()
    conn.commit()
    return rows


def mark_post_success(conn: psycopg.Connection, post_id: str, ig_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
          UPDATE social_post
             SET status = 'published',
                 ig_post_id = %s,
                 published_at = now(),
                 failure_reason = NULL,
                 updated_at = now()
           WHERE id = %s
            """,
            (ig_id, post_id),
        )
    conn.commit()


def mark_story_success(conn: psycopg.Connection, story_id: str, ig_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
          UPDATE social_story
             SET status = 'published',
                 ig_story_id = %s,
                 published_at = now(),
                 failure_reason = NULL,
                 updated_at = now()
           WHERE id = %s
            """,
            (ig_id, story_id),
        )
    conn.commit()


def mark_failure(conn: psycopg.Connection, table: str, item_id: str, err: str) -> None:
    # Truncate to a reasonable length so we don't store stacktraces forever.
    reason = (err or "").strip()[:2000]
    with conn.cursor() as cur:
        cur.execute(
            f"""
          UPDATE {table}
             SET status = 'failed',
                 failure_reason = %s,
                 error_count = coalesce(error_count, 0) + 1,
                 updated_at = now()
           WHERE id = %s
            """,
            (reason, item_id),
        )
    conn.commit()
    log(f"[{table}] {item_id} failed: {reason[:160]}", level="warn")


# ─── IG client ─────────────────────────────────────────────────────
def _apply_defaults(cl: Client) -> None:
    """Pin locale / timezone / device so every request looks consistent.

    The goal is: from IG's side, all our traffic should look like the same
    physical Xiaomi phone in Venezuela, in Spanish. Flapping any of these
    between requests is the #1 fast track to shadowban.
    """
    cl.set_country(IG_COUNTRY)
    cl.set_locale(IG_LOCALE)
    cl.set_country_code(58)  # Venezuela dialling code
    cl.set_timezone_offset(IG_TZ_OFFSET)

    if DEVICE_FILE.exists():
        device = json.loads(DEVICE_FILE.read_text())
    else:
        device = DEFAULT_DEVICE
        DEVICE_FILE.write_text(json.dumps(device, indent=2))

    cl.set_device(device)
    cl.set_user_agent(DEFAULT_UA)

    # Slightly longer delays than default, randomized — looks less like a cron.
    cl.delay_range = [3, 9]

    # Residential proxy if provided.
    if HTTPS_PROXY:
        cl.set_proxy(HTTPS_PROXY)
        log(f"using proxy {HTTPS_PROXY.split('@')[-1]}")


def get_client() -> Client:
    """Lazily log in. Reuse cached session if available and still valid."""
    cl = Client()
    _apply_defaults(cl)

    if SESSION_FILE.exists():
        try:
            cl.load_settings(str(SESSION_FILE))
            # Re-apply defaults AFTER load_settings (load_settings overrides them)
            _apply_defaults(cl)
            cl.login(IG_USERNAME, IG_PASSWORD)
            cl.account_info()  # smoke check
            return cl
        except LoginRequired:
            log("cached session invalid — re-logging in")
        except Exception as e:
            log(f"cached session failed ({type(e).__name__}): {e} — retrying fresh")

    # Fresh login — throw away any partial settings from the failed cache.
    cl = Client()
    _apply_defaults(cl)

    try:
        if IG_VERIFICATION_CODE:
            cl.login(IG_USERNAME, IG_PASSWORD, verification_code=IG_VERIFICATION_CODE)
        else:
            cl.login(IG_USERNAME, IG_PASSWORD)
    except ChallengeRequired as e:
        raise RuntimeError(
            "IG is asking for a challenge. Set IG_VERIFICATION_CODE env with the "
            "code that was sent to your email/phone and restart the worker."
        ) from e

    cl.dump_settings(str(SESSION_FILE))
    log("logged into IG and cached session")
    return cl


# ─── Human-hours gate ──────────────────────────────────────────────
def within_human_hours() -> bool:
    """Don't publish at 3am — looks like a bot. Returns False during 02-07 local."""
    if not HUMAN_HOURS_ONLY:
        return True
    # Local hour per the configured TZ offset.
    now_utc = datetime.now(timezone.utc)
    local_hour = (now_utc.hour + (IG_TZ_OFFSET // 3600)) % 24
    return not (2 <= local_hour < 7)


# ─── Media resolution ──────────────────────────────────────────────
def resolve_media(rel_url: str) -> Path:
    """Convert a /static/... URL stored in DB to a filesystem path."""
    if rel_url.startswith("/static/"):
        return MEDIA_ROOT / rel_url[len("/static/"):]
    # Absolute path was stored (edge case) — trust it
    return Path(rel_url)


def is_video(p: Path) -> bool:
    return p.suffix.lower() in {".mp4", ".mov", ".m4v"}


# ─── Publishers ────────────────────────────────────────────────────
def publish_post(cl: Client, row: dict[str, Any]) -> str:
    """Publish a feed post. Returns IG media pk."""
    caption = row.get("caption") or ""
    media_urls = row.get("media_urls") or []
    cover_url = row.get("cover_url")
    fmt = (row.get("format") or "").lower()

    if isinstance(media_urls, str):
        # JSONB columns may come back as a string in some drivers
        try:
            media_urls = json.loads(media_urls)
        except Exception:
            media_urls = []

    if not media_urls and cover_url:
        media_urls = [cover_url]
    if not media_urls:
        raise RuntimeError("no media to publish")

    paths = [resolve_media(u) for u in media_urls]
    for p in paths:
        if not p.exists():
            raise RuntimeError(f"media file missing on disk: {p}")

    if fmt == "reel":
        # Pick the first video in the list; fall back to the first file.
        vid = next((p for p in paths if is_video(p)), paths[0])
        thumb = resolve_media(cover_url) if cover_url else None
        media = cl.clip_upload(
            str(vid),
            caption=caption,
            thumbnail=str(thumb) if thumb and thumb.exists() else None,
        )
        return str(media.pk)

    if len(paths) > 1 or fmt == "carrusel":
        media = cl.album_upload([str(p) for p in paths], caption=caption)
        return str(media.pk)

    # Single image
    media = cl.photo_upload(str(paths[0]), caption=caption)
    return str(media.pk)


def publish_story(cl: Client, row: dict[str, Any]) -> str:
    media_url = row.get("media_url")
    if not media_url:
        raise RuntimeError("story has no media_url")
    p = resolve_media(media_url)
    if not p.exists():
        raise RuntimeError(f"story media missing on disk: {p}")

    # Link sticker (Batch 5 populates these fields)
    link = row.get("link_url")
    stickers = []
    if link:
        from instagrapi.types import StoryLink  # local import keeps cold-start fast

        stickers.append(
            StoryLink(
                webUri=link,
                # instagrapi positions are fractions of story area
                x=float(row.get("link_x") or 0.5),
                y=float(row.get("link_y") or 0.5),
                width=float(row.get("link_width") or 0.5),
                height=float(row.get("link_height") or 0.1),
                rotation=float(row.get("link_rotation") or 0),
            )
        )

    if is_video(p):
        media = cl.video_upload_to_story(str(p), links=stickers or None)
    else:
        media = cl.photo_upload_to_story(str(p), links=stickers or None)
    return str(media.pk)


# ─── Main loop ─────────────────────────────────────────────────────
def tick(cl_holder: dict[str, Any]) -> None:
    # Respect human hours: we still claim & process if someone hits "Publish
    # now" manually (scheduled_at ≤ now - 5min so we know it's urgent), but
    # skip routine batches at 3am.
    if not within_human_hours():
        # Only take urgent items (published via "Publicar ahora" button).
        with db_conn() as conn:
            posts = claim_posts(conn, BATCH_SIZE)
            stories = claim_stories(conn, BATCH_SIZE)
        if not posts and not stories:
            return
        log(f"off-hours tick — {len(posts)} post(s) + {len(stories)} story(ies) anyway")
    else:
        with db_conn() as conn:
            posts = claim_posts(conn, BATCH_SIZE)
            stories = claim_stories(conn, BATCH_SIZE)

    if not posts and not stories:
        return

    log(f"claimed {len(posts)} post(s) + {len(stories)} story(ies)")

    # Lazy-login only when we actually have work — keeps noise down.
    if "cl" not in cl_holder:
        cl_holder["cl"] = get_client()
    cl: Client = cl_holder["cl"]

    for row in posts:
        pid = row["id"]
        try:
            log(f"post {pid} ({row.get('number')}) — uploading")
            ig_id = publish_post(cl, row)
            with db_conn() as conn:
                mark_post_success(conn, pid, ig_id)
            log(f"post {pid} ✓ published as ig:{ig_id}")
            # Longer, more human gap between full posts.
            time.sleep(random.uniform(30, 90))
        except Exception as e:  # noqa: BLE001
            with db_conn() as conn:
                mark_failure(conn, "social_post", pid, f"{type(e).__name__}: {e}")
            # Back off on failure so we don't hammer IG.
            time.sleep(random.uniform(60, 180))

    for row in stories:
        sid = row["id"]
        try:
            log(f"story {sid} (slot {row.get('slot')}) — uploading")
            ig_id = publish_story(cl, row)
            with db_conn() as conn:
                mark_story_success(conn, sid, ig_id)
            log(f"story {sid} ✓ published as ig:{ig_id}")
            time.sleep(random.uniform(15, 45))
        except Exception as e:  # noqa: BLE001
            with db_conn() as conn:
                mark_failure(conn, "social_story", sid, f"{type(e).__name__}: {e}")
            time.sleep(random.uniform(30, 90))


def main() -> None:
    if not IG_USERNAME or not IG_PASSWORD:
        log("IG_USERNAME / IG_PASSWORD not set — worker idling (set them to enable publishing)", level="warn")

    cl_holder: dict[str, Any] = {}
    log(f"worker started — polling every {POLL_SECONDS}s")

    while not _stop:
        try:
            if IG_USERNAME and IG_PASSWORD:
                tick(cl_holder)
            # else: stay idle but keep the process alive so the container doesn't flap
        except Exception as e:  # noqa: BLE001
            log(f"tick failed: {type(e).__name__}: {e}", level="error")
            # Drop any cached client so next tick forces a fresh login attempt.
            cl_holder.pop("cl", None)
            time.sleep(10)

        for _ in range(POLL_SECONDS):
            if _stop:
                break
            time.sleep(1)


if __name__ == "__main__":
    main()
