import { NextRequest, NextResponse } from 'next/server';
import { 
  validateSensorReading, 
  generateDataHash,
  type SensorReadingPayload 
} from '@/lib/sensor-validation';
import { 
  insertSensorReading,
  findOrCreateSensor,
  findOrCreateSite,
  checkDuplicateReading
} from '@/lib/sensor-data-access';
import { db } from '@/lib/db';
import { sensorReadings, sensors } from '@/lib/db/schema';
import { desc, eq, isNull } from 'drizzle-orm';
import { isValidAlmatyCoordinate } from '@/lib/geo';

export const dynamic = 'force-dynamic';

type DeviceStatus = 'online' | 'idle' | 'offline';
type CentralReading = {
  device_id?: unknown;
  site?: unknown;
  pm1?: unknown;
  pm25?: unknown;
  pm10?: unknown;
  co2?: unknown;
  voc?: unknown;
  temp?: unknown;
  hum?: unknown;
  ch2o?: unknown;
  co?: unknown;
  o3?: unknown;
  no2?: unknown;
  timestamp?: unknown;
};

type CentralDevice = CentralReading & {
  latitude?: unknown;
  longitude?: unknown;
};

type ApiReading = {
  sensorId: string;
  location: string;
  value: number;
  timestamp: string;
  transportType: null;
  ingestedAt: string;
  mainReadings: {
    pm1?: number;
    pm25?: number;
    pm10?: number;
    co2?: number;
    voc?: number;
    temperatureC?: number;
    humidityPct?: number;
    ch2o?: number;
    co?: number;
    o3?: number;
    no2?: number;
  };
};

type ApiDevice = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: DeviceStatus;
  lastSeenAt: string;
};

const CENTRAL_DATA_BASE_URL = (process.env.CENTRAL_DATA_BASE_URL ?? 'http://data-tynys-aqserver-1:8082').replace(/\/$/, '');
const DEVICE_COORDINATE_FALLBACKS: Record<string, { latitude: number; longitude: number }> = {
  lab01: { latitude: 43.2221, longitude: 76.8512 },
};
const ENABLE_SENSOR_MOCK_FALLBACK = process.env.ENABLE_SENSOR_MOCK_FALLBACK === 'true';
const DEFAULT_ACTIVE_SENSOR_WINDOW_MINUTES = Number(process.env.ACTIVE_SENSOR_WINDOW_MINUTES ?? '1');
const LOCAL_MOCK_DEVICES = [
  { id: 'dev-bus-01', latitude: 43.2383, longitude: 76.8897, site: 'Almaty Center Bus Hub' },
  { id: 'dev-bus-02', latitude: 43.2148, longitude: 76.8532, site: 'Abay Station Corridor' },
  { id: 'dev-bus-03', latitude: 43.1965, longitude: 76.9278, site: 'Airport Route Segment' },
] as const;
const NETWORK_ERROR_CODES = new Set(['EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH']);

function toIsoTimestamp(value: unknown): string {
  const fallback = new Date().toISOString();
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function toCoordinate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeDeviceId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (normalized === '') return null;
  return normalized;
}

function readErrorCode(errorLike: unknown): string | null {
  if (typeof errorLike !== 'object' || errorLike === null) {
    return null;
  }
  const code = (errorLike as { code?: unknown }).code;
  if (typeof code !== 'string' || code.trim() === '') {
    return null;
  }
  return code.trim().toUpperCase();
}

function isCentralNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const directCode = readErrorCode(error);
  const causeCode = readErrorCode((error as Error & { cause?: unknown }).cause);
  const code = directCode ?? causeCode;
  if (code && NETWORK_ERROR_CODES.has(code)) {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('fetch failed')
    || message.includes('network')
    || message.includes('getaddrinfo')
    || message.includes('eai_again')
    || message.includes('enotfound')
  );
}

