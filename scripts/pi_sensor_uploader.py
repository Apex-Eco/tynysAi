#!/usr/bin/env python3
"""Raspberry Pi air-quality uploader with UART + offline buffer.

Supports two modes:
- UART mode (default): reads 26-byte frames from sensor over serial.
- Simulate mode: generates realistic changing values for live testing.
"""

import argparse
import json
import os
import random
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import requests

try:
    import serial  # type: ignore
except Exception:
    serial = None


# Sensor protocol constants
FRAME_LEN = 26
CMD_READ = bytes([0xFF, 0x01, 0x86, 0x00, 0x00, 0x00, 0x00, 0x00, 0x79])

# Calibration (scale, offset)
CAL = {
    "pm1": (1.0, 0.0),
    "pm25": (1.0, 0.0),
    "pm10": (1.0, 0.0),
    "co2": (1.0, -200.0),
    "hum": (1.0, 0.0),
}


def iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def calculate_checksum(data: bytes) -> int:
    return (~sum(data[1:25]) + 1) & 0xFF


def save_to_buffer(buffer_file: str, data: Dict[str, Any]) -> None:
    try:
        with open(buffer_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(data, ensure_ascii=False) + "\n")
        print("Buffered unsent payload")
    except Exception as exc:
        print(f"Buffer write error: {exc}")


def post_json(api_url: str, payload: Dict[str, Any], timeout_sec: float) -> bool:
    try:
        response = requests.post(
            api_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=timeout_sec,
        )
        # Bridge /data returns 200; keep compatibility with 201 if endpoint changes.
        if response.status_code in (200, 201):
            return True

        print(f"Server error status={response.status_code}: {response.text[:200]}")
        return False
    except requests.RequestException as exc:
        print(f"Network error: {exc}")
        return False


def send_buffered_data(api_url: str, buffer_file: str, timeout_sec: float) -> None:
    if not os.path.exists(buffer_file):
        return

    try:
        with open(buffer_file, "r", encoding="utf-8") as f:
            lines = [line for line in f.readlines() if line.strip()]

        if not lines:
            os.remove(buffer_file)
            return

        remaining: list[str] = []
        sent_count = 0

        for line in lines:
            try:
                record = json.loads(line)
            except Exception:
                remaining.append(line)
                continue

            if post_json(api_url, record, timeout_sec):
                sent_count += 1
            else:
                remaining.append(line)

        if remaining:
            with open(buffer_file, "w", encoding="utf-8") as f:
                f.writelines(remaining)
            print(f"Buffered records remaining: {len(remaining)}")
        else:
            os.remove(buffer_file)
            print(f"Buffer drained, sent {sent_count} records")
    except Exception as exc:
        print(f"Buffer processing error: {exc}")


def parse_sensor_data(frame: bytes) -> Optional[Dict[str, Any]]:
    if len(frame) != FRAME_LEN:
        return None
    if calculate_checksum(frame) != frame[25]:
        print("Checksum mismatch")
        return None

    pm1 = frame[2] << 8 | frame[3]
    pm25 = frame[4] << 8 | frame[5]
    pm10 = frame[6] << 8 | frame[7]
    co2 = frame[8] << 8 | frame[9]
    temp_raw = (frame[11] << 8) | frame[12]
    temp = (temp_raw - 435) * 0.1

    hum_raw = (frame[13] << 8) | frame[14]
    hum = (hum_raw - 10) * 1.0

    raw_vals = {"pm1": pm1, "pm25": pm25, "pm10": pm10, "co2": co2, "hum": hum}

    for key, value in raw_vals.items():
        if key in CAL:
            scale, offset = CAL[key]
            if key == "hum":
                hum = value * scale + offset
            elif key == "co2":
                co2 = int(value * scale + offset)
            elif key == "pm1":
                pm1 = int(value * scale + offset)
            elif key == "pm25":
                pm25 = int(value * scale + offset)
            elif key == "pm10":
                pm10 = int(value * scale + offset)

    # Current website contract: send only 5 metrics until ML scoring is added.
    return {
        "pm25": pm25,
        "pm10": pm10,
        "co2": co2,
        "temp": round(temp, 1),
        "hum": round(hum, 1),
    }


def generate_simulated_readings() -> Dict[str, Any]:
    base_pm25 = random.uniform(8.0, 45.0)
    return {
        "pm25": round(base_pm25, 1),
        "pm10": round(base_pm25 * random.uniform(1.2, 1.8), 1),
        "co2": int(random.uniform(420, 900)),
        "temp": round(random.uniform(19.0, 28.0), 1),
        "hum": round(random.uniform(32.0, 65.0), 1),
    }


