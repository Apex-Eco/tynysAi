import { eq, desc, count, or, isNull } from 'drizzle-orm';
import { db } from './db';
import { iotData, sensorReadings, users, sensors } from './db/schema';
import type { SensorReading } from './csv-parser';
import { classifyAqiCategory } from './aqi';

/**
 * Creates a new user in the database
 * @param userData - The user data to insert
 * @returns The created user record
 */
export async function createUser(userData: {
  name: string;
  email: string;
  clerkId?: string; // Optional for backward compatibility
}) {
  try {
    const insertData: {
      name: string;
      email: string;
      clerkId?: string;
    } = {
      name: userData.name,
      email: userData.email,
    };
    
    // Only include clerkId if it's provided
    if (userData.clerkId) {
      insertData.clerkId = userData.clerkId;
    }
    
    const [newUser] = await db
      .insert(users)
      .values(insertData)
      .returning();

    return newUser;
  } catch (error) {
    console.error('Error creating user:', error);
    throw new Error('Failed to create user');
  }
}

/**
 * Retrieves a user by their email address
 * @param email - The user's email address
 * @returns User record or null if not found
 */
export async function getUserByEmail(email: string) {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user || null;
  } catch (error) {
    console.error('Error fetching user by email:', error);
    throw new Error('Failed to fetch user');
  }
}

/**
 * Retrieves a user by their Clerk ID (kept for backward compatibility)
 * @param clerkId - The Clerk user ID
 * @returns User record or null if not found
 * @deprecated Use getUserByEmail instead
 */
export async function getUserByClerkId(clerkId: string) {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    return user || null;
  } catch (error) {
    console.error('Error fetching user by Clerk ID:', error);
    throw new Error('Failed to fetch user');
  }
}

/**
 * Retrieves IoT data filtered by the given userId
 * @param userId - The ID of the user to filter data for
 * @returns Array of IoT data records for the specified user
 */
export async function getUserData(userId: number) {
  try {
    const data = await db
      .select()
      .from(iotData)
      .where(eq(iotData.userId, userId));

    return data;
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw new Error('Failed to fetch user data');
  }
}

/**
 * Retrieves recent sensor readings for a specific user with optional limit
 * Maps new comprehensive schema to legacy format for backward compatibility
 * @param userId - The ID of the user to filter readings for
 * @param limit - Maximum number of readings to retrieve (default: 100)
 * @returns Array of sensor readings for the specified user in legacy format
 */
export async function getRecentSensorReadings(
  userId: number,
  limit: number = 100,
  options?: { includePublicReadings?: boolean },
) {
  try {
    const readings = await db
      .select({
        id: sensorReadings.id,
        sensorId: sensorReadings.sensorId,
        deviceId: sensors.deviceId,
        timestamp: sensorReadings.timestamp,
        pm25: sensorReadings.pm25,
        pm10: sensorReadings.pm10,
        pm1: sensorReadings.pm1,
        co2: sensorReadings.co2,
        temperature: sensorReadings.temperature,
        humidity: sensorReadings.humidity,
        value: sensorReadings.value,
        location: sensorReadings.location,
        transportType: sensorReadings.transportType,
        ingestedAt: sensorReadings.ingestedAt,
        latitude: sensors.latitude,
        longitude: sensors.longitude,
      })
      .from(sensorReadings)
      .leftJoin(sensors, eq(sensorReadings.sensorId, sensors.id))
      .where(
        options?.includePublicReadings
          ?? true
          ? or(eq(sensorReadings.userId, userId), isNull(sensorReadings.userId))
          : eq(sensorReadings.userId, userId)
      )
      .orderBy(desc(sensorReadings.ingestedAt))
      .limit(limit);

    // Map to legacy format expected by dashboard
    return readings.map((reading) => {
      // Format location as "lat,lng" if coordinates are available, otherwise use the location field
      let locationStr = reading.location;
      if (reading.latitude != null && reading.longitude != null) {
        // Use sensor coordinates if available
        locationStr = `${reading.latitude},${reading.longitude}`;
      } else if (reading.location && !reading.location.includes(',')) {
        // If location is just a name (like "Almaty") and we don't have coordinates, keep it as is
        // The map component will skip it, but at least we preserve the original data
        locationStr = reading.location;
      }

      const { category: aqiCategory, rule: aqiRule } = classifyAqiCategory(
        reading.pm25,
        reading.pm10,
        reading.co2,
        reading.temperature,
        reading.humidity,
      );

      return {
        id: reading.id,
        timestamp: reading.timestamp instanceof Date 
          ? reading.timestamp.toISOString() 
          : typeof reading.timestamp === 'string' 
            ? reading.timestamp 
            : new Date(reading.timestamp).toISOString(),
        sensorId: reading.deviceId || reading.sensorId?.toString() || '', // Use deviceId if available, fallback to sensorId
        // Use legacy value field if available, otherwise use pm25, fallback to pm10, pm1, or co2
        value: reading.value ?? reading.pm25 ?? reading.pm10 ?? reading.pm1 ?? reading.co2 ?? 0,
        pm25: reading.pm25,
        pm10: reading.pm10,
        co2: reading.co2,
        temperature: reading.temperature,
        humidity: reading.humidity,
        aqiCategory,
        aqiRule,
        location: locationStr,
        transportType: reading.transportType,
        ingestedAt: reading.ingestedAt instanceof Date 
          ? reading.ingestedAt 
          : typeof reading.ingestedAt === 'string' 
            ? new Date(reading.ingestedAt) 
            : reading.ingestedAt,
      };
    });
  } catch (error) {
    console.error('Error fetching sensor readings:', error);
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    console.error('Error details:', errorDetails);
    throw new Error(`Failed to fetch sensor readings: ${errorMessage}`);
  }
}

