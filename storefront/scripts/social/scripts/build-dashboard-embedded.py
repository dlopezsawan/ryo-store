#!/usr/bin/env python3
"""
Generate a self-contained version of dashboard.html with all media embedded.

Optimizations:
- Stories (70 files at 2160×3840) → resized to 720×1280 WebP q75 (~10× smaller)
- Post slides (2160×2700) → resized to 1080×1350 WebP q85
- Reel covers → WebP q85
- Reels MP4 → unchanged (already compressed)

Output: social/enrola-dashboard-embedded.html
Target size: ~40-60 MB (down from 330 MB unoptimized)

Usage:
    cd storefront/scripts/social
    python3 scripts/build-dashboard-embedded.py
"""

import base64
import json
import mimetypes
import pathlib
import re
import subprocess
import tempfile

HERE = pathlib.Path(__file__).parent.parent  # social/
SRC = HERE / "dashboard.html"
OUT = HERE / "enrola-dashboard-embedded.html"
TMP = pathlib.Path(tempfile.mkdtemp(prefix="enrola-embed-"))


def resize_to_jpg(src_path: pathlib.Path, target_w: int, quality: int = 82) -> pathlib.Path:
    """Resize an image to target width keeping aspect ratio, output as JPG.

    Cache key must include the full relative path — many files share names
    (cover.png, post.png, 01-portada.png) across different posts.
    """
    try:
        rel = src_path.relative_to(HERE)
    except ValueError:
        rel = src_path
    cache_key = str(rel).replace("/", "__").replace(".", "_")
    out = TMP / f"{cache_key}-{target_w}.jpg"
    if out.exists():
        return out
    # sips accepts -Z (max dimension) and quality 1-100 via formatOptions
    subprocess.run(
        ["sips", "-Z", str(target_w),
         "-s", "format", "jpeg",
         "-s", "formatOptions", str(quality),
         str(src_path), "--out", str(out)],
        check=True, capture_output=True,
    )
    return out


def file_to_data_uri(rel_path: str, compress=None) -> str:
    """
    Encode a file (relative to social/) as base64 data URI.
    compress: 'story' | 'slide' | 'cover' | None
    """
    p = HERE / rel_path
    if not p.exists():
        print(f"  ⚠ missing: {rel_path}")
        return ""

    # Apply compression for images
    if compress and p.suffix.lower() in (".png", ".jpg", ".jpeg"):
        if compress == "story":
            p = resize_to_jpg(p, 720, 75)
        elif compress == "slide":
            p = resize_to_jpg(p, 1080, 82)
        elif compress == "cover":
            p = resize_to_jpg(p, 720, 80)

    mime, _ = mimetypes.guess_type(str(p))
    if not mime:
        if p.suffix == ".webp":
            mime = "image/webp"
        else:
            mime = "application/octet-stream"

    data = p.read_bytes()
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def fix_poll_to_combo(stories):
    """Story 2026-05-14 slot 3 was converted from poll → combo; update id + path."""
    for s in stories:
        if s.get("id") == "story-2026-05-14-3-poll":
            s["id"] = "story-2026-05-14-3-combo"
            s["type"] = "combo"
            s["preview"] = "stories/daily/2026-05-14/03-combo.png"
    return stories


def main():
    html = SRC.read_text()
    m = re.search(
        r"const _EMBEDDED_DATA\s*=\s*(\{.*?\});",
        html, re.DOTALL,
    )
    if not m:
        print("❌ Could not find _EMBEDDED_DATA block in dashboard.html")
        return
    json_str = m.group(1)
    data = json.loads(json_str)

    posts = data.get("posts", [])
    stories = fix_poll_to_combo(data.get("stories", []))
    print(f"→ {len(posts)} posts · {len(stories)} stories")

    total = 0
    print("→ Encoding posts...")
    for post in posts:
        new_previews = []
        for pth in post.get("previews", []):
            # Videos pass through; images get 'slide' compression
            is_video = pth.lower().endswith(".mp4")
            enc = file_to_data_uri(pth, compress=None if is_video else "slide")
            if enc: new_previews.append(enc); total += 1
        post["previews"] = new_previews
        if post.get("cover"):
            enc = file_to_data_uri(post["cover"], compress="cover")
            if enc: post["cover"] = enc; total += 1

    print("→ Encoding stories (compressed to 720px WebP)...")
    for i, story in enumerate(stories):
        if not story.get("preview"): continue
        enc = file_to_data_uri(story["preview"], compress="story")
        if enc: story["preview"] = enc; total += 1
        if (i + 1) % 20 == 0: print(f"  ... {i+1}/{len(stories)}")

    data["stories"] = stories
    new_json = json.dumps(data, ensure_ascii=False)
    new_html = html.replace(json_str, new_json, 1)
    new_html = new_html.replace(
        "<title>Enrola · Planificación Mes 2</title>",
        "<title>Enrola · Dashboard Offline (Mes 2)</title>",
    )

    OUT.write_text(new_html)
    size_mb = OUT.stat().st_size / 1024 / 1024
    print()
    print(f"✓ Written: {OUT.name}")
    print(f"  {total} files embedded")
    print(f"  Size: {size_mb:.1f} MB")
    print()
    print("  Share via:")
    print("  - Google Drive (easiest — get shareable link)")
    print("  - WhatsApp (if <100MB)")
    print("  - WeTransfer")


if __name__ == "__main__":
    main()
