/**
 * Sensor Data Access Layer
 * Functions for querying and inserting sensor data
 */

import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { db } from './db';
import { sensors, sensorReadings, sites, sensorHealth } from './db/schema';
import type { SensorReadingPayload } from './sensor-validation';
import { isValidAlmatyCoordinate } from './geo';

/**
 * Find or create a site by name
 */
export async function findOrCreateSite(siteName: string): Promise<number> {
  // Try to find existing site
  const [existingSite] = await db
    .select()
    .from(sites)
    .where(eq(sites.siteName, siteName))
    .limit(1);

  if (existingSite) {
    return existingSite.id;
  }

  // Create new site
  const [newSite] = await db
    .insert(sites)
    .values({
      siteName,
      updatedAt: new Date(),
    })
    .returning();

  return newSite.id;
}

/**
 * Find or create a sensor by device ID
 */
export async function findOrCreateSensor(params: {
  deviceId: string;
  siteId?: number | null;
  firmwareVersion?: string;
  latitude?: number;
  longitude?: number;
}): Promise<typeof sensors.$inferSelect> {
  const hasValidCoordinates =
    params.latitude !== undefined &&
    params.longitude !== undefined &&
    isValidAlmatyCoordinate(params.latitude, params.longitude);

  const normalizedLatitude = hasValidCoordinates ? params.latitude : undefined;
  const normalizedLongitude = hasValidCoordinates ? params.longitude : undefined;

  // Try to find existing sensor
  const [existingSensor] = await db
    .select()
    .from(sensors)
    .where(eq(sensors.deviceId, params.deviceId))
    .limit(1);

  if (existingSensor) {
    const hasFirmwareUpdate =
      !!params.firmwareVersion && existingSensor.firmwareVersion !== params.firmwareVersion;
    const hasLatitudeUpdate =
      normalizedLatitude !== undefined && existingSensor.latitude !== normalizedLatitude;
    const hasLongitudeUpdate =
      normalizedLongitude !== undefined && existingSensor.longitude !== normalizedLongitude;

    if (hasFirmwareUpdate || hasLatitudeUpdate || hasLongitudeUpdate) {
      const [updated] = await db
        .update(sensors)
        .set({
          firmwareVersion: hasFirmwareUpdate ? params.firmwareVersion : existingSensor.firmwareVersion,
          latitude: hasLatitudeUpdate ? normalizedLatitude : existingSensor.latitude,
          longitude: hasLongitudeUpdate ? normalizedLongitude : existingSensor.longitude,
          updatedAt: new Date(),
        })
        .where(eq(sensors.id, existingSensor.id))
        .returning();
      
      return updated;
    }
    
    return existingSensor;
  }

  // Create new sensor
  const [newSensor] = await db
    .insert(sensors)
    .values({
      deviceId: params.deviceId,
      siteId: params.siteId || null,
      sensorType: 'air_quality', // Default type
      firmwareVersion: params.firmwareVersion || null,
      latitude: normalizedLatitude ?? null,
      longitude: normalizedLongitude ?? null,
      isActive: true,
      updatedAt: new Date(),
    })
    .returning();

  return newSensor;
}

/**
 * Check if a reading with the same hash already exists (duplicate detection)
 */
export async function checkDuplicateReading(dataHash: string): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(sensorReadings)
    .where(eq(sensorReadings.dataHash, dataHash))
    .limit(1);

  return !!existing;
}

/**
 * Insert a sensor reading
 */
export async function insertSensorReading(params: {
  sensorId: number;
  timestamp: string;
  readings: SensorReadingPayload['readings'];
  metadata?: SensorReadingPayload['metadata'];
  dataHash: string;
}): Promise<number> {
  const [reading] = await db
    .insert(sensorReadings)
    .values({
      sensorId: params.sensorId,
      timestamp: new Date(params.timestamp),
      serverReceivedAt: new Date(),
      pm1: params.readings.pm1 ?? null,
      pm25: params.readings.pm25 ?? null,
      pm10: params.readings.pm10 ?? null,
      co2: params.readings.co2 ?? null,
      co: params.readings.co ?? null,
      o3: params.readings.o3 ?? null,
      no2: params.readings.no2 ?? null,
      voc: params.readings.voc ?? null,
      ch2o: params.readings.ch2o ?? null,
      temperature: params.readings.temp ?? null,
      humidity: params.readings.hum ?? null,
      pressure: params.readings.pressure ?? null,
      batteryLevel: params.metadata?.battery ?? null,
      signalStrength: params.metadata?.signal ?? null,
      errorCode: params.metadata?.error_code ?? null,
      dataHash: params.dataHash,
      ingestedAt: new Date(),
    })
    .returning();

  return reading.id;
}

/**
 * Get latest readings from all active sensors
 */
