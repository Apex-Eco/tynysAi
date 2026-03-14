export type Coordinates = {
  latitude: number;
  longitude: number;
};

export const ALMATY_CENTER: readonly [number, number] = [43.238949, 76.889709];

const ALMATY_BOUNDS = {
  minLatitude: 43.0,
  maxLatitude: 43.5,
  minLongitude: 76.65,
  maxLongitude: 77.2,
} as const;

export function isWithinWorldBounds(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

export function isWithinAlmatyBounds(latitude: number, longitude: number): boolean {
  return (
    latitude >= ALMATY_BOUNDS.minLatitude &&
    latitude <= ALMATY_BOUNDS.maxLatitude &&
    longitude >= ALMATY_BOUNDS.minLongitude &&
    longitude <= ALMATY_BOUNDS.maxLongitude
  );
}

export function isValidAlmatyCoordinate(latitude: number, longitude: number): boolean {
  return isWithinWorldBounds(latitude, longitude) && isWithinAlmatyBounds(latitude, longitude);
}

export function parseCoordinatePair(location?: string | null): Coordinates | null {
  if (!location || !location.includes(",")) return null;

  const [latStr, lngStr] = location.split(",").map((part) => part.trim());
  const latitude = Number(latStr);
  const longitude = Number(lngStr);

  if (!isValidAlmatyCoordinate(latitude, longitude)) {
    return null;
  }

  return { latitude, longitude };
}