function randomNumber(min: number, max: number, precision = 1): number {
  const value = min + Math.random() * (max - min);
  return Number(value.toFixed(precision));
}

function buildMockSnapshot(deviceId: string | null): { devices: ApiDevice[]; readings: ApiReading[] } {
  const now = new Date();
  const nowIso = now.toISOString();

  const baseDevices: Array<{ id: string; latitude: number; longitude: number; site: string }> = LOCAL_MOCK_DEVICES.map((item) => ({
    id: item.id,
    latitude: item.latitude,
    longitude: item.longitude,
    site: item.site,
  }));
  let selectedDevices = baseDevices.filter((item) => !deviceId || item.id === deviceId);
  if (selectedDevices.length === 0 && deviceId) {
    selectedDevices = [{
      id: deviceId,
      latitude: 43.2221,
      longitude: 76.8512,
      site: 'Almaty Local Dev Device',
    }];
  }

  const devices: ApiDevice[] = selectedDevices.map((item) => ({
    id: item.id,
    name: item.site,
    latitude: item.latitude,
    longitude: item.longitude,
    status: 'online',
    lastSeenAt: nowIso,
  }));

  const readings: ApiReading[] = selectedDevices.map((item) => {
    const pm1 = randomNumber(6, 20);
    const pm25 = randomNumber(10, 45);
    const pm10 = randomNumber(16, 65);
    const co2 = randomNumber(430, 1050, 0);
    const voc = randomNumber(0.08, 1.05, 3);
    const temperatureC = randomNumber(18, 30);
    const humidityPct = randomNumber(30, 68);
    const ch2o = randomNumber(0.01, 0.07, 3);
    const co = randomNumber(0.03, 1.4, 3);
    const o3 = randomNumber(8, 58);
    const no2 = randomNumber(5, 40);

    return {
      sensorId: item.id,
      location: `${item.latitude},${item.longitude}`,
      value: pm25,
      timestamp: nowIso,
      transportType: null,
      ingestedAt: nowIso,
      mainReadings: {
        pm1,
        pm25,
        pm10,
        co2,
        voc,
        temperatureC,
        humidityPct,
        ch2o,
        co,
        o3,
        no2,
      },
    };
  });

  return { devices, readings };
}