/**
 * Retrieves recent public sensor readings (userId is null) for unauthenticated surfaces.
 */
export async function getRecentPublicSensorReadings(limit: number = 100) {
  try {
    const readings = await db
      .select({
        id: sensorReadings.id,
        sensorId: sensorReadings.sensorId,
        deviceId: sensors.deviceId,
        timestamp: sensorReadings.timestamp,
        pm25: sensorReadings.pm25,
        pm10: sensorReadings.pm10,
        pm1: sensorReadings.pm1,
        co2: sensorReadings.co2,
        temperature: sensorReadings.temperature,
        humidity: sensorReadings.humidity,
        value: sensorReadings.value,
        location: sensorReadings.location,
        transportType: sensorReadings.transportType,
        ingestedAt: sensorReadings.ingestedAt,
        latitude: sensors.latitude,
        longitude: sensors.longitude,
      })
      .from(sensorReadings)
      .leftJoin(sensors, eq(sensorReadings.sensorId, sensors.id))
      .where(isNull(sensorReadings.userId))
      .orderBy(desc(sensorReadings.ingestedAt))
      .limit(limit);

    return readings.map((reading) => {
      let locationStr = reading.location;
      if (reading.latitude != null && reading.longitude != null) {
        locationStr = `${reading.latitude},${reading.longitude}`;
      } else if (reading.location && !reading.location.includes(',')) {
        locationStr = reading.location;
      }

      const { category: aqiCategory, rule: aqiRule } = classifyAqiCategory(
        reading.pm25,
        reading.pm10,
        reading.co2,
        reading.temperature,
        reading.humidity,
      );

      return {
        id: reading.id,
        timestamp: reading.timestamp instanceof Date
          ? reading.timestamp.toISOString()
          : typeof reading.timestamp === 'string'
            ? reading.timestamp
            : new Date(reading.timestamp).toISOString(),
        sensorId: reading.deviceId || reading.sensorId?.toString() || '',
        value: reading.value ?? reading.pm25 ?? reading.pm10 ?? reading.pm1 ?? reading.co2 ?? 0,
        pm25: reading.pm25,
        pm10: reading.pm10,
        co2: reading.co2,
        temperature: reading.temperature,
        humidity: reading.humidity,
        aqiCategory,
        aqiRule,
        location: locationStr,
        transportType: reading.transportType,
        ingestedAt: reading.ingestedAt instanceof Date
          ? reading.ingestedAt
          : typeof reading.ingestedAt === 'string'
            ? new Date(reading.ingestedAt)
            : reading.ingestedAt,
      };
    });
  } catch (error) {
    console.error('Error fetching public sensor readings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to fetch public sensor readings: ${errorMessage}`);
  }
}

/**
 * Batch inserts sensor readings into the database
 * Optimized for handling large payloads from offline devices
 * @param readings - Array of sensor readings to insert
 * @param userId - Optional user ID to associate readings with (for data isolation)
 * @returns Number of rows inserted
 */
export async function batchInsertSensorReadings(readings: SensorReading[], userId?: number) {
  if (readings.length === 0) {
    return 0;
  }

  try {
    // Import findOrCreateSensor from sensor-data-access
    const { findOrCreateSensor, findOrCreateSite } = await import('./sensor-data-access');
    
    // Get unique sensor IDs and locations
    const uniqueSensorIds = Array.from(new Set(readings.map(r => r.sensor_id)));
    const uniqueLocations = Array.from(new Set(readings.map(r => r.location).filter(Boolean)));
    
    // Find or create all sensors and sites
    const sensorMap = new Map<string, number>();
    const siteMap = new Map<string, number>();
    
    // Create sites first
    for (const location of uniqueLocations) {
      if (location) {
        const siteId = await findOrCreateSite(location);
        siteMap.set(location, siteId);
      }
    }
    
    // Create sensors
    for (const sensorId of uniqueSensorIds) {
      const reading = readings.find(r => r.sensor_id === sensorId);
      const siteId = reading?.location ? siteMap.get(reading.location) : null;
      const sensor = await findOrCreateSensor({
        deviceId: sensorId,
        siteId: siteId || null,
      });
      sensorMap.set(sensorId, sensor.id);
    }
    
    // Map CSV data to database schema
    const records = readings.map((reading) => ({
      timestamp: new Date(reading.timestamp), // Convert string to Date
      sensorId: sensorMap.get(reading.sensor_id)!, // Use integer sensor ID
      value: reading.value,
      location: reading.location || null,
      transportType: reading.transport_type || null,
      userId: userId || null, // Associate with user if provided
    }));

    // Perform batch insert - Drizzle handles this efficiently
    await db.insert(sensorReadings).values(records);

    return readings.length;
  } catch (error) {
    console.error('Error batch inserting sensor readings:', error);
    throw new Error('Failed to insert sensor readings');
  }
}

// ============================================
// ADMIN-SPECIFIC DATA ACCESS FUNCTIONS
// ============================================

/**
 * Retrieves all users from the database (admin only)
 * @returns Array of all users with their basic information
 */
export async function getAllUsers() {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return allUsers;
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw new Error('Failed to fetch all users');
  }
}