def build_payload(
    device_id: str,
    site_name: str,
    latitude: Optional[float],
    longitude: Optional[float],
    readings: Dict[str, Any],
) -> Dict[str, Any]:
    payload = {
        "device_id": device_id,
        "site": site_name,
        "timestamp": iso_utc_now(),
        **readings,
    }

    if latitude is not None and longitude is not None:
        payload["latitude"] = latitude
        payload["longitude"] = longitude

    return payload


def send_with_buffer_fallback(
    api_url: str,
    payload: Dict[str, Any],
    buffer_file: str,
    timeout_sec: float,
) -> None:
    if post_json(api_url, payload, timeout_sec):
        print("Sent successfully")
        send_buffered_data(api_url, buffer_file, timeout_sec)
        return

    print("Send failed, buffering payload")
    save_to_buffer(buffer_file, payload)


def run_uart_loop(args: argparse.Namespace) -> int:
    if serial is None:
        print("pyserial is not installed. Install with: pip install pyserial")
        return 2

    print(f"UART mode start: port={args.serial_port}, baud={args.baud_rate}")
    ser = None
    sent = 0

    try:
        ser = serial.Serial(args.serial_port, baudrate=args.baud_rate, timeout=1)
        while True:
            ser.write(CMD_READ)
            frame = ser.read(FRAME_LEN)

            if len(frame) < FRAME_LEN:
                time.sleep(args.interval_sec)
                continue

            parsed = parse_sensor_data(frame)
            if not parsed:
                time.sleep(args.interval_sec)
                continue

            payload = build_payload(
                args.device_id,
                args.site_name,
                args.latitude,
                args.longitude,
                parsed,
            )
            print(json.dumps(payload, ensure_ascii=False))
            send_with_buffer_fallback(args.api_url, payload, args.buffer_file, args.timeout_sec)
            sent += 1

            if args.max_iterations > 0 and sent >= args.max_iterations:
                break

            time.sleep(args.interval_sec)

    except KeyboardInterrupt:
        print("Stopped by user")
    finally:
        if ser is not None and getattr(ser, "is_open", False):
            ser.close()

    return 0


def run_simulation_loop(args: argparse.Namespace) -> int:
    print("Simulation mode start")
    sent = 0

    try:
        while True:
            readings = generate_simulated_readings()
            payload = build_payload(
                args.device_id,
                args.site_name,
                args.latitude,
                args.longitude,
                readings,
            )
            print(json.dumps(payload, ensure_ascii=False))
            send_with_buffer_fallback(args.api_url, payload, args.buffer_file, args.timeout_sec)
            sent += 1

            if args.max_iterations > 0 and sent >= args.max_iterations:
                break

            time.sleep(args.interval_sec)
    except KeyboardInterrupt:
        print("Stopped by user")

    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Pi sensor uploader with buffer + retry")

    parser.add_argument("--api-url", default=os.getenv("API_URL", "http://89.218.178.215:8087/data"))
    parser.add_argument("--buffer-file", default=os.getenv("BUFFER_FILE", "sensor_buffer.jsonl"))
    parser.add_argument("--serial-port", default=os.getenv("SERIAL_PORT", "/dev/ttyS0"))
    parser.add_argument("--baud-rate", type=int, default=int(os.getenv("BAUD_RATE", "9600")))

    parser.add_argument("--device-id", default=os.getenv("DEVICE_ID", "lab01"))
    parser.add_argument("--site-name", default=os.getenv("SITE_NAME", "AGI_Lab"))

    lat_env = os.getenv("LATITUDE")
    lng_env = os.getenv("LONGITUDE")
    parser.add_argument("--latitude", type=float, default=float(lat_env) if lat_env else None)
    parser.add_argument("--longitude", type=float, default=float(lng_env) if lng_env else None)

    parser.add_argument("--interval-sec", type=float, default=float(os.getenv("INTERVAL_SEC", "5")))
    parser.add_argument("--timeout-sec", type=float, default=float(os.getenv("TIMEOUT_SEC", "5")))

    parser.add_argument("--simulate", action="store_true", help="Use generated sensor data instead of UART")
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=0,
        help="0 means run forever; set N for bounded test",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.simulate:
        return run_simulation_loop(args)
    return run_uart_loop(args)


if __name__ == "__main__":
    sys.exit(main())
