# Server Changes Needed for `http://89.218.178.215:8087/data`

This document explains what to change on the `/data` server so data becomes visible on the Tynys dashboard map.

## Why data may not appear now

The website map only renders points when it has valid coordinates per reading or sensor.

- Coordinates must exist (`latitude`,`longitude`) or a `location` string in `"lat,lng"` format.
- Device data must be queryable by the dashboard data path.

## Required fields from `/data`

The `/data` endpoint should store at least:

- `device_id` (string)
- `timestamp` (ISO 8601)
- reading values (`pm25`, `pm10`, `pm1`, `co2`, etc.)
- coordinates (`latitude`, `longitude`) or `location` as `"lat,lng"`

## Recommended ingestion strategy

Use one of these options.

### Option A (recommended): Forward `/data` payload to Tynys JSON API

Forward each accepted `/data` payload to:

- `POST /api/v1/sensor-data`
- Header: `Authorization: Bearer <IOT_DEVICE_SECRET>`
- Body shape:

```json
{
  "device_id": "lab01",
  "site": "AGI_Lab",
  "timestamp": "2026-03-14T19:20:00Z",
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
```

Also upsert sensor coordinates in Tynys `sensors` table when you know a device's location.

### Option B: Write directly into Tynys database tables

If your `/data` service writes directly to PostgreSQL:

1. Upsert `sensors` by `device_id`.
2. Save `latitude` and `longitude` in `sensors`.
3. Insert readings into `sensor_readings`.
4. Ensure `timestamp` and `ingested_at` are set.

## Quick verification checklist

1. POST sample payload to `/data` returns `200 OK`.
2. Latest row exists for device in DB.
3. Device has coordinates (`sensors.latitude`,`sensors.longitude`) or reading has `location` as `"lat,lng"`.
4. Open dashboard map while logged in and refresh.

## Local test script

Use:

```bash
bash scripts/test/test_data_api.sh
```

Optional direct Tynys test:

```bash
TYNYS_API_URL=http://localhost:3000 \
IOT_DEVICE_SECRET=<secret> \
bash scripts/test/test_data_api.sh
```
