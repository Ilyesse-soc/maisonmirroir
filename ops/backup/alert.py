#!/usr/bin/env python3
"""Send a fixed technical backup failure alert using the existing mail provider."""
import json
import pathlib
import sys
import urllib.request

CONFIG = pathlib.Path("/opt/maison-miroir/ops/secrets/app.env")


def main():
    settings = {}
    for line in CONFIG.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, value = line.split("=", 1)
        if key in settings:
            raise ValueError("DUPLICATE_CONFIGURATION_KEY")
        settings[key] = value.strip().strip("\"").strip("'")
    key = settings.get("RESEND_API_KEY")
    sender = settings.get("EMAIL_FROM")
    recipient = settings.get("ADMIN_EMAIL") or settings.get("EMAIL_ADMIN")
    if not key or not sender or not recipient:
        raise ValueError("BACKUP_ALERT_NOT_CONFIGURED")
    payload = json.dumps({
        "from": sender,
        "to": [recipient],
        "subject": "MAISON MIROIR - echec de sauvegarde",
        "html": "<p>La sauvegarde automatique a echoue. Verifiez le journal du service de sauvegarde.</p>",
    }).encode("utf-8")
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status not in (200, 201):
            raise RuntimeError("BACKUP_ALERT_REJECTED")
    print("BACKUP_ALERT_ACCEPTED")


if __name__ == "__main__":
    try:
        main()
    except (OSError, UnicodeError, ValueError, RuntimeError):
        print("BACKUP_ALERT_FAILED", file=sys.stderr)
        sys.exit(1)
