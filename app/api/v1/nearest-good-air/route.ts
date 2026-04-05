import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByEmail } from '@/lib/data-access';
import type { GoodAirOption, NearestGoodAirResponse, RouteAqiBand } from '@/types/route';
import { isValidAlmatyCoordinate, parseCoordinatePair } from '@/lib/geo';
import { db } from '@/lib/db';
import { sensorReadings, sensors } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type ParsedCoords = { latitude: number; longitude: number };
type DeviceObservation = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  aqi: number;
  pm25: number | null;
};

const CENTRAL_DATA_BASE_URL = (process.env.CENTRAL_DATA_BASE_URL ?? 'http://data-tynys-aqserver-1:8082').replace(/\/$/, '');
const BEST_AVAILABLE_AIR_NOTE = 'Best available air nearby';
const LOCAL_NEAREST_WINDOW_MINUTES = Number(process.env.LOCAL_NEAREST_WINDOW_MINUTES ?? '180');
const NETWORK_ERROR_CODES = new Set(['EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH']);
const LOCAL_MOCK_DEVICES = [
  { id: 'dev-bus-01', latitude: 43.2383, longitude: 76.8897, site: 'Almaty Center Bus Hub', pm25: 10.8, aqi: 46 },
  { id: 'dev-bus-02', latitude: 43.2148, longitude: 76.8532, site: 'Abay Station Corridor', pm25: 18.2, aqi: 67 },
  { id: 'dev-bus-03', latitude: 43.1965, longitude: 76.9278, site: 'Airport Route Segment', pm25: 27.4, aqi: 89 },
] as const;
const PM25_AQI_BREAKPOINTS = [
  { cLow: 0, cHigh: 12, iLow: 0, iHigh: 50 },
  { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
  { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
  { cLow: 250.5, cHigh: 350.4, iLow: 301, iHigh: 400 },
  { cLow: 350.5, cHigh: 500.4, iLow: 401, iHigh: 500 },
] as const;

function parseFloatParam(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLocation(location?: string | null): ParsedCoords | null {
  return parseCoordinatePair(location);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function pickFirstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = toNumber(source[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function getNestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = source[key];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
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

function estimateAqiFromPm25(pm25: number): number {
  const clamped = Math.max(0, Math.min(500.4, Math.floor(pm25 * 10) / 10));
  const matched = PM25_AQI_BREAKPOINTS.find((bp) => clamped >= bp.cLow && clamped <= bp.cHigh);
  if (!matched) return 500;

  const ratio = (clamped - matched.cLow) / (matched.cHigh - matched.cLow);
  const aqi = matched.iLow + ratio * (matched.iHigh - matched.iLow);
  return Math.round(aqi);
}

function buildMockObservations(): DeviceObservation[] {
  return LOCAL_MOCK_DEVICES.map((device) => ({
    id: device.id,
    label: device.site,
    latitude: device.latitude,
    longitude: device.longitude,
    pm25: device.pm25,
    aqi: device.aqi,
  }));
}

function parseObservation(item: unknown, index: number): DeviceObservation | null {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    return null;
  }

  const raw = item as Record<string, unknown>;
  const lat = pickFirstNumber(raw, ['latitude', 'lat']);
  const lng = pickFirstNumber(raw, ['longitude', 'lng', 'lon']);
  const location = typeof raw.location === 'string' ? parseLocation(raw.location) : null;

  const latitude = lat ?? location?.latitude ?? null;
  const longitude = lng ?? location?.longitude ?? null;
  if (latitude === null || longitude === null || !isValidAlmatyCoordinate(latitude, longitude)) {
    return null;
  }

  const readingsRecord = getNestedRecord(raw, 'readings');
  const pm25 =
    pickFirstNumber(raw, ['pm25', 'pm2_5', 'PM2.5', 'PM25', 'pm_2_5'])
    ?? (readingsRecord ? pickFirstNumber(readingsRecord, ['pm25', 'pm2_5', 'PM2.5', 'PM25', 'pm_2_5']) : null);

  const explicitAqi =
    pickFirstNumber(raw, ['aqi', 'AQI', 'air_quality_index', 'airQualityIndex'])
    ?? (readingsRecord ? pickFirstNumber(readingsRecord, ['aqi', 'AQI', 'air_quality_index', 'airQualityIndex']) : null);

  const fallbackValue =
    pickFirstNumber(raw, ['value', 'pm10', 'pm1'])
    ?? (readingsRecord ? pickFirstNumber(readingsRecord, ['value', 'pm10', 'pm1']) : null);

  const aqi = explicitAqi ?? (pm25 !== null ? estimateAqiFromPm25(pm25) : (fallbackValue ?? 500));
  const id =
    (typeof raw.device_id === 'string' && raw.device_id.trim() !== '' ? raw.device_id.trim() : null)
    ?? (typeof raw.deviceId === 'string' && raw.deviceId.trim() !== '' ? raw.deviceId.trim() : null)
    ?? (typeof raw.id === 'string' && raw.id.trim() !== '' ? raw.id.trim() : null)
    ?? `reading-${index}-${latitude.toFixed(5)},${longitude.toFixed(5)}`;

  const siteName =
    (typeof raw.site === 'string' && raw.site.trim() !== '' ? raw.site.trim() : null)
    ?? (typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : null);
  const label = siteName && siteName !== id ? `${id} · ${siteName}` : id;

  return {
    id,
    label,
    latitude,
    longitude,
    aqi,
    pm25,
  };
}

async function loadObservationsFromCentral(): Promise<DeviceObservation[]> {
  const dataUrl = new URL(`${CENTRAL_DATA_BASE_URL}/data`);
  dataUrl.searchParams.set('latest', 'true');

  try {
    const raw = await fetchCentralJson<unknown>(dataUrl.toString());
    const rows = Array.isArray(raw) ? raw : [];
    const normalized = rows
      .map((item, index) => parseObservation(item, index))
      .filter((item): item is DeviceObservation => item !== null);

    if (normalized.length === 0) {
      console.warn('Central sensor response had no valid nearest-good-air points. Falling back to local mock devices.');
      return buildMockObservations();
    }

    return normalized;
  } catch (error) {
    if (isCentralNetworkError(error)) {
      console.warn('Central sensor server unreachable for nearest-good-air. Returning local mock devices.', error);
      return buildMockObservations();
    }
    throw error;
  }
}

async function loadObservationsFromLocalDb(): Promise<DeviceObservation[]> {
  const recentRows = await db
    .select({
      deviceId: sensors.deviceId,
      latitude: sensors.latitude,
      longitude: sensors.longitude,
      timestamp: sensorReadings.timestamp,
      pm25: sensorReadings.pm25,
      pm10: sensorReadings.pm10,
      pm1: sensorReadings.pm1,
      co2: sensorReadings.co2,
      value: sensorReadings.value,
    })
    .from(sensorReadings)
    .leftJoin(sensors, eq(sensorReadings.sensorId, sensors.id))
    .orderBy(desc(sensorReadings.timestamp))
    .limit(2000);

  const cutoffMs = Date.now() - Math.max(1, LOCAL_NEAREST_WINDOW_MINUTES) * 60 * 1000;
  const dedupByDevice = new Map<string, DeviceObservation>();

  for (const row of recentRows) {
    const id = typeof row.deviceId === 'string' ? row.deviceId.trim() : '';
    if (!id) continue;
    if (dedupByDevice.has(id)) continue;

    const latitude = typeof row.latitude === 'number' ? row.latitude : null;
    const longitude = typeof row.longitude === 'number' ? row.longitude : null;
    if (latitude === null || longitude === null || !isValidAlmatyCoordinate(latitude, longitude)) continue;

    const tsMs = row.timestamp instanceof Date ? row.timestamp.getTime() : new Date(row.timestamp).getTime();
    if (!Number.isFinite(tsMs) || tsMs < cutoffMs) continue;

    const pm25 = typeof row.pm25 === 'number' ? row.pm25 : null;
    const fallbackValue =
      typeof row.value === 'number'
        ? row.value
        : typeof row.pm10 === 'number'
          ? row.pm10
          : typeof row.pm1 === 'number'
            ? row.pm1
            : typeof row.co2 === 'number'
              ? row.co2
              : 500;

    const aqi = pm25 !== null ? estimateAqiFromPm25(pm25) : fallbackValue;

    dedupByDevice.set(id, {
      id,
      label: id,
      latitude,
      longitude,
      pm25,
      aqi,
    });
  }

  return Array.from(dedupByDevice.values());
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(from: ParsedCoords, to: ParsedCoords) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function resolveAqiBand(aqi: number): RouteAqiBand {
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'usg';
  if (aqi <= 200) return 'unhealthy';
  if (aqi <= 300) return 'very-unhealthy';
  return 'hazardous';
}

function buildOption(source: ParsedCoords, device: DeviceObservation): GoodAirOption {
  const distanceKm = haversineDistanceKm(source, { latitude: device.latitude, longitude: device.longitude });
  return {
    id: device.id,
    label: device.label,
    latitude: device.latitude,
    longitude: device.longitude,
    aqi: device.aqi,
    aqiBand: resolveAqiBand(device.aqi),
    distanceKm,
  };
}

function selectNearestOptions(
  source: ParsedCoords,
  observations: DeviceObservation[],
): { options: GoodAirOption[]; message?: string } {
  const deduped = new Map<string, DeviceObservation>();
  for (const item of observations) {
    const key = item.id.trim() || `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}`;
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  }

  const allOptions = Array.from(deduped.values())
    .map((item) => ({ option: buildOption(source, item), pm25: item.pm25 }))
    .sort((a, b) => a.option.distanceKm - b.option.distanceKm);

  if (allOptions.length === 0) {
    return { options: [] };
  }

  const takeTop = (items: Array<{ option: GoodAirOption }>) => items.slice(0, 3).map((item) => item.option);

  const primaryClean = allOptions.filter(({ option, pm25 }) => option.aqi < 50 || (pm25 !== null && pm25 < 12));
  if (primaryClean.length >= 3) {
    return { options: takeTop(primaryClean) };
  }

  const selectedIds = new Set(primaryClean.map(({ option }) => option.id));
  const relaxedClean = allOptions.filter(({ option }) => option.aqi < 100 && !selectedIds.has(option.id));
  const preferredCombined = [...primaryClean, ...relaxedClean];

  if (preferredCombined.length >= 3) {
    return { options: takeTop(preferredCombined) };
  }

  const fallbackAdditional = allOptions.filter(({ option }) => !selectedIds.has(option.id));
  const combinedWithFallback = [...primaryClean, ...fallbackAdditional];
  if (combinedWithFallback.length > 0) {
    const message = primaryClean.length === 0 ? BEST_AVAILABLE_AIR_NOTE : undefined;
    return { options: takeTop(combinedWithFallback), message };
  }

  return { options: [allOptions[0].option], message: BEST_AVAILABLE_AIR_NOTE };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const latitude = parseFloatParam(searchParams.get('lat'));
    const longitude = parseFloatParam(searchParams.get('lng'));

    if (latitude === null || longitude === null) {
      return NextResponse.json({ error: 'lat and lng query params are required' }, { status: 400 });
    }

    if (!isValidAlmatyCoordinate(latitude, longitude)) {
      return NextResponse.json({ error: 'Coordinates must be within Almaty bounds' }, { status: 400 });
    }

    const source = { latitude, longitude };
    let observations = await loadObservationsFromLocalDb();
    if (observations.length === 0) {
      observations = await loadObservationsFromCentral();
    }
    let selected = selectNearestOptions(source, observations);
    if (selected.options.length === 0) {
      selected = selectNearestOptions(source, buildMockObservations());
    }

    const payload: NearestGoodAirResponse = {
      options: selected.options,
      source,
      generatedAt: new Date().toISOString(),
      message: selected.message,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Failed to load nearest good air options:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
