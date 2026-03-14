import { NextRequest, NextResponse } from 'next/server';
import { 
  validateSensorReading, 
  generateDataHash,
  type SensorReadingPayload 
} from '@/lib/sensor-validation';
import { getSession } from '@/lib/auth';
import {
  getUserByEmail,
  getRecentPublicSensorReadings,
} from '@/lib/data-access';
import { 
  insertSensorReading,
  findOrCreateSensor,
  findOrCreateSite,
  checkDuplicateReading
} from '@/lib/sensor-data-access';
import { isValidAlmatyCoordinate, parseCoordinatePair } from '@/lib/geo';

export const dynamic = 'force-dynamic';

type DeviceStatus = 'online' | 'idle' | 'offline';

function parseCoords(location?: string | null) {
  return parseCoordinatePair(location);
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
    const isPublicRequest = searchParams.get('public') === '1';
    const requestedLimit = Number(searchParams.get('limit') ?? '300');
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 2000)
      : 300;

    const readings = isPublicRequest
      ? await getRecentPublicSensorReadings(limit)
      : await (async () => {
          const session = await getSession();

          if (!session?.user?.email) {
            throw new Error('UNAUTHORIZED');
          }

          const user = await getUserByEmail(session.user.email);
          if (!user) {
            throw new Error('USER_NOT_FOUND');
          }

          // Authenticated widgets should reflect the same live ingest stream
          // the public map uses, not account-seeded demo rows.
          return getRecentPublicSensorReadings(limit);
        })();

    if (!Array.isArray(readings)) {
      return NextResponse.json({ devices: [], readings: [] });
    }
    const latestByDevice = new Map<string, (typeof readings)[number]>();

    for (const reading of readings) {
      if (!reading.sensorId || latestByDevice.has(reading.sensorId)) {
        continue;
      }
      latestByDevice.set(reading.sensorId, reading);
    }

    const devices = Array.from(latestByDevice.entries())
      .map(([deviceId, reading]) => {
        const coords = parseCoords(reading.location);
        if (!coords) return null;

        const ingestedAt =
          reading.ingestedAt instanceof Date ? reading.ingestedAt : new Date(reading.ingestedAt);

        if (Number.isNaN(ingestedAt.getTime())) return null;

        return {
          id: deviceId,
          name: deviceId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          status: deriveStatus(ingestedAt),
          lastSeenAt: ingestedAt.toISOString(),
        };
      })
      .filter((device): device is NonNullable<typeof device> => device !== null);

    const normalizedReadings = readings
      .filter((reading) => Boolean(reading.sensorId) && Boolean(parseCoords(reading.location)))
      .map((reading) => ({
        sensorId: reading.sensorId,
        location: reading.location,
        value: Number(reading.value),
        timestamp: reading.timestamp,
        mainReadings: {
          pm25: reading.pm25 ?? undefined,
          pm10: reading.pm10 ?? undefined,
          co2: reading.co2 ?? undefined,
          temperatureC: reading.temperature ?? undefined,
          humidityPct: reading.humidity ?? undefined,
        },
      }));

    return NextResponse.json({ devices, readings: normalizedReadings });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
      payload = await request.json();
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
