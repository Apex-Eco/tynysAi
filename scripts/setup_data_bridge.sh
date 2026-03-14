#!/usr/bin/env bash
set -euo pipefail

cd ~/tynysAi

echo "[1/4] Applying DB bridge trigger (iot_data -> sensor_readings)..."
docker compose -f docker-compose.prod.yml exec -T postgres psql -U admin -d tynysdb <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION bridge_iot_data_to_sensor_readings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  payload jsonb;
  readings jsonb;
  v_sensor_id integer;
  v_user_id integer;
  v_device_id text;
  v_site text;
  v_site_id integer;
  v_ts timestamp;
  v_lat double precision;
  v_lng double precision;
  v_location text;
BEGIN
  payload := COALESCE(NEW.data_payload, '{}'::jsonb);
  readings := COALESCE(payload->'readings', '{}'::jsonb);
  v_user_id := NEW.user_id;

  v_device_id := COALESCE(NULLIF(payload->>'device_id',''), NULLIF(payload->>'sensor_id',''), 'unknown-device');
  v_site := NULLIF(payload->>'site','');

  BEGIN
    v_ts := COALESCE((payload->>'timestamp')::timestamp, NOW());
  EXCEPTION WHEN others THEN
    v_ts := NOW();
  END;

  BEGIN
    v_lat := NULLIF(payload->>'latitude','')::double precision;
  EXCEPTION WHEN others THEN
    v_lat := NULL;
  END;

  BEGIN
    v_lng := NULLIF(payload->>'longitude','')::double precision;
  EXCEPTION WHEN others THEN
    v_lng := NULL;
  END;

  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    v_location := v_lat::text || ',' || v_lng::text;
  ELSE
    v_location := NULLIF(payload->>'location','');
  END IF;

  IF v_site IS NOT NULL THEN
    SELECT site_id INTO v_site_id
    FROM sites
    WHERE site_name = v_site
    ORDER BY site_id
    LIMIT 1;

    IF v_site_id IS NULL THEN
      INSERT INTO sites (site_name, updated_at)
      VALUES (v_site, NOW())
      RETURNING site_id INTO v_site_id;
    END IF;
  END IF;

  INSERT INTO sensors (device_id, site_id, sensor_type, latitude, longitude, is_active, updated_at)
  VALUES (v_device_id, v_site_id, 'air_quality', v_lat, v_lng, true, NOW())
  ON CONFLICT (device_id) DO UPDATE
    SET site_id = COALESCE(EXCLUDED.site_id, sensors.site_id),
        latitude = COALESCE(EXCLUDED.latitude, sensors.latitude),
        longitude = COALESCE(EXCLUDED.longitude, sensors.longitude),
        updated_at = NOW()
  RETURNING sensor_id INTO v_sensor_id;

  INSERT INTO sensor_readings (
    sensor_id, timestamp, server_received_at,
    pm1, pm25, pm10, co2, co, o3, no2, voc, ch2o,
    temperature, humidity, pressure,
    battery_level, signal_strength, error_code,
    location, user_id, ingested_at, data_hash
  )
  VALUES (
    v_sensor_id, v_ts, NOW(),
    COALESCE((readings->>'pm1')::double precision, (payload->>'pm1')::double precision),
    COALESCE((readings->>'pm25')::double precision, (payload->>'pm25')::double precision),
    COALESCE((readings->>'pm10')::double precision, (payload->>'pm10')::double precision),
    COALESCE((readings->>'co2')::double precision, (payload->>'co2')::double precision),
    COALESCE((readings->>'co')::double precision, (payload->>'co')::double precision),
    COALESCE((readings->>'o3')::double precision, (payload->>'o3')::double precision),
    COALESCE((readings->>'no2')::double precision, (payload->>'no2')::double precision),
    COALESCE((readings->>'voc')::double precision, (payload->>'voc')::double precision),
    COALESCE((readings->>'ch2o')::double precision, (payload->>'ch2o')::double precision),
    COALESCE((readings->>'temp')::double precision, (payload->>'temp')::double precision),
    COALESCE((readings->>'hum')::double precision, (payload->>'hum')::double precision),
    COALESCE((readings->>'pressure')::double precision, (payload->>'pressure')::double precision),
    COALESCE((payload->'metadata'->>'battery')::integer, (payload->>'battery')::integer),
    COALESCE((payload->'metadata'->>'signal')::integer, (payload->>'signal')::integer),
    COALESCE(payload->'metadata'->>'error_code', payload->>'error_code'),
    v_location, v_user_id, NOW(),
    encode(digest(v_device_id || '|' || v_ts::text || '|' || COALESCE(payload::text,''), 'sha256'), 'hex')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bridge_iot_data_to_sensor_readings ON iot_data;

CREATE TRIGGER trg_bridge_iot_data_to_sensor_readings
AFTER INSERT ON iot_data
FOR EACH ROW
EXECUTE FUNCTION bridge_iot_data_to_sensor_readings();
SQL

echo "[2/4] Trigger installed."
echo "[3/4] Send one test payload to /data now (from device or curl)."
echo "[4/4] Verify latest rows:"
docker compose -f docker-compose.prod.yml exec -T postgres psql -U admin -d tynysdb <<'SQL'
SELECT reading_id, sensor_id, pm25, location, user_id, ingested_at
FROM sensor_readings
ORDER BY ingested_at DESC
LIMIT 10;
SQL