export async function getLatestSensorReadings(limit: number = 100) {
  const readings = await db
    .select({
      id: sensorReadings.id,
      sensorId: sensorReadings.sensorId,
      deviceId: sensors.deviceId,
      timestamp: sensorReadings.timestamp,
      pm25: sensorReadings.pm25,
      pm10: sensorReadings.pm10,
      co2: sensorReadings.co2,
      temperature: sensorReadings.temperature,
      humidity: sensorReadings.humidity,
      batteryLevel: sensorReadings.batteryLevel,
      signalStrength: sensorReadings.signalStrength,
      siteName: sites.siteName,
    })
    .from(sensorReadings)
    .innerJoin(sensors, eq(sensorReadings.sensorId, sensors.id))
    .leftJoin(sites, eq(sensors.siteId, sites.id))
    .where(eq(sensors.isActive, true))
    .orderBy(desc(sensorReadings.timestamp))
    .limit(limit);

  return readings;
}

/**
 * Get readings for a specific sensor within a time range
 */
export async function getSensorReadingsByDeviceId(
  deviceId: string,
  startDate: Date,
  endDate: Date
) {
  const readings = await db
    .select()
    .from(sensorReadings)
    .innerJoin(sensors, eq(sensorReadings.sensorId, sensors.id))
    .where(
      and(
        eq(sensors.deviceId, deviceId),
        gte(sensorReadings.timestamp, startDate),
        lte(sensorReadings.timestamp, endDate)
      )
    )
    .orderBy(desc(sensorReadings.timestamp));

  return readings;
}

/**
 * Get hourly aggregated readings for a sensor
 */