function parseLocationCoordinates(location: unknown): { latitude: number; longitude: number } | null {
  if (typeof location !== 'string') return null;
  const [latRaw, lngRaw] = location.split(',').map((part) => part.trim());
  if (!latRaw || !lngRaw) return null;
  const latitude = toCoordinate(latRaw);
  const longitude = toCoordinate(lngRaw);
  if (latitude === null || longitude === null) return null;
  if (!isValidAlmatyCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
}

type FallbackDbReading = {
  deviceId: string | null;
  timestamp: Date | string;
  pm1: number | null;
  pm25: number | null;
  pm10: number | null;
  co2: number | null;
  voc: number | null;
  ch2o: number | null;
  co: number | null;
  o3: number | null;
  no2: number | null;
  temperature: number | null;
  humidity: number | null;
  value: number | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
};

async function getFallbackDbReadings(limit: number, publicOnly: boolean): Promise<FallbackDbReading[]> {
  const query = db
    .select({
      deviceId: sensors.deviceId,
      timestamp: sensorReadings.timestamp,
      pm1: sensorReadings.pm1,
      pm25: sensorReadings.pm25,
      pm10: sensorReadings.pm10,
      co2: sensorReadings.co2,
      voc: sensorReadings.voc,
      ch2o: sensorReadings.ch2o,
      co: sensorReadings.co,
      o3: sensorReadings.o3,
      no2: sensorReadings.no2,
      temperature: sensorReadings.temperature,
      humidity: sensorReadings.humidity,
      value: sensorReadings.value,
      location: sensorReadings.location,
      latitude: sensors.latitude,
      longitude: sensors.longitude,
    })
    .from(sensorReadings)
    .leftJoin(sensors, eq(sensorReadings.sensorId, sensors.id))
    .orderBy(desc(sensorReadings.timestamp))
    .limit(limit);

  if (publicOnly) {
    return query.where(isNull(sensorReadings.userId));
  }

  return query;
}

function buildDbSnapshot(
  dbReadings: FallbackDbReading[],
  deviceId: string | null,
): { devices: ApiDevice[]; readings: ApiReading[] } {
  const requestedDeviceId = normalizeDeviceId(deviceId);
  const normalizedReadings: ApiReading[] = [];

  for (const row of dbReadings) {
    const sensorId = normalizeDeviceId(row.deviceId);
    if (!sensorId) continue;
    if (requestedDeviceId && sensorId !== requestedDeviceId) continue;

    const coordsFromSensor =
      typeof row.latitude === 'number'
      && Number.isFinite(row.latitude)
      && typeof row.longitude === 'number'
      && Number.isFinite(row.longitude)
      && isValidAlmatyCoordinate(row.latitude, row.longitude)
        ? { latitude: row.latitude, longitude: row.longitude }
        : null;

    const coords = coordsFromSensor ?? parseLocationCoordinates(row.location);
    if (!coords) continue;

    const timestamp = toIsoTimestamp(row.timestamp);
    const value =
      typeof row.value === 'number' && Number.isFinite(row.value)
        ? row.value
        : typeof row.pm25 === 'number' && Number.isFinite(row.pm25)
          ? row.pm25
          : typeof row.pm10 === 'number' && Number.isFinite(row.pm10)
            ? row.pm10
            : typeof row.co2 === 'number' && Number.isFinite(row.co2)
              ? row.co2
              : 0;

    normalizedReadings.push({
      sensorId,
      location: `${coords.latitude},${coords.longitude}`,
      value,
      timestamp,
      transportType: null,
      ingestedAt: timestamp,
      mainReadings: {
        pm1: row.pm1 ?? undefined,
        pm25: row.pm25 ?? undefined,
        pm10: row.pm10 ?? undefined,
        co2: row.co2 ?? undefined,
        voc: row.voc ?? undefined,
        temperatureC: row.temperature ?? undefined,
        humidityPct: row.humidity ?? undefined,
        ch2o: row.ch2o ?? undefined,
        co: row.co ?? undefined,
        o3: row.o3 ?? undefined,
        no2: row.no2 ?? undefined,
      },
    });
  }

  const dedupReadings = new Map<string, ApiReading>();
  for (const reading of normalizedReadings) {
    const key = `${reading.sensorId}|${reading.timestamp}|${reading.location}`;
    if (!dedupReadings.has(key)) {
      dedupReadings.set(key, reading);
    }
  }

  const readings = Array.from(dedupReadings.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const devicesById = new Map<string, { latitude: number; longitude: number; lastSeenAt: string }>();
  for (const reading of readings) {
    const coords = parseLocationCoordinates(reading.location);
    if (!coords) continue;
    const existing = devicesById.get(reading.sensorId);
    if (!existing || reading.timestamp > existing.lastSeenAt) {
      devicesById.set(reading.sensorId, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        lastSeenAt: reading.timestamp,
      });
    }
  }

  const devices: ApiDevice[] = Array.from(devicesById.entries()).map(([id, device]) => ({
    id,
    name: id,
    latitude: device.latitude,
    longitude: device.longitude,
    status: deriveStatus(new Date(device.lastSeenAt)),
    lastSeenAt: new Date(device.lastSeenAt).toISOString(),
  }));

  return { devices, readings };
}

function filterSnapshotByFreshness(
  snapshot: { devices: ApiDevice[]; readings: ApiReading[] },
  freshnessMinutes: number,
): { devices: ApiDevice[]; readings: ApiReading[] } {
  const safeWindowMinutes = Number.isFinite(freshnessMinutes) && freshnessMinutes > 0
    ? Math.floor(freshnessMinutes)
    : 30;
  const cutoffMs = Date.now() - safeWindowMinutes * 60 * 1000;

  const freshReadings = snapshot.readings.filter((reading) => {
    const ts = new Date(reading.timestamp).getTime();
    return Number.isFinite(ts) && ts >= cutoffMs;
  });

  const freshDeviceIds = new Set(freshReadings.map((reading) => reading.sensorId));

  const freshDevices = snapshot.devices.filter((device) => {
    const lastSeenMs = new Date(device.lastSeenAt).getTime();
    if (Number.isFinite(lastSeenMs) && lastSeenMs >= cutoffMs) return true;
    return freshDeviceIds.has(device.id);
  });

  return {
    devices: freshDevices,
    readings: freshReadings,
  };
}

function mapReadingMetrics(reading: Record<string, unknown>) {
  const normalized = normalizeReadingFields(reading);
  return {
    pm1: normalized.pm1 ?? undefined,
    pm25: normalized.pm25 ?? undefined,
    pm10: normalized.pm10 ?? undefined,
    co2: normalized.co2 ?? undefined,
    voc: normalized.voc ?? undefined,
    temperatureC: normalized.temp ?? undefined,
    humidityPct: normalized.hum ?? undefined,
    ch2o: normalized.ch2o ?? undefined,
    co: normalized.co ?? undefined,
    o3: normalized.o3 ?? undefined,
    no2: normalized.no2 ?? undefined,
  };
}

async function fetchCentralJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Central server request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as T;
}