/**
 * Retrieves system-wide statistics (admin only)
 * @returns Object containing system metrics
 */
export async function getSystemStats() {
  try {
    const [userCountResult] = await db
      .select({ count: count() })
      .from(users);
    
    const [dataPointCountResult] = await db
      .select({ count: count() })
      .from(iotData);
    
    const [sensorReadingCountResult] = await db
      .select({ count: count() })
      .from(sensorReadings);

    return {
      totalUsers: Number(userCountResult?.count) || 0,
      totalDataPoints: Number(dataPointCountResult?.count) || 0,
      totalSensorReadings: Number(sensorReadingCountResult?.count) || 0,
    };
  } catch (error) {
    console.error('Error fetching system stats:', error);
    throw new Error('Failed to fetch system stats');
  }
}

/**
 * Retrieves all IoT data with user information (admin only)
 * @param limit - Maximum number of records to retrieve
 * @returns Array of IoT data with user details
 */
export async function getAllIoTDataWithUsers(limit: number = 100) {
  try {
    const data = await db
      .select({
        id: iotData.id,
        timestamp: iotData.timestamp,
        dataPayload: iotData.dataPayload,
        userId: iotData.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(iotData)
      .leftJoin(users, eq(iotData.userId, users.id))
      .orderBy(desc(iotData.timestamp))
      .limit(limit);

    return data;
  } catch (error) {
    console.error('Error fetching all IoT data:', error);
    throw new Error('Failed to fetch all IoT data');
  }
}

/**
 * Retrieves user activity statistics (admin only)
 * @returns Array of users with their activity counts
 */
export async function getUserActivityStats() {
  try {
    const stats = await db
      .select({
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        dataPointCount: count(iotData.id),
      })
      .from(users)
      .leftJoin(iotData, eq(users.id, iotData.userId))
      .groupBy(users.id, users.name, users.email);

    return stats;
  } catch (error) {
    console.error('Error fetching user activity stats:', error);
    throw new Error('Failed to fetch user activity stats');
  }
}

/**
 * Retrieves comprehensive user aggregate data (admin only)
 * Includes sensor readings count, data points, and latest activity
 * @returns Array of users with their aggregate data
 */
export async function getUserAggregateData() {
  try {
    // Get all users with their basic info
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    // Get IoT data count per user
    const iotDataCounts = await db
      .select({
        userId: iotData.userId,
        count: count(iotData.id),
      })
      .from(iotData)
      .groupBy(iotData.userId);

    // Get latest IoT data timestamp per user
    const latestActivity = await db
      .select({
        userId: iotData.userId,
        latestTimestamp: iotData.timestamp,
      })
      .from(iotData)
      .orderBy(desc(iotData.timestamp));

    // Create a map of user data
    const iotDataCountMap = new Map(iotDataCounts.map(d => [d.userId, Number(d.count)]));
    const latestActivityMap = new Map<number, Date>();
    
    // Only keep the latest timestamp for each user
    latestActivity.forEach(activity => {
      if (!latestActivityMap.has(activity.userId)) {
        latestActivityMap.set(activity.userId, activity.latestTimestamp);
      }
    });

    // Combine all data
    const aggregateData = allUsers.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      dataPointCount: iotDataCountMap.get(user.id) || 0,
      latestActivity: latestActivityMap.get(user.id) || null,
    }));

    return aggregateData;
  } catch (error) {
    console.error('Error fetching user aggregate data:', error);
    throw new Error('Failed to fetch user aggregate data');
  }
}

/**
 * Retrieves detailed statistics for a specific user (admin only)
 * @param userId - The ID of the user
 * @returns Detailed user statistics
 */
export async function getUserDetailedStats(userId: number) {
  try {
    // Get user info
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    // Get IoT data count
    const [iotDataCount] = await db
      .select({ count: count() })
      .from(iotData)
      .where(eq(iotData.userId, userId));

    // Get recent IoT data
    const recentData = await db
      .select()
      .from(iotData)
      .where(eq(iotData.userId, userId))
      .orderBy(desc(iotData.timestamp))
      .limit(10);

    return {
      user,
      dataPointCount: Number(iotDataCount?.count) || 0,
      recentData,
    };
  } catch (error) {
    console.error('Error fetching user detailed stats:', error);
    throw new Error('Failed to fetch user detailed stats');
  }
}

