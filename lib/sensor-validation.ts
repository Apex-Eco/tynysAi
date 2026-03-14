/**
 * Sensor Data Validation Utilities
 * Validates sensor readings according to expected ranges and formats
 */

import crypto from 'crypto';

export interface SensorReadingPayload {
  device_id: string;
  site?: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
  readings: {
    pm1?: number;
    pm25?: number;
    pm10?: number;
    co2?: number;
    co?: number;
    o3?: number;
    no2?: number;
    voc?: number;
    ch2o?: number;
    temp?: number;
    hum?: number;
    pressure?: number;
  };
  metadata?: {
    battery?: number;
    signal?: number;
    firmware?: string;
    error_code?: string;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Value ranges for different air quality metrics
 */
const VALUE_RANGES = {
  pm1: { min: 0, max: 1000 }, // μg/m³
  pm25: { min: 0, max: 1000 }, // μg/m³
  pm10: { min: 0, max: 1000 }, // μg/m³
  co2: { min: 300, max: 5000 }, // ppm
  co: { min: 0, max: 100 }, // ppm
  o3: { min: 0, max: 500 }, // ppb
  no2: { min: 0, max: 500 }, // ppb
  voc: { min: 0, max: 100 }, // ppm
  ch2o: { min: 0, max: 10 }, // ppm
  temp: { min: -40, max: 60 }, // Celsius
  hum: { min: 0, max: 100 }, // Percentage
  pressure: { min: 800, max: 1200 }, // hPa
  battery: { min: 0, max: 100 }, // Percentage
  signal: { min: -120, max: 0 }, // dBm
  latitude: { min: -90, max: 90 },
  longitude: { min: -180, max: 180 },
};

/**
 * Validates if a timestamp is valid and within acceptable range
 */
export function validateTimestamp(timestamp: string): { isValid: boolean; error?: string } {
  try {
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      return { isValid: false, error: 'Invalid timestamp format' };
    }
    
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    
    // Allow timestamps from 5 minutes ago to 1 hour in the future (for clock drift)
    if (date < fiveMinutesAgo) {
      return { isValid: false, error: 'Timestamp is too old (more than 5 minutes ago)' };
    }
    
    if (date > oneHourFromNow) {
      return { isValid: false, error: 'Timestamp is in the future (more than 1 hour ahead)' };
    }
    
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Failed to parse timestamp' };
  }
}

/**
 * Validates a numeric value against expected range
 */
function validateRange(
  value: number | undefined,
  fieldName: string,
  range: { min: number; max: number }
): { isValid: boolean; error?: string; warning?: string } {
  if (value === undefined || value === null) {
    return { isValid: true }; // Optional fields are allowed to be missing
  }
  
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    return { isValid: false, error: `${fieldName} must be a valid number` };
  }
  
  if (value < range.min) {
    return { 
      isValid: false, 
      error: `${fieldName} (${value}) is below minimum (${range.min})` 
    };
  }
  
  if (value > range.max) {
    return { 
      isValid: false, 
      error: `${fieldName} (${value}) exceeds maximum (${range.max})` 
    };
  }
  
  // Warn if value is at extreme ends (but still valid)
  if (value >= range.max * 0.9) {
    return { 
      isValid: true, 
      warning: `${fieldName} is near maximum range (${value} of ${range.max})` 
    };
  }
  
  return { isValid: true };
}

/**
 * Validates a sensor reading payload
 */