function buildDeviceIndex(devices: CentralDevice[]): Map<string, { latitude: number; longitude: number; timestamp: string }> {
  const index = new Map<string, { latitude: number; longitude: number; timestamp: string }>();

  for (const device of devices) {
    const deviceId = normalizeDeviceId(device.device_id);
    const fallbackCoords = deviceId ? DEVICE_COORDINATE_FALLBACKS[deviceId] : undefined;
    const latitude = toCoordinate(device.latitude) ?? fallbackCoords?.latitude ?? null;
    const longitude = toCoordinate(device.longitude) ?? fallbackCoords?.longitude ?? null;
    if (!deviceId || latitude === null || longitude === null) continue;

    index.set(deviceId, {
      latitude,
      longitude,
      timestamp: toIsoTimestamp(device.timestamp),
    });
  }

  return index;
}

function normalizeApiReadings(
  readings: CentralReading[],
  devicesById: Map<string, { latitude: number; longitude: number }>,
): ApiReading[] {
  const out: ApiReading[] = [];

  for (const reading of readings) {
    const sensorId = normalizeDeviceId(reading.device_id);
    if (!sensorId) continue;

    const coords = devicesById.get(sensorId);
    if (!coords) continue;

    const raw = reading as Record<string, unknown>;
    const metrics = mapReadingMetrics(raw);
    const value =
      metrics.pm25
      ?? metrics.pm10
      ?? metrics.pm1
      ?? metrics.co2
      ?? 0;

    const ts = toIsoTimestamp(reading.timestamp);

    out.push({
      sensorId,
      location: `${coords.latitude},${coords.longitude}`,
      value,
      timestamp: ts,
      transportType: null,
      ingestedAt: ts,
      mainReadings: metrics,
    });
  }

  return out;
}

function normalizeApiDevices(
  devicesById: Map<string, { latitude: number; longitude: number; timestamp: string }>,
): ApiDevice[] {
  return Array.from(devicesById.entries()).map(([deviceId, device]) => {
    const lastSeenDate = new Date(device.timestamp);
    return {
      id: deviceId,
      name: deviceId,
      latitude: device.latitude,
      longitude: device.longitude,
      status: deriveStatus(lastSeenDate),
      lastSeenAt: lastSeenDate.toISOString(),
    };
  });
}

function pickFirstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === 'string' && raw.trim() !== '') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function normalizeReadingFields(reading: Record<string, unknown>) {
  const pm1 = pickFirstNumber(reading, ['pm1', 'pm1_0', 'PM1']);
  const pm25 = pickFirstNumber(reading, ['pm25', 'pm2_5', 'PM2.5', 'PM25', 'pm_2_5']);
  const pm10 = pickFirstNumber(reading, ['pm10', 'pm_10', 'PM10']);
  const co2 = pickFirstNumber(reading, ['co2', 'CO2', 'co_2']);
  const voc = pickFirstNumber(reading, ['voc', 'tvoc', 'VOC', 'TVOC']);
  const temp = pickFirstNumber(reading, ['temperature', 'temp', 'temperatureC', 'TEMP']);
  const hum = pickFirstNumber(reading, ['humidity', 'hum', 'humidityPct', 'HUM']);
  const ch2o = pickFirstNumber(reading, ['ch2o', 'CH2O']);
  const co = pickFirstNumber(reading, ['co', 'CO']);
  const o3 = pickFirstNumber(reading, ['o3', 'O3']);
  const no2 = pickFirstNumber(reading, ['no2', 'NO2']);

  return {
    pm1,
    pm25,
    pm10,
    co2,
    voc,
    temp,
    hum,
    ch2o,
    co,
    o3,
    no2,
  };
}

function normalizeIncomingPayload(rawPayload: Record<string, unknown>): SensorReadingPayload {
  const rawReadings =
    typeof rawPayload.readings === 'object' && rawPayload.readings !== null
      ? (rawPayload.readings as Record<string, unknown>)
      : rawPayload;

  const normalizedReadings = normalizeReadingFields(rawReadings);

  return {
    device_id: normalizeDeviceId(rawPayload.device_id ?? rawPayload.deviceId) ?? '',
    site: typeof rawPayload.site === 'string' ? rawPayload.site : undefined,
    timestamp:
      typeof rawPayload.timestamp === 'string' && rawPayload.timestamp.trim() !== ''
        ? rawPayload.timestamp
        : new Date().toISOString(),
    latitude: pickFirstNumber(rawPayload, ['latitude', 'lat']) ?? undefined,
    longitude: pickFirstNumber(rawPayload, ['longitude', 'lng', 'lon']) ?? undefined,
    readings: {
      pm1: normalizedReadings.pm1 ?? undefined,
      pm25: normalizedReadings.pm25 ?? undefined,
      pm10: normalizedReadings.pm10 ?? undefined,
      co2: normalizedReadings.co2 ?? undefined,
      voc: normalizedReadings.voc ?? undefined,
      temp: normalizedReadings.temp ?? undefined,
      hum: normalizedReadings.hum ?? undefined,
      ch2o: normalizedReadings.ch2o ?? undefined,
      co: normalizedReadings.co ?? undefined,
      o3: normalizedReadings.o3 ?? undefined,
      no2: normalizedReadings.no2 ?? undefined,
    },
    metadata:
      typeof rawPayload.metadata === 'object' && rawPayload.metadata !== null
        ? (rawPayload.metadata as SensorReadingPayload['metadata'])
        : undefined,
  };
}

function deriveStatus(lastSeenAt: Date): DeviceStatus {
  const ageMs = Date.now() - lastSeenAt.getTime();
  const ageMinutes = ageMs / 60000;

  if (ageMinutes <= 15) return 'online';
  if (ageMinutes <= 120) return 'idle';
  return 'offline';
}

