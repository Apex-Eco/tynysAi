import { NextRequest, NextResponse } from 'next/server';
import type { RouteGeometryResponse, RouteRequestBody, RouteStep } from '@/types/route';
import { isValidAlmatyCoordinate } from '@/lib/geo';

export const dynamic = 'force-dynamic';

function isValidCoordinate(latitude: number, longitude: number) {
  return isValidAlmatyCoordinate(latitude, longitude);
}

type OsrmRouteResponse = {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: {
      coordinates?: Array<[number, number]>;
    };
    legs?: Array<{
      steps?: Array<{
        distance: number;
        duration: number;
        name?: string;
        maneuver?: {
          type?: string;
          modifier?: string;
        };
      }>;
    }>;
  }>;
  message?: string;
};

function toTitleCase(value: string) {
  return value
    .replace(/[_-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatStepInstruction(step: {
  name?: string;
  maneuver?: {
    type?: string;
    modifier?: string;
  };
}) {
  const maneuverType = step.maneuver?.type?.trim();
  const maneuverModifier = step.maneuver?.modifier?.trim();
  const roadName = step.name?.trim();

  if (maneuverType === 'depart') {
    return roadName ? `Head out via ${roadName}` : 'Start route';
  }

  if (maneuverType === 'arrive') {
    return 'Arrive at destination';
  }

  if (maneuverType === 'roundabout') {
    return roadName ? `Enter roundabout and continue on ${roadName}` : 'Enter roundabout';
  }

  if (maneuverType === 'continue' || maneuverType === 'new name') {
    return roadName ? `Continue on ${roadName}` : 'Continue straight';
  }

  if (maneuverModifier) {
    const direction = toTitleCase(maneuverModifier);
    return roadName ? `Turn ${direction} onto ${roadName}` : `Turn ${direction}`;
  }

  if (maneuverType) {
    const typeLabel = toTitleCase(maneuverType);
    return roadName ? `${typeLabel} onto ${roadName}` : typeLabel;
  }

  return roadName ? `Continue on ${roadName}` : 'Continue';
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RouteRequestBody;
    const source = body?.source;
    const destination = body?.destination;

    if (!source || !destination) {
      return NextResponse.json({ error: 'source and destination are required' }, { status: 400 });
    }

    if (!isValidCoordinate(source.latitude, source.longitude) || !isValidCoordinate(destination.latitude, destination.longitude)) {
      return NextResponse.json({ error: 'Invalid source or destination coordinates' }, { status: 400 });
    }

    const baseUrl = process.env.OSRM_API_BASE_URL ?? 'https://router.project-osrm.org';
    const osrmUrl = `${baseUrl}/route/v1/driving/${source.longitude},${source.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=true`;

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 12000);

    let upstream: Response;
    try {
      upstream = await fetch(osrmUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        cache: 'no-store',
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Routing provider error' }, { status: 502 });
    }

    const payload = (await upstream.json()) as OsrmRouteResponse;
    if (payload.code !== 'Ok' || !payload.routes || payload.routes.length === 0) {
      return NextResponse.json(
        { error: payload.message || 'No route found for selected destination' },
        { status: 404 },
      );
    }

    const primary = payload.routes[0];
    const coordinates = primary.geometry?.coordinates ?? [];
    const geometry = coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);

    if (geometry.length < 2) {
      return NextResponse.json({ error: 'Routing provider returned invalid geometry' }, { status: 502 });
    }

    const steps: RouteStep[] = (primary.legs ?? [])
      .flatMap((leg) => leg.steps ?? [])
      .filter((step) => Number.isFinite(step.distance) && Number.isFinite(step.duration))
      .map((step) => ({
        distanceMeters: step.distance,
        durationSeconds: step.duration,
        instruction: formatStepInstruction(step),
        maneuverType: step.maneuver?.type,
        maneuverModifier: step.maneuver?.modifier,
        name: step.name,
      }));

    const response: RouteGeometryResponse = {
      geometry,
      distanceMeters: primary.distance,
      durationSeconds: primary.duration,
      steps,
    };

    return NextResponse.json(response);
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      return NextResponse.json({ error: 'Routing request timed out' }, { status: 504 });
    }
    console.error('Failed to build route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}