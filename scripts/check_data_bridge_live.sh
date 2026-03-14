#!/usr/bin/env bash
set -euo pipefail

cd ~/tynysAi
COMPOSE="docker compose -f docker-compose.prod.yml"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "[1/5] Send test payload to /data"
curl -sS -i -X POST http://89.218.178.215:8087/data \
  -H 'Content-Type: application/json' \
  -d "{
    \"device_id\":\"lab01\",
    \"site\":\"AGI_Lab\",
    \"timestamp\":\"${TS}\",
    \"pm1\":12,
    \"pm25\":22.5,
    \"pm10\":35,
    \"co2\":420,
    \"temp\":22.1,
    \"hum\":46.0,
    \"latitude\":43.2221,
    \"longitude\":76.8512
  }" | sed -n '1,25p'

echo
echo "[2/5] Latest rows in iot_data (should include lab01)"
$COMPOSE exec -T postgres psql -U admin -d tynysdb -c "
SELECT id, data_payload->>'device_id' AS device_id, timestamp
FROM iot_data
ORDER BY id DESC
LIMIT 5;
"

echo
echo "[3/5] Latest rows in sensor_readings (trigger output)"
$COMPOSE exec -T postgres psql -U admin -d tynysdb -c "
SELECT reading_id, sensor_id, pm25, location, user_id, ingested_at
FROM sensor_readings
ORDER BY reading_id DESC
LIMIT 10;
"

echo
echo "[4/5] lab01 sensor row"
$COMPOSE exec -T postgres psql -U admin -d tynysdb -c "
SELECT sensor_id, device_id, latitude, longitude, updated_at
FROM sensors
WHERE device_id='lab01';
"

echo
echo "[5/5] Done."
echo "If iot_data did not change, /data is writing to a different DB/service."
