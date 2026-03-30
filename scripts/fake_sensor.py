#!/usr/bin/env python3
"""Send fake sensor payloads every 5 seconds for local UI testing."""

from __future__ import annotations

import json
import random
import time
from datetime import datetime, timezone
from urllib import error, request

ENDPOINT = "http://89.218.178.215:8087/data"
DEVICE_ID = "test-local"
SITE = "DevMachine"
INTERVAL_SECONDS = 5


def random_reading() -> dict[str, float | str]:
    """Generate realistic-ish sensor data values."""
    return {
        "device_id": DEVICE_ID,
        "site": SITE,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pm1": round(random.uniform(4.0, 22.0), 1),
        "pm25": round(random.uniform(8.0, 48.0), 1),
        "pm10": round(random.uniform(14.0, 70.0), 1),
        "co2": round(random.uniform(420.0, 1150.0), 0),
        "voc": round(random.uniform(0.08, 1.20), 3),
        "temp": round(random.uniform(18.0, 30.0), 1),
        "hum": round(random.uniform(28.0, 72.0), 1),
        "ch2o": round(random.uniform(0.01, 0.08), 3),
        "co": round(random.uniform(0.03, 1.6), 3),
        "o3": round(random.uniform(8.0, 60.0), 1),
        "no2": round(random.uniform(6.0, 45.0), 1),
    }


def post_payload(payload: dict[str, float | str]) -> None:
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(
        ENDPOINT,
        data=data,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            print(f"[OK {resp.status}] sent: {json.dumps(payload)}")
            if body:
                print(f"         response: {body}")
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(f"[HTTP {exc.code}] sent: {json.dumps(payload)}")
        if body:
            print(f"          response: {body}")
    except Exception as exc:  # pylint: disable=broad-except
        print(f"[ERROR] failed to send payload: {exc}")
        print(f"        payload: {json.dumps(payload)}")


def main() -> None:
    print(f"Sending fake sensor data to {ENDPOINT} every {INTERVAL_SECONDS}s")
    print("Press Ctrl+C to stop.")

    while True:
        payload = random_reading()
        post_payload(payload)
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