/**
 * GET /api/v1/sensor-data
 *
 * Returns latest device snapshot list for current user.
 * Requires authenticated session.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requestedLimit = Number(searchParams.get('limit') ?? '100');
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 1000)
      : 100;

    const latest = searchParams.get('latest');
    const deviceId = searchParams.get('device_id');
    const publicOnly = searchParams.get('public') === '1' || searchParams.get('public') === 'true';
    const includeOffline = searchParams.get('include_offline') === '1' || searchParams.get('include_offline') === 'true';
    const activeWindowParam = Number(searchParams.get('active_window_minutes'));
    const activeWindowMinutes = Number.isFinite(activeWindowParam) && activeWindowParam > 0
      ? Math.floor(activeWindowParam)
      : DEFAULT_ACTIVE_SENSOR_WINDOW_MINUTES;
    const includeLatest = latest === null ? !deviceId : latest === '1' || latest === 'true';

    const readingsUrl = new URL(`${CENTRAL_DATA_BASE_URL}/data`);
    readingsUrl.searchParams.set('limit', String(limit));
    if (deviceId) readingsUrl.searchParams.set('device_id', deviceId);
    if (includeLatest) readingsUrl.searchParams.set('latest', 'true');

    const devicesUrl = new URL(`${CENTRAL_DATA_BASE_URL}/devices`);
    devicesUrl.searchParams.set('limit', String(Math.max(limit, 200)));

    let rawReadings: CentralReading[];
    let rawDevices: CentralDevice[];
    try {
      [rawReadings, rawDevices] = await Promise.all([
        fetchCentralJson<CentralReading[]>(readingsUrl.toString()),
        fetchCentralJson<CentralDevice[]>(devicesUrl.toString()),
      ]);
    } catch (error) {
      if (isCentralNetworkError(error)) {
        console.warn('Central sensor server unreachable. Falling back to local database snapshot.', error);

        try {
          const dbReadings = await getFallbackDbReadings(Math.max(limit, 500), publicOnly);
          const dbSnapshot = buildDbSnapshot(dbReadings, deviceId);
          if (dbSnapshot.readings.length > 0) {
            const payload = includeOffline
              ? dbSnapshot
              : filterSnapshotByFreshness(dbSnapshot, activeWindowMinutes);
            return NextResponse.json(payload);
          }
        } catch (dbError) {
          console.error('Database fallback for sensor snapshot failed:', dbError);
        }

        if (ENABLE_SENSOR_MOCK_FALLBACK) {
          const mockPayload = buildMockSnapshot(deviceId);
          return NextResponse.json(mockPayload);
        }

        return NextResponse.json({ devices: [], readings: [] });
      }
      throw error;
    }

    const safeReadings = Array.isArray(rawReadings) ? rawReadings : [];
    const safeDevices = Array.isArray(rawDevices) ? rawDevices : [];

    const devicesById = buildDeviceIndex(safeDevices);
    const readings = normalizeApiReadings(safeReadings, devicesById);
    const devices = normalizeApiDevices(devicesById);
    const snapshot = { devices, readings };

    if (snapshot.readings.length === 0) {
      try {
        const dbReadings = await getFallbackDbReadings(Math.max(limit, 500), publicOnly);
        const dbSnapshot = buildDbSnapshot(dbReadings, deviceId);
        if (dbSnapshot.readings.length > 0) {
          const payload = includeOffline
            ? dbSnapshot
            : filterSnapshotByFreshness(dbSnapshot, activeWindowMinutes);
          return NextResponse.json(payload);
        }
      } catch (dbError) {
        console.error('Database fallback after empty central snapshot failed:', dbError);
      }
    }

    if (!includeOffline) {
      const filteredCentralSnapshot = filterSnapshotByFreshness(snapshot, activeWindowMinutes);
      if (filteredCentralSnapshot.readings.length > 0) {
        return NextResponse.json(filteredCentralSnapshot);
      }

      try {
        const dbReadings = await getFallbackDbReadings(Math.max(limit, 500), publicOnly);
        const dbSnapshot = buildDbSnapshot(dbReadings, deviceId);
        const filteredDbSnapshot = filterSnapshotByFreshness(dbSnapshot, activeWindowMinutes);
        if (filteredDbSnapshot.readings.length > 0) {
          return NextResponse.json(filteredDbSnapshot);
        }
      } catch (dbError) {
        console.error('Database fallback after stale central snapshot failed:', dbError);
      }

      return NextResponse.json(filteredCentralSnapshot);
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('Error fetching device snapshots:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/sensor-data
 * 
 * Accepts JSON sensor data from IoT devices
 * 
 * Authentication: Bearer token (IOT_DEVICE_SECRET)
 * Content-Type: application/json
 * 
 * Request Body:
 * {
 *   "device_id": "lab01",
 *   "site": "AGI_Lab",
 *   "timestamp": "2024-01-15T10:30:00Z",
 *   "latitude": 43.2221,
 *   "longitude": 76.8512,
 *   "readings": {
 *     "pm1": 12.3,
 *     "pm25": 25.7,
 *     "pm10": 43.1,
 *     "co2": 412,
 *     "voc": 0.65,
 *     "temp": 21.8,
 *     "hum": 46.2,
 *     "ch2o": 0.03,
 *     "co": 0.1,
 *     "o3": 18.5,
 *     "no2": 14.2
 *   },
 *   "metadata": {
 *     "battery": 87,
 *     "signal": -65,
 *     "firmware": "2.1.4"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authHeader = request.headers.get('authorization');
    const iotDeviceSecret = process.env.IOT_DEVICE_SECRET;

    if (!iotDeviceSecret) {
      console.error('IOT_DEVICE_SECRET is not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (token !== iotDeviceSecret) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid credentials' },
        { status: 401 }
      );
    }

    // Parse JSON body
    let payload: SensorReadingPayload;
    try {
      const requestPayload = (await request.json()) as Record<string, unknown>;
      payload = normalizeIncomingPayload(requestPayload);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate payload
    const validation = validateSensorReading(payload);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          errors: validation.errors,
          warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
        },
        { status: 400 }
      );
    }

    if ((payload.latitude !== undefined || payload.longitude !== undefined)) {
      if (payload.latitude === undefined || payload.longitude === undefined) {
        return NextResponse.json(
          { error: 'Both latitude and longitude are required together' },
          { status: 400 }
        );
      }

      if (!isValidAlmatyCoordinate(payload.latitude, payload.longitude)) {
        return NextResponse.json(
          { error: 'Coordinates must be within Almaty bounds' },
          { status: 400 }
        );
      }
    }

    // Generate hash for duplicate detection
    const dataHash = generateDataHash(payload);

    // Check for duplicate
    const isDuplicate = await checkDuplicateReading(dataHash);
    if (isDuplicate) {
      return NextResponse.json(
        {
          success: true,
          message: 'Duplicate reading detected and skipped',
          duplicate: true,
        },
        { status: 200 }
      );
    }

    // Find or create site
    let siteId: number | null = null;
    if (payload.site) {
      siteId = await findOrCreateSite(payload.site);
    }

    // Find or create sensor
    const sensor = await findOrCreateSensor({
      deviceId: payload.device_id,
      siteId,
      firmwareVersion: payload.metadata?.firmware,
      latitude: payload.latitude,
      longitude: payload.longitude,
    });

    // Insert sensor reading
    const readingId = await insertSensorReading({
      sensorId: sensor.id,
      timestamp: payload.timestamp,
      readings: payload.readings,
      metadata: payload.metadata,
      dataHash,
    });

    // Update sensor health if metadata provided
    if (payload.metadata?.battery !== undefined || payload.metadata?.signal !== undefined) {
      // This could be done asynchronously or in a separate endpoint
      // For now, we'll just log it
      console.log('Sensor health data received:', {
        sensorId: sensor.id,
        battery: payload.metadata.battery,
        signal: payload.metadata.signal,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Sensor data ingested successfully',
        data: {
          readingId,
          sensorId: sensor.id,
          deviceId: payload.device_id,
          timestamp: payload.timestamp,
        },
        warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error processing sensor data request:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
