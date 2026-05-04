"""
Standalone IG login tester/bootstrapper.

Usage (inside the worker container):
    python login.py              # attempt login, print challenge if needed
    python login.py --code 123456  # retry with 2FA / email verification code
    python login.py --challenge email   # explicitly choose challenge channel
    python login.py --logout     # wipe cached session (force fresh login)

Designed to run *before* letting the worker publish anything, so you can
complete any verification flow IG throws at you without risking a real post.
"""
import argparse
import json
import os
import sys
from pathlib import Path

from instagrapi import Client
from instagrapi.exceptions import (
    ChallengeRequired,
    SelectContactPointRecoveryForm,
    RecaptchaChallengeForm,
    BadPassword,
    LoginRequired,
)

IG_USERNAME = os.environ.get("IG_USERNAME", "").strip()
IG_PASSWORD = os.environ.get("IG_PASSWORD", "").strip()
IG_COUNTRY = os.environ.get("IG_COUNTRY", "VE").strip()
IG_LOCALE = os.environ.get("IG_LOCALE", "es_VE").strip()
IG_TZ_OFFSET = int(os.environ.get("IG_TZ_OFFSET", "-14400"))
HTTPS_PROXY = os.environ.get("HTTPS_PROXY", "").strip() or None
SESSION_DIR = Path(os.environ.get("SESSION_DIR", "/worker/sessions"))
SESSION_DIR.mkdir(parents=True, exist_ok=True)

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

SESSION_FILE = SESSION_DIR / f"{IG_USERNAME or 'noauth'}.json"
DEVICE_FILE = SESSION_DIR / f"{IG_USERNAME or 'noauth'}.device.json"


def apply_defaults(cl: Client) -> None:
    cl.set_country(IG_COUNTRY)
    cl.set_locale(IG_LOCALE)
    cl.set_country_code(58)
    cl.set_timezone_offset(IG_TZ_OFFSET)
    if DEVICE_FILE.exists():
        device = json.loads(DEVICE_FILE.read_text())
    else:
        device = DEFAULT_DEVICE
        DEVICE_FILE.write_text(json.dumps(device, indent=2))
    cl.set_device(device)
    cl.set_user_agent(DEFAULT_UA)
    cl.delay_range = [3, 9]
    if HTTPS_PROXY:
        cl.set_proxy(HTTPS_PROXY)


def try_login(code: str | None, challenge_channel: str | None) -> int:
    if not IG_USERNAME or not IG_PASSWORD:
        print("FATAL: IG_USERNAME or IG_PASSWORD not set in env", file=sys.stderr)
        return 2

    cl = Client()
    apply_defaults(cl)

    # Hook for challenge resolution when instagrapi needs our input.
    if challenge_channel in {"email", "sms"}:
        cl.challenge_code_handler = lambda username, choice: code or input(
            f"IG challenge via {choice}. Paste code for {username}: "
        )

    print(f"→ logging in as {IG_USERNAME!r}  (country={IG_COUNTRY}, locale={IG_LOCALE})")
    try:
        if code:
            cl.login(IG_USERNAME, IG_PASSWORD, verification_code=code)
        else:
            cl.login(IG_USERNAME, IG_PASSWORD)
    except BadPassword:
        print("✗ BadPassword — double-check IG_PASSWORD", file=sys.stderr)
        return 1
    except ChallengeRequired as e:
        print(f"⚠ ChallengeRequired — {e}")
        print("  Re-run with:  python login.py --code <6-digit-code>")
        print("  (after reading the code IG sent to the account's email/phone)")
        return 3
    except SelectContactPointRecoveryForm as e:
        print(f"⚠ IG wants you to pick email vs SMS for the code — {e}")
        return 3
    except RecaptchaChallengeForm as e:
        print(f"✗ IG wants a reCAPTCHA — cannot solve from server: {e}", file=sys.stderr)
        return 4
    except Exception as e:
        print(f"✗ OTHER · {type(e).__name__}: {e}", file=sys.stderr)
        # Dump more context for JSONDecodeError etc. — usually means IP flagged.
        return 5

    # Probe a cheap endpoint to validate the session actually works.
    try:
        info = cl.account_info()
        print(
            f"✓ LOGIN OK · pk={info.pk} · name={info.full_name!r} · "
            f"business={info.is_business} · followers={getattr(info, 'follower_count', '?')}"
        )
    except Exception as e:  # noqa: BLE001
        print(f"⚠ logged in but account_info failed: {e}", file=sys.stderr)

    cl.dump_settings(str(SESSION_FILE))
    print(f"✓ session cached at {SESSION_FILE}")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--code", help="verification code sent by IG")
    ap.add_argument(
        "--challenge", choices=["email", "sms"], help="challenge channel to accept code from"
    )
    ap.add_argument("--logout", action="store_true", help="wipe cached session")
    args = ap.parse_args()

    if args.logout:
        if SESSION_FILE.exists():
            SESSION_FILE.unlink()
            print(f"✓ wiped {SESSION_FILE}")
        else:
            print("no cached session")
        return

    code = (args.code or os.environ.get("IG_VERIFICATION_CODE", "")).strip() or None
    sys.exit(try_login(code, args.challenge))


if __name__ == "__main__":
    main()