export function validateSensorReading(payload: SensorReadingPayload): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate device_id
  if (!payload.device_id || typeof payload.device_id !== 'string' || payload.device_id.trim() === '') {
    errors.push('device_id is required and must be a non-empty string');
  }
  
  // Validate timestamp
  if (!payload.timestamp || typeof payload.timestamp !== 'string') {
    errors.push('timestamp is required and must be a string');
  } else {
    const timestampValidation = validateTimestamp(payload.timestamp);
    if (!timestampValidation.isValid) {
      errors.push(`timestamp: ${timestampValidation.error}`);
    }
  }
  
  // Validate readings object
  if (!payload.readings || typeof payload.readings !== 'object') {
    errors.push('readings object is required');
  } else {
    // Validate each reading field
    if (payload.readings.pm1 !== undefined) {
      const result = validateRange(payload.readings.pm1, 'pm1', VALUE_RANGES.pm1);
      if (!result.isValid) errors.push(result.error!);
      if (result.warning) warnings.push(result.warning);
    }
    
    if (payload.readings.pm25 !== undefined) {
      const result = validateRange(payload.readings.pm25, 'pm25', VALUE_RANGES.pm25);
      if (!result.isValid) errors.push(result.error!);
      if (result.warning) warnings.push(result.warning);
    }
    
    if (payload.readings.pm10 !== undefined) {
      const result = validateRange(payload.readings.pm10, 'pm10', VALUE_RANGES.pm10);
      if (!result.isValid) errors.push(result.error!);
      if (result.warning) warnings.push(result.warning);
    }
    
    if (payload.readings.co2 !== undefined) {
      const result = validateRange(payload.readings.co2, 'co2', VALUE_RANGES.co2);
      if (!result.isValid) errors.push(result.error!);
      if (result.warning) warnings.push(result.warning);
    }
    
    if (payload.readings.co !== undefined) {
      const result = validateRange(payload.readings.co, 'co', VALUE_RANGES.co);
      if (!result.isValid) errors.push(result.error!);
      if (result.warning) warnings.push(result.warning);
    }
    
    if (payload.readings.o3 !== undefined) {
      const result = validateRange(payload.readings.o3, 'o3', VALUE_RANGES.o3);
      if (!result.isValid) errors.push(result.error!);
      if (result.warning) warnings.push(result.warning);
    }
    
    if (payload.readings.no2 !== undefined) {
      const result = validateRange(payload.readings.no2, 'no2', VALUE_RANGES.no2);
      if (!result.isValid) errors.push(result.error!);
      if (result.warning) warnings.push(result.warning);
    }
    
    if (payload.readings.voc !== undefined) {
      const result = validateRange(payload.readings.voc, 'voc', VALUE_RANGES.voc);
      if (!result.isValid) errors.push(result.error!);
      if (result.warning) warnings.push(result.warning);
    }
    
    if (payload.readings.ch2o !== undefined) {
      const result = validateRange(payload.readings.ch2o, 'ch2o', VALUE_RANGES.ch2o);
      if (!result.isValid) errors.push(result.error!);
      if (result.warning) warnings.push(result.warning);
    }
    
    if (payload.readings.temp !== undefined) {
      const result = validateRange(payload.readings.temp, 'temp', VALUE_RANGES.temp);
      if (!result.isValid) errors.push(result.error!);
      if (result.warning) warnings.push(result.warning);
    }
    
    if (payload.readings.hum !== undefined) {
      const result = validateRange(payload.readings.hum, 'hum', VALUE_RANGES.hum);
      if (!result.isValid) errors.push(result.error!);
      if (result.warning) warnings.push(result.warning);
    }
    
    if (payload.readings.pressure !== undefined) {
      const result = validateRange(payload.readings.pressure, 'pressure', VALUE_RANGES.pressure);
      if (!result.isValid) errors.push(result.error!);
      if (result.warning) warnings.push(result.warning);
    }
  }

  // Optional top-level coordinates for map marker placement
  if (payload.latitude !== undefined) {
    const result = validateRange(payload.latitude, 'latitude', VALUE_RANGES.latitude);
    if (!result.isValid) errors.push(result.error!);
    if (result.warning) warnings.push(result.warning);
  }

  if (payload.longitude !== undefined) {
    const result = validateRange(payload.longitude, 'longitude', VALUE_RANGES.longitude);
    if (!result.isValid) errors.push(result.error!);
    if (result.warning) warnings.push(result.warning);
  }
  
  // Validate metadata if present
  if (payload.metadata) {
    if (payload.metadata.battery !== undefined) {
      const result = validateRange(payload.metadata.battery, 'battery', VALUE_RANGES.battery);
      if (!result.isValid) errors.push(result.error!);
      if (result.warning) warnings.push(result.warning);
    }
    
    if (payload.metadata.signal !== undefined) {
      const result = validateRange(payload.metadata.signal, 'signal', VALUE_RANGES.signal);
      if (!result.isValid) errors.push(result.error!);
      if (result.warning) warnings.push(result.warning);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generates a hash for duplicate detection
 * Uses device_id, timestamp, and key reading values
 */
export function generateDataHash(payload: SensorReadingPayload): string {
  const hashInput = JSON.stringify({
    device_id: payload.device_id,
    timestamp: payload.timestamp,
    pm25: payload.readings?.pm25,
    co2: payload.readings?.co2,
    temp: payload.readings?.temp,
  });
  
  return crypto.createHash('sha256').update(hashInput).digest('hex');
}