export async function getHourlyAggregates(
  sensorId: number,
  startDate: Date,
  endDate: Date
) {
  const aggregates = await db
    .select({
      hour: sql<string>`DATE_TRUNC('hour', ${sensorReadings.timestamp})`,
      avg_pm25: sql<number>`AVG(${sensorReadings.pm25})`,
      max_pm25: sql<number>`MAX(${sensorReadings.pm25})`,
      min_pm25: sql<number>`MIN(${sensorReadings.pm25})`,
      avg_pm10: sql<number>`AVG(${sensorReadings.pm10})`,
      avg_co2: sql<number>`AVG(${sensorReadings.co2})`,
      avg_temp: sql<number>`AVG(${sensorReadings.temperature})`,
      avg_humidity: sql<number>`AVG(${sensorReadings.humidity})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(sensorReadings)
    .where(
      and(
        eq(sensorReadings.sensorId, sensorId),
        gte(sensorReadings.timestamp, startDate),
        lte(sensorReadings.timestamp, endDate)
      )
    )
    .groupBy(sql`DATE_TRUNC('hour', ${sensorReadings.timestamp})`)
    .orderBy(sql`DATE_TRUNC('hour', ${sensorReadings.timestamp})`);

  return aggregates;
}

/**
 * Get daily aggregated readings for a sensor
 */
export async function getDailyAggregates(
  sensorId: number,
  startDate: Date,
  endDate: Date
) {
  const aggregates = await db
    .select({
      day: sql<string>`DATE_TRUNC('day', ${sensorReadings.timestamp})`,
      avg_pm25: sql<number>`AVG(${sensorReadings.pm25})`,
      max_pm25: sql<number>`MAX(${sensorReadings.pm25})`,
      min_pm25: sql<number>`MIN(${sensorReadings.pm25})`,
      avg_pm10: sql<number>`AVG(${sensorReadings.pm10})`,
      avg_co2: sql<number>`AVG(${sensorReadings.co2})`,
      avg_temp: sql<number>`AVG(${sensorReadings.temperature})`,
      avg_humidity: sql<number>`AVG(${sensorReadings.humidity})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(sensorReadings)
    .where(
      and(
        eq(sensorReadings.sensorId, sensorId),
        gte(sensorReadings.timestamp, startDate),
        lte(sensorReadings.timestamp, endDate)
      )
    )
    .groupBy(sql`DATE_TRUNC('day', ${sensorReadings.timestamp})`)
    .orderBy(sql`DATE_TRUNC('day', ${sensorReadings.timestamp})`);

  return aggregates;
}

/**
 * Get all active sensors with their latest reading
 */
export async function getAllActiveSensors() {
  const activeSensors = await db
    .select({
      id: sensors.id,
      deviceId: sensors.deviceId,
      siteName: sites.siteName,
      latitude: sensors.latitude,
      longitude: sensors.longitude,
      firmwareVersion: sensors.firmwareVersion,
      isActive: sensors.isActive,
      latestReading: sql<Date>`MAX(${sensorReadings.timestamp})`,
    })
    .from(sensors)
    .leftJoin(sites, eq(sensors.siteId, sites.id))
    .leftJoin(sensorReadings, eq(sensors.id, sensorReadings.sensorId))
    .where(eq(sensors.isActive, true))
    .groupBy(
      sensors.id,
      sensors.deviceId,
      sites.siteName,
      sensors.latitude,
      sensors.longitude,
      sensors.firmwareVersion,
      sensors.isActive
    );

  return activeSensors;
}

/**
 * Get sensors with low battery (< 20%)
 */
export async function getSensorsWithLowBattery(threshold: number = 20) {
  const lowBatterySensors = await db
    .select({
      sensorId: sensorReadings.sensorId,
      deviceId: sensors.deviceId,
      batteryLevel: sensorReadings.batteryLevel,
      timestamp: sensorReadings.timestamp,
      siteName: sites.siteName,
    })
    .from(sensorReadings)
    .innerJoin(sensors, eq(sensorReadings.sensorId, sensors.id))
    .leftJoin(sites, eq(sensors.siteId, sites.id))
    .where(
      and(
        eq(sensors.isActive, true),
        sql`${sensorReadings.batteryLevel} < ${threshold}`
      )
    )
    .orderBy(desc(sensorReadings.timestamp));

  // Get only the latest reading per sensor
  const sensorMap = new Map();
  for (const reading of lowBatterySensors) {
    if (!sensorMap.has(reading.sensorId)) {
      sensorMap.set(reading.sensorId, reading);
    }
  }

  return Array.from(sensorMap.values());
}

/**
 * Get readings exceeding thresholds
 */
export async function getReadingsExceedingThresholds(params: {
  pm25Threshold?: number;
  pm10Threshold?: number;
  co2Threshold?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const conditions = [];

  if (params.pm25Threshold) {
    conditions.push(sql`${sensorReadings.pm25} > ${params.pm25Threshold}`);
  }
  if (params.pm10Threshold) {
    conditions.push(sql`${sensorReadings.pm10} > ${params.pm10Threshold}`);
  }
  if (params.co2Threshold) {
    conditions.push(sql`${sensorReadings.co2} > ${params.co2Threshold}`);
  }
  if (params.startDate) {
    conditions.push(gte(sensorReadings.timestamp, params.startDate));
  }
  if (params.endDate) {
    conditions.push(lte(sensorReadings.timestamp, params.endDate));
  }

  const readings = await db
    .select({
      id: sensorReadings.id,
      sensorId: sensorReadings.sensorId,
      deviceId: sensors.deviceId,
      timestamp: sensorReadings.timestamp,
      pm25: sensorReadings.pm25,
      pm10: sensorReadings.pm10,
      co2: sensorReadings.co2,
      siteName: sites.siteName,
    })
    .from(sensorReadings)
    .innerJoin(sensors, eq(sensorReadings.sensorId, sensors.id))
    .leftJoin(sites, eq(sensors.siteId, sites.id))
    .where(and(...conditions))
    .orderBy(desc(sensorReadings.timestamp));

  return readings;
}

/**
 * Get sensors within a geographic radius
 */
export async function getSensorsWithinRadius(
  centerLat: number,
  centerLon: number,
  radiusKm: number
) {
  // Using Haversine formula for distance calculation
  const sensorsInRadius = await db
    .select({
      id: sensors.id,
      deviceId: sensors.deviceId,
      latitude: sensors.latitude,
      longitude: sensors.longitude,
      siteName: sites.siteName,
      distance: sql<number>`
        6371 * acos(
          cos(radians(${centerLat})) *
          cos(radians(${sensors.latitude})) *
          cos(radians(${sensors.longitude}) - radians(${centerLon})) +
          sin(radians(${centerLat})) *
          sin(radians(${sensors.latitude}))
        )
      `,
    })
    .from(sensors)
    .leftJoin(sites, eq(sensors.siteId, sites.id))
    .where(
      and(
        eq(sensors.isActive, true),
        sql`${sensors.latitude} IS NOT NULL`,
        sql`${sensors.longitude} IS NOT NULL`,
        sql`
          6371 * acos(
            cos(radians(${centerLat})) *
            cos(radians(${sensors.latitude})) *
            cos(radians(${sensors.longitude}) - radians(${centerLon})) +
            sin(radians(${centerLat})) *
            sin(radians(${sensors.latitude}))
          ) <= ${radiusKm}
        `
      )
    );

  return sensorsInRadius;
}

/**
 * Update sensor health record
 */
export async function updateSensorHealth(params: {
  sensorId: number;
  uptimeSeconds?: number;
  readingCount24h?: number;
  batteryVoltage?: number;
  memoryUsage?: number;
  lastReboot?: Date;
  healthStatus: 'healthy' | 'warning' | 'critical' | 'offline';
}) {
  const [healthRecord] = await db
    .insert(sensorHealth)
    .values({
      sensorId: params.sensorId,
      checkTimestamp: new Date(),
      uptimeSeconds: params.uptimeSeconds ?? null,
      readingCount24h: params.readingCount24h ?? null,
      batteryVoltage: params.batteryVoltage ?? null,
      memoryUsage: params.memoryUsage ?? null,
      lastReboot: params.lastReboot ?? null,
      healthStatus: params.healthStatus,
    })
    .returning();

  return healthRecord;
}
