#!/usr/bin/env python3
"""Generate a back sprite using the front sprite as reference image."""
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


def generate_back(front_path: str, out_path: str, creature_desc: str):
    api_key = os.environ["OPENAI_API_KEY"]

    # Read front sprite as base64
    with open(front_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    prompt = (
        f"Create the BACK VIEW (rear view, facing away from viewer) of this exact pixel art creature. "
        f"The creature is: {creature_desc}. "
        f"CRITICAL: Use the EXACT same colors, body shape, size, and proportions as the reference image. "
        f"Show it from directly behind — same pose but rotated 180 degrees so we see its back. "
        f"Pokemon Crystal GBC sprite style, 56x56 pixel art, 4 colors only, 1px black outline, "
        f"upper-left light, 2-tone shading, NO anti-aliasing, NO dithering, transparent background, no text."
    )

    # Use multipart/form-data for the edits endpoint
    import io
    boundary = "----BackSpriteBoundary"

    body = io.BytesIO()
    def add_field(name, value):
        body.write(f"--{boundary}\r\n".encode())
        body.write(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body.write(f"{value}\r\n".encode())

    def add_file(name, filename, data, content_type="image/png"):
        body.write(f"--{boundary}\r\n".encode())
        body.write(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode())
        body.write(f"Content-Type: {content_type}\r\n\r\n".encode())
        body.write(data)
        body.write(b"\r\n")

    with open(front_path, "rb") as f:
        img_data = f.read()

    add_file("image[]", "front.png", img_data)
    add_field("model", "gpt-image-1")
    add_field("prompt", prompt)
    add_field("n", "1")
    add_field("size", "1024x1024")
    add_field("quality", "medium")
    add_field("background", "transparent")
    add_field("output_format", "png")
    body.write(f"--{boundary}--\r\n".encode())

    payload = body.getvalue()

    req = urllib.request.Request(
        "https://api.openai.com/v1/images/edits",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  API error ({e.code}): {body[:200]}", file=sys.stderr)
        return False

    b64_data = data["data"][0].get("b64_json")
    if not b64_data:
        # Try URL fallback
        url = data["data"][0].get("url")
        if url:
            with urllib.request.urlopen(url, timeout=120) as img_resp:
                img_bytes = img_resp.read()
        else:
            print("  No image data returned", file=sys.stderr)
            return False
    else:
        img_bytes = base64.b64decode(b64_data)

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(img_bytes)
    return True


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: gen-backsprite.py <front.png> <out.png> <description>")
        sys.exit(1)
    ok = generate_back(sys.argv[1], sys.argv[2], sys.argv[3])
    sys.exit(0 if ok else 1)
