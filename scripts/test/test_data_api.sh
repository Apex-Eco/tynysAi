#!/usr/bin/env bash
set -euo pipefail

DATA_API_URL="${DATA_API_URL:-http://89.218.178.215:8087/data}"
DEVICE_ID="${DEVICE_ID:-lab01}"
SITE_NAME="${SITE_NAME:-AGI_Lab}"
LAT="${LAT:-43.238949}"
LNG="${LNG:-76.889709}"

# Optional: if provided, also forward test payload to Tynys API for direct ingest validation.
TYNYS_API_URL="${TYNYS_API_URL:-}"
IOT_DEVICE_SECRET="${IOT_DEVICE_SECRET:-}"

echo "[1/3] Testing legacy data API: ${DATA_API_URL}"
LEGACY_PAYLOAD=$(cat <<JSON
{
  "device_id": "${DEVICE_ID}",
  "site": "${SITE_NAME}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "pm1": 12,
  "pm25": 25,
  "pm10": 40,
  "co2": 430,
  "voc": 0.7,
  "temp": 22.0,
  "hum": 45.0,
  "ch2o": 0.03,
  "co": 0.2,
  "o3": 18,
  "no2": 14,
  "latitude": ${LAT},
  "longitude": ${LNG}
}
JSON
)

curl -sS -i -m 10 -X POST "${DATA_API_URL}" \
  -H 'Content-Type: application/json' \
  -d "${LEGACY_PAYLOAD}" | sed -n '1,20p'

echo ""
echo "[2/3] If the API accepted payload, verify the DB row has coordinates + timestamp + device_id."

echo ""
echo "[3/3] Optional direct Tynys ingest test"
if [[ -n "${TYNYS_API_URL}" && -n "${IOT_DEVICE_SECRET}" ]]; then
  TYNYS_PAYLOAD=$(cat <<JSON
{
  "device_id": "${DEVICE_ID}",
  "site": "${SITE_NAME}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "readings": {
    "pm1": 12,
    "pm25": 25,
    "pm10": 40,
    "co2": 430,
    "voc": 0.7,
    "temp": 22.0,
    "hum": 45.0,
    "ch2o": 0.03,
    "co": 0.2,
    "o3": 18,
    "no2": 14
  },
  "metadata": {
    "battery": 88,
    "signal": -63,
    "firmware": "2.1.4"
  }
}
JSON
)

  curl -sS -i -m 10 -X POST "${TYNYS_API_URL%/}/api/v1/sensor-data" \
    -H "Authorization: Bearer ${IOT_DEVICE_SECRET}" \
    -H 'Content-Type: application/json' \
    -d "${TYNYS_PAYLOAD}" | sed -n '1,30p'
else
  echo "Skipped. Set TYNYS_API_URL and IOT_DEVICE_SECRET to test direct Tynys ingestion."
fi

echo ""
echo "Done."
