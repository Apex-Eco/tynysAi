import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByEmail, getRecentPublicSensorReadings } from '@/lib/data-access';
import type { GoodAirOption, NearestGoodAirResponse, RouteAqiBand } from '@/types/route';
import { isValidAlmatyCoordinate, parseCoordinatePair } from '@/lib/geo';

export const dynamic = 'force-dynamic';

type ParsedCoords = { latitude: number; longitude: number };

function parseFloatParam(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLocation(location?: string | null): ParsedCoords | null {
  return parseCoordinatePair(location);
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
    const readings = await getRecentPublicSensorReadings(1500);
    const deduped = new Map<string, GoodAirOption>();

    for (const reading of readings) {
      const coords = parseLocation(reading.location);
      if (!coords) continue;

      const aqiValue = Number(reading.value);
      if (!Number.isFinite(aqiValue) || aqiValue > 50) continue;

      const distanceKm = haversineDistanceKm(source, coords);
      const key = `${coords.latitude.toFixed(5)},${coords.longitude.toFixed(5)}`;
      const option: GoodAirOption = {
        id: key,
        label: reading.sensorId || key,
        latitude: coords.latitude,
        longitude: coords.longitude,
        aqi: aqiValue,
        aqiBand: resolveAqiBand(aqiValue),
        distanceKm,
      };

      const current = deduped.get(key);
      if (!current) {
        deduped.set(key, option);
        continue;
      }

      if (option.distanceKm < current.distanceKm || option.aqi < current.aqi) {
        deduped.set(key, option);
      }
    }

    const options = Array.from(deduped.values())
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 10);

    const payload: NearestGoodAirResponse = {
      options,
      source,
      generatedAt: new Date().toISOString(),
      message: options.length === 0 ? 'No nearby clean-air options found right now.' : undefined,
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